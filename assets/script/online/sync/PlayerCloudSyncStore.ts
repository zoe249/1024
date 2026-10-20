import { game, Game } from 'cc'
import { ApiError, type SettlementRank } from '../api/GameApiClient'
import { PlayerEconomyStore, monotonicNow, type CloudCheckInSnapshot, type CloudEconomySnapshot, type ShareRewardKind } from '../../economy/PlayerEconomyStore'
import { PlayerSessionStore } from '../auth/PlayerSessionStore'
import { PlayerSyncOutbox } from './PlayerSyncOutbox'

type CloudProgressSnapshot = {
  highestScore: number
  highestNumber: number
  completedGames: number
  verifiedHighestScore: number
  verifiedHighestNumber: number
}
export type PlayerCloudSnapshot = {
  schemaVersion: 1
  economy: CloudEconomySnapshot
  checkIn: CloudCheckInSnapshot
  progress: CloudProgressSnapshot
  ongoingGame: unknown | null
}
type SyncReason = 'calibration' | 'boundary' | 'operation'
export type EconomySyncEvent = { kind: 'state' | 'gain' | 'error' | 'rejected'; amount?: number; message?: string }
type Receipt = { accepted: boolean; message?: string }
type NetworkApi = {
  onNetworkStatusChange?: (callback: (state: { isConnected: boolean }) => void) => void
  offNetworkStatusChange?: (callback: (state: { isConnected: boolean }) => void) => void
}
function createIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function scheduleNow() { return monotonicNow() ?? Date.now() }

/** 跨场景合并同步，恢复边界失败后退避；组件只订阅纯数据事件。 */
export class PlayerCloudSyncStore {
  private static instance: PlayerCloudSyncStore | null = null
  private readonly session = PlayerSessionStore.getInstance()
  private readonly outbox = PlayerSyncOutbox.getInstance()
  private syncPromise: Promise<PlayerCloudSnapshot> | null = null
  private syncAccount: string | null = null
  private consumePromise: Promise<Receipt> | null = null
  private rewardPromise: Promise<Receipt> | null = null
  private readonly receipts = new Map<string, Receipt>()
  private readonly gameRanks = new Map<string, SettlementRank | null>()
  private readonly listeners = new Set<(event: EconomySyncEvent) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private foreground = true
  private failures = 0
  private nextAttemptAt = 0
  private networkApi: NetworkApi | null = null
  private browserNetwork: { addEventListener?: (event: string, callback: () => void) => void; removeEventListener?: (event: string, callback: () => void) => void } | null = null
  private readonly onHide = () => {
    this.foreground = false
    PlayerEconomyStore.getInstance().invalidateServerClock()
  }
  private readonly onShow = () => {
    this.foreground = true
    this.nextAttemptAt = 0
    PlayerEconomyStore.getInstance().invalidateServerClock()
    this.tick()
  }
  private readonly onReconnect = () => {
    if (!this.foreground) return
    this.nextAttemptAt = 0
    this.tick()
  }
  private readonly onNetwork = (state: { isConnected: boolean }) => { if (state.isConnected) this.onReconnect() }
  static getInstance() {
    if (!this.instance) this.instance = new PlayerCloudSyncStore()
    return this.instance
  }

  activate(listener: (event: EconomySyncEvent) => void) {
    this.listeners.add(listener)
    if (this.timer === null) {
      game.on(Game.EVENT_HIDE, this.onHide, this)
      game.on(Game.EVENT_SHOW, this.onShow, this)
      this.networkApi = (globalThis as { wx?: NetworkApi }).wx ?? null
      this.networkApi?.onNetworkStatusChange?.(this.onNetwork)
      this.browserNetwork = (globalThis as { window?: typeof this.browserNetwork }).window ?? null
      this.browserNetwork?.addEventListener?.('online', this.onReconnect)
      this.timer = setInterval(() => this.tick(), 1000)
      this.nextAttemptAt = 0
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        if (this.timer !== null) clearInterval(this.timer)
        this.timer = null
        game.off(Game.EVENT_HIDE, this.onHide, this)
        game.off(Game.EVENT_SHOW, this.onShow, this)
        this.networkApi?.offNetworkStatusChange?.(this.onNetwork)
        this.networkApi = null
        this.browserNetwork?.removeEventListener?.('online', this.onReconnect)
        this.browserNetwork = null
      }
    }
  }
  isForeground() { return this.foreground }
  private emit(event: EconomySyncEvent) {
    if (this.foreground) for (const listener of this.listeners) listener(event)
  }
  private tick() {
    if (!this.foreground || this.syncPromise || !this.session.getSnapshot().playerId) return
    const economy = PlayerEconomyStore.getInstance()
    const state = economy.getEnergyBarState()
    if (scheduleNow() < this.nextAttemptAt && (this.failures > 0 || state.remainingSeconds !== 0 && this.outbox.getOperations().length === 0)) return
    void this.sync(economy, state.remainingSeconds === 0 ? 'boundary' : 'calibration').catch(() => {})
  }
  sync(economy = PlayerEconomyStore.getInstance(), reason: SyncReason = 'calibration', silent = false): Promise<PlayerCloudSnapshot> {
    const account = this.session.getSnapshot().playerId
    if (this.syncPromise) {
      return account === this.syncAccount ? this.syncPromise
        : this.syncPromise.then(() => this.sync(economy, reason, silent), () => this.sync(economy, reason, silent))
    }
    this.syncAccount = account
    this.syncPromise = this.performSync(economy, reason).then(result => {
      this.syncPromise = null
      this.failures = 0
      this.nextAttemptAt = scheduleNow() + (this.outbox.getOperations().length ? 1000 : 60_000)
      this.emit({ kind: 'state' })
      return result
    }, error => {
      this.syncPromise = null
      const backoff = [5000, 15000, 30000, 60000]
      this.nextAttemptAt = scheduleNow() + backoff[Math.min(this.failures++, backoff.length - 1)]
      if (!silent && this.failures === 1) this.emit({ kind: 'error', message: '体力同步暂未完成，联网后自动校准' })
      throw error
    })
    return this.syncPromise
  }

  /** 等待本局操作自己的回执，避免复用较早的校准请求名次。 */
  async syncGameFinished(operationId: string): Promise<SettlementRank | null> {
    const account = this.session.getSnapshot().playerId
    if (!account) return null
    const key = `${account}:${operationId}`
    do {
      await this.sync(PlayerEconomyStore.getInstance(), 'operation', true)
      if (account !== this.session.getSnapshot().playerId) return null
    } while (this.outbox.getOperations().some(operation => operation.operationId === operationId))
    const rank = this.gameRanks.get(key) ?? null
    this.gameRanks.delete(key)
    return rank
  }

  /** 在线消费等待单条回执，网络失败时只允许使用最近确认余额形成未确认消费。 */
  consumeEnergy(economy = PlayerEconomyStore.getInstance()): Promise<Receipt> {
    if (this.consumePromise) return this.consumePromise
    this.consumePromise = this.consumeOnce(economy).then(result => {
      this.consumePromise = null
      return result
    }, error => { this.consumePromise = null; throw error })
    return this.consumePromise
  }
  /** 未开始的消费意图保存原 id，401 恢复后仍等待同一笔消费的回执。 */
  private async consumeOnce(economy: PlayerEconomyStore): Promise<Receipt> {
    if (!this.session.getSnapshot().playerId) return { accepted: economy.tryConsumeEnergy(), message: '体力不足，请点击体力条补充' }
    const account = this.session.getSnapshot().playerId
    if (!economy.hasConfirmedEnergy()) {
      try { await this.sync(economy) } catch { return { accepted: false, message: '请联网校准体力后重试' } }
    }
    if (account !== this.session.getSnapshot().playerId) return { accepted: false, message: '账号已切换，请重试' }
    let intent = this.outbox.getStartIntent()
    if (!intent && !economy.tryConsumeEnergy()) {
      try { await this.sync(economy) } catch { /* 最近余额不足时不透支离线额度。 */ }
      if (!economy.tryConsumeEnergy()) return { accepted: false, message: '体力不足，请点击体力条补充' }
    }
    if (!intent) {
      this.outbox.setStartIntent(economy.lastEnergyOperationId!)
      intent = this.outbox.getStartIntent()!
    }
    const id = intent.operationId
    try {
      if (!intent.receipt) {
        do { await this.sync(economy, 'operation') } while (this.outbox.getOperations().some(op => op.operationId === id))
      }
      const receipt = this.outbox.getStartIntent()?.receipt ?? this.receipts.get(id)
      if (receipt) this.outbox.clearStartIntent()
      return receipt ?? { accepted: false, message: '消费尚未确认，请重试' }
    } catch (error) {
      if (account !== this.session.getSnapshot().playerId) return { accepted: false, message: '账号已切换，请重试' }
      if (error instanceof ApiError && (error.statusCode === 0 || error.statusCode >= 500)) {
        this.outbox.clearStartIntent()
        return { accepted: true, message: '使用缓存体力开始，消费待联网确认' }
      }
      return { accepted: false, message: '消费待确认，请恢复登录后重试' }
    }
  }
  claimEnergyReward(economy = PlayerEconomyStore.getInstance()): Promise<Receipt> {
    return this.claimShareReward('energy', economy)
  }
  claimShareReward(kind: ShareRewardKind, economy = PlayerEconomyStore.getInstance()): Promise<Receipt> {
    if (this.rewardPromise) return this.rewardPromise
    this.rewardPromise = this.rewardOnce(economy, kind).then(result => {
      this.rewardPromise = null
      return result
    }, error => { this.rewardPromise = null; throw error })
    return this.rewardPromise
  }
  /** 分享流程完成后提交奖励操作，网络失败时保留队列，余额仍等待服务端。 */
  private async rewardOnce(economy: PlayerEconomyStore, kind: ShareRewardKind): Promise<Receipt> {
    if (!this.session.getSnapshot().playerId) {
      const result = economy.claimShareReward(kind)
      if (result.claimed && kind === 'energy') this.emit({ kind: 'gain', amount: result.amount })
      return { accepted: result.claimed, message: result.claimed ? undefined : '体力已满，无需补充' }
    }
    await this.sync(economy)
    if (!economy.canClaimShareReward(kind)) return { accepted: false, message: '体力已满，无需补充' }
    const id = this.outbox.recordShareReward(kind, economy.getEstimatedServerNow() ?? undefined)
    do { await this.sync(economy, 'operation') } while (this.outbox.getOperations().some(op => op.operationId === id))
    return this.receipts.get(id) ?? { accepted: false, message: '奖励待联网确认' }
  }
  private async performSync(economy: PlayerEconomyStore, reason: SyncReason) {
    if (!this.session.getToken()) await this.session.restore()
    let latest: PlayerCloudSnapshot | null = null
    for (let batchIndex = 0; batchIndex < 3; batchIndex += 1) {
      const initialImport = !this.outbox.hasImportedGuest()
      const operations = initialImport ? [] : this.outbox.getOperations().slice(0, 100)
      latest = await this.syncBatch(economy, initialImport, operations, reason, true)
      if (this.outbox.getOperations().length === 0) break
    }
    if (!latest) throw new Error('数据同步未完成')
    return latest
  }
  /** 捕获本批导入范围；先确认本批操作，再重建响应之后新增的暂存视图。 */
  private async syncBatch(economy: PlayerEconomyStore, initialImport: boolean,
    operations: ReturnType<PlayerSyncOutbox['getOperations']>, reason: SyncReason, canResolveConflict: boolean): Promise<PlayerCloudSnapshot> {
    if (!this.session.getToken()) throw new ApiError(401, 'UNAUTHORIZED', '请先登录')
    const account = this.session.getSnapshot().playerId
    const local = economy.getCloudSnapshot()
    const importedIds = initialImport ? this.outbox.getOperations().map(op => op.operationId) : []
    const before = economy.getEnergyBarState()
    const hadConfirmedEnergy = economy.hasConfirmedEnergy()
    const previousBase = local.economy.lastEnergyRecoveryAt
    const body = {
      installationId: this.outbox.getInstallationId(), baseRevision: this.outbox.getCloudRevision(), idempotencyKey: createIdentifier('sync'),
      guestSnapshot: initialImport ? { schemaVersion: 1, economy: {
        energy: local.economy.energy, maxEnergy: local.economy.maxEnergy, coins: local.economy.coins,
        skills: local.economy.skills, lastEnergyRecoveryAt: local.economy.lastEnergyRecoveryAt
      }, checkIn: local.checkIn, progress: this.outbox.getProgress(), ongoingGame: null } : null,
      operations
    }
    try {
      const result = await this.session.getApiClient().sync<PlayerCloudSnapshot>(body)
      if (account !== this.session.getSnapshot().playerId) throw new Error('账号已切换，忽略旧账号响应')
      const accepted = [...result.acceptedOperationIds, ...result.duplicateOperationIds]
      const gameOperations = operations.filter(operation => operation.type === 'game_finished')
      const lastGameOperation = gameOperations.slice(-1)[0]
      const legacyRank = result.rank && gameOperations.length > 1
        ? { ...result.rank, previous: result.rank.current, celebrate: false } : result.rank
      for (const operation of operations) {
        if (operation.type !== 'game_finished') continue
        const settlement = result.settlement?.operationId === operation.operationId ? result.settlement
          : !result.settlement && operation === lastGameOperation ? legacyRank : null
        this.gameRanks.set(`${account}:${operation.operationId}`, accepted.indexOf(operation.operationId) >= 0 ? settlement ?? null : null)
      }
      if (this.gameRanks.size > 200) this.gameRanks.delete(this.gameRanks.keys().next().value!)
      for (const id of accepted) {
        this.receipts.set(id, { accepted: true })
        this.outbox.setStartReceipt(id, { accepted: true })
      }
      for (const rejection of result.rejectedOperations) {
        this.receipts.set(rejection.operationId, { accepted: false, message: rejection.message })
        this.outbox.setStartReceipt(rejection.operationId, { accepted: false, message: rejection.message })
        if (!operations.some(operation => operation.operationId === rejection.operationId && operation.type === 'game_finished')) {
          this.emit({ kind: 'rejected', message: `待同步操作未通过：${rejection.message}` })
        }
      }
      if (this.receipts.size > 1000) for (const id of [...this.receipts.keys()].slice(0, this.receipts.size - 1000)) this.receipts.delete(id)
      this.outbox.applySyncResult(result.cloudRevision, [...accepted, ...result.rejectedOperations.map(op => op.operationId), ...importedIds], {
        highestScore: result.snapshot.progress.highestScore, highestNumber: result.snapshot.progress.highestNumber,
        completedGames: result.snapshot.progress.completedGames
      }, initialImport)
      const applied = economy.applyCloudSnapshot(result.snapshot.economy, result.snapshot.checkIn, result.serverTime, result.cloudRevision)
      if (!this.foreground) economy.invalidateServerClock()
      const after = economy.getEnergyBarState()
      const rewardAccepted = operations.some(op => op.type === 'share_reward' && op.payload.kind === 'energy' && accepted.indexOf(op.operationId) >= 0)
      const elapsed = Date.parse(result.serverTime) - Date.parse(previousBase)
      const singleRecovery = elapsed >= 300_000 && elapsed < 600_000
      if (applied && !initialImport && hadConfirmedEnergy && after.energy - before.energy === 1 &&
        (rewardAccepted || reason === 'boundary' && singleRecovery)) this.emit({ kind: 'gain', amount: 1 })
      return result.snapshot
    } catch (error) {
      if (account !== this.session.getSnapshot().playerId) throw error
      if (error instanceof ApiError && error.statusCode === 401) this.session.markUnauthorized()
      if (canResolveConflict && error instanceof ApiError && error.statusCode === 409) {
        const revision = this.readConflictRevision(error.details)
        if (revision !== null) { this.outbox.updateCloudRevision(revision); return this.syncBatch(economy, initialImport, operations, reason, false) }
      }
      throw error
    }
  }
  private readConflictRevision(details: unknown) {
    if (!details || typeof details !== 'object' || !('cloudRevision' in details)) return null
    const revision = Number((details as { cloudRevision?: unknown }).cloudRevision)
    return Number.isInteger(revision) && revision >= 0 ? revision : null
  }
}
