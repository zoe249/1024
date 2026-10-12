import { sys } from 'cc'
import type { ShareRewardKind } from '../../economy/PlayerEconomyStore'
import type { SkillKind } from '../../economy/SkillStock'
import { PlayerSessionStore } from '../auth/PlayerSessionStore'
import { getPlayerAccountStorageKey, isLaterPlayerAccount } from '../auth/PlayerAccountStorage'

export type SyncOperation = {
  operationId: string
  type: 'daily_check_in' | 'share_reward' | 'energy_consumed' | 'skill_purchased' | 'skill_consumed' | 'game_finished'
  occurredAt: string
  payload: Record<string, string | number>
}

type LocalProgress = {
  highestScore: number
  highestNumber: number
  completedGames: number
}

type PersistedSyncState = {
  version: 1
  installationId: string
  cloudRevision: number
  guestImported: boolean
  outbox: SyncOperation[]
  progress: LocalProgress
  confirmedProgress?: LocalProgress
  startIntent?: { operationId: string; receipt?: { accepted: boolean; message?: string } }
}

const STORAGE_KEY = 'number-garden-player-sync-v1'
const MAX_OUTBOX_SIZE = 200

function createIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 玩法与经济仓库只写纯数据操作；网络同步由首页流程统一调度。 */
export class PlayerSyncOutbox {
  private static instance: PlayerSyncOutbox | null = null
  private storageKey = ''
  private accountState: PersistedSyncState
  private get state(): PersistedSyncState {
    const playerId = PlayerSessionStore.getInstance().getSnapshot().playerId
    const key = getPlayerAccountStorageKey(STORAGE_KEY, playerId)
    if (key !== this.storageKey) {
      this.storageKey = key
      this.accountState = this.loadState()
    }
    return this.accountState
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerSyncOutbox()
    }
    return this.instance
  }

  private constructor() {
    void this.state
  }

  getInstallationId() {
    return this.state.installationId
  }

  getCloudRevision() {
    return this.state.cloudRevision
  }

  hasImportedGuest() {
    return this.state.guestImported
  }

  getOperations() {
    return this.state.outbox.map(operation => ({ ...operation, payload: { ...operation.payload } }))
  }

  getProgress() {
    return { ...this.state.progress }
  }

  getStartIntent() { return this.state.startIntent }

  setStartIntent(operationId: string) { this.state.startIntent = { operationId }; this.saveState() }

  setStartReceipt(operationId: string, receipt: { accepted: boolean; message?: string }) {
    if (this.state.startIntent?.operationId === operationId) {
      this.state.startIntent.receipt = receipt
      this.saveState()
    }
  }

  clearStartIntent() { delete this.state.startIntent; this.saveState() }

  recordDailyCheckIn(date: string) {
    this.enqueue('daily_check_in', { date })
  }

  recordShareReward(kind: ShareRewardKind, occurredAtMs?: number) {
    return this.enqueue('share_reward', { kind }, occurredAtMs)
  }

  recordEnergyConsumed(amount: number, occurredAtMs?: number) {
    return this.enqueue('energy_consumed', { amount }, occurredAtMs)
  }

  recordSkillPurchased(skill: SkillKind) {
    this.enqueue('skill_purchased', { skill })
  }

  recordSkillConsumed(skill: SkillKind) {
    this.enqueue('skill_consumed', { skill })
  }

  recordGameFinished(score: number, highestNumber: number) {
    const safeScore = Math.max(0, Math.floor(score))
    const safeHighest = Math.max(0, Math.floor(highestNumber))
    this.state.progress.highestScore = Math.max(this.state.progress.highestScore, safeScore)
    this.state.progress.highestNumber = Math.max(this.state.progress.highestNumber, safeHighest)
    this.state.progress.completedGames += 1
    this.enqueue('game_finished', {
      gameId: createIdentifier('game'),
      score: safeScore,
      highestNumber: safeHighest
    })
  }

  applySyncResult(
    cloudRevision: number,
    acknowledgedIds: string[],
    progress: LocalProgress,
    initialImport: boolean
  ) {
    const canApplyProgress = cloudRevision >= this.state.cloudRevision
    this.state.cloudRevision = Math.max(this.state.cloudRevision, Math.floor(cloudRevision))
    this.state.guestImported ||= initialImport
    const acknowledged = new Set(acknowledgedIds)
    this.state.outbox = this.state.outbox.filter(operation => !acknowledged.has(operation.operationId))
    if (canApplyProgress) this.state.confirmedProgress = {
      highestScore: Math.max(0, Math.floor(progress.highestScore)),
      highestNumber: Math.max(0, Math.floor(progress.highestNumber)),
      completedGames: Math.max(0, Math.floor(progress.completedGames))
    }
    this.state.progress = { ...(this.state.confirmedProgress ?? this.state.progress) }
    for (const operation of this.state.outbox) {
      if (operation.type !== 'game_finished') continue
      this.state.progress.highestScore = Math.max(this.state.progress.highestScore, Number(operation.payload.score))
      this.state.progress.highestNumber = Math.max(this.state.progress.highestNumber, Number(operation.payload.highestNumber))
      this.state.progress.completedGames += 1
    }
    this.saveState()
  }

  updateCloudRevision(revision: number) {
    this.state.cloudRevision = Math.max(0, Math.floor(revision))
    this.saveState()
  }

  private enqueue(type: SyncOperation['type'], payload: SyncOperation['payload'], occurredAtMs = Date.now()) {
    const operation = {
      operationId: createIdentifier(type),
      type,
      occurredAt: new Date(occurredAtMs).toISOString(),
      payload
    }
    this.state.outbox.push(operation)
    if (!PlayerSessionStore.getInstance().getSnapshot().playerId && this.state.outbox.length > MAX_OUTBOX_SIZE) {
      // 保留最新操作，首次登录仍由完整游客快照承接更早的本地结果。
      this.state.outbox.splice(0, this.state.outbox.length - MAX_OUTBOX_SIZE)
    }
    if (!this.saveState()) {
      this.state.outbox = this.state.outbox.filter(item => item.operationId !== operation.operationId)
      throw new Error('操作保存失败，请腾出存储空间后重试')
    }
    return operation.operationId
  }

  private createDefaultState(): PersistedSyncState {
    return {
      version: 1,
      installationId: createIdentifier('install'),
      cloudRevision: 0,
      guestImported: isLaterPlayerAccount(STORAGE_KEY, PlayerSessionStore.getInstance().getSnapshot().playerId),
      outbox: [],
      progress: { highestScore: 0, highestNumber: 0, completedGames: 0 }
    }
  }

  private loadState(): PersistedSyncState {
    const fallback = this.createDefaultState()
    try {
      const parsed = JSON.parse(sys.localStorage.getItem(this.storageKey) ?? '') as Partial<PersistedSyncState>
      return {
        version: 1,
        installationId: typeof parsed.installationId === 'string' && parsed.installationId
          ? parsed.installationId
          : fallback.installationId,
        cloudRevision: Math.max(0, Math.floor(parsed.cloudRevision ?? 0)),
        guestImported: parsed.guestImported === true,
        startIntent: parsed.startIntent,
        confirmedProgress: parsed.confirmedProgress,
        outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
        progress: {
          highestScore: Math.max(0, Math.floor(parsed.progress?.highestScore ?? 0)),
          highestNumber: Math.max(0, Math.floor(parsed.progress?.highestNumber ?? 0)),
          completedGames: Math.max(0, Math.floor(parsed.progress?.completedGames ?? 0))
        }
      }
    } catch {
      return fallback
    }
  }

  private saveState() {
    try {
      sys.localStorage.setItem(this.storageKey, JSON.stringify(this.state))
      return true
    } catch (error) {
      console.warn('云同步队列保存失败', error)
      return false
    }
  }
}
