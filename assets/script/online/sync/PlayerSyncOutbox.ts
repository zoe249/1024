import { sys } from 'cc'
import type { ShareRewardKind } from '../../economy/PlayerEconomyStore'
import type { SkillKind } from '../../economy/SkillStock'

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
}

const STORAGE_KEY = 'number-garden-player-sync-v1'
const MAX_OUTBOX_SIZE = 200

function createIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 玩法与经济仓库只写纯数据操作；网络同步由首页流程统一调度。 */
export class PlayerSyncOutbox {
  private static instance: PlayerSyncOutbox | null = null
  private state: PersistedSyncState

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerSyncOutbox()
    }
    return this.instance
  }

  private constructor() {
    this.state = this.loadState()
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

  recordDailyCheckIn(date: string) {
    this.enqueue('daily_check_in', { date })
  }

  recordShareReward(kind: ShareRewardKind) {
    this.enqueue('share_reward', { kind })
  }

  recordEnergyConsumed(amount: number) {
    this.enqueue('energy_consumed', { amount })
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
    this.state.cloudRevision = Math.max(0, Math.floor(cloudRevision))
    this.state.guestImported ||= initialImport
    const acknowledged = new Set(acknowledgedIds)
    this.state.outbox = initialImport
      ? []
      : this.state.outbox.filter(operation => !acknowledged.has(operation.operationId))
    this.state.progress = {
      highestScore: Math.max(0, Math.floor(progress.highestScore)),
      highestNumber: Math.max(0, Math.floor(progress.highestNumber)),
      completedGames: Math.max(0, Math.floor(progress.completedGames))
    }
    this.saveState()
  }

  updateCloudRevision(revision: number) {
    this.state.cloudRevision = Math.max(0, Math.floor(revision))
    this.saveState()
  }

  private enqueue(type: SyncOperation['type'], payload: SyncOperation['payload']) {
    this.state.outbox.push({
      operationId: createIdentifier(type),
      type,
      occurredAt: new Date().toISOString(),
      payload
    })
    if (this.state.outbox.length > MAX_OUTBOX_SIZE) {
      // 保留最新操作，首次登录仍由完整游客快照承接更早的本地结果。
      this.state.outbox.splice(0, this.state.outbox.length - MAX_OUTBOX_SIZE)
    }
    this.saveState()
  }

  private createDefaultState(): PersistedSyncState {
    return {
      version: 1,
      installationId: createIdentifier('install'),
      cloudRevision: 0,
      guestImported: false,
      outbox: [],
      progress: { highestScore: 0, highestNumber: 0, completedGames: 0 }
    }
  }

  private loadState(): PersistedSyncState {
    const fallback = this.createDefaultState()
    try {
      const parsed = JSON.parse(sys.localStorage.getItem(STORAGE_KEY) ?? '') as Partial<PersistedSyncState>
      return {
        version: 1,
        installationId: typeof parsed.installationId === 'string' && parsed.installationId
          ? parsed.installationId
          : fallback.installationId,
        cloudRevision: Math.max(0, Math.floor(parsed.cloudRevision ?? 0)),
        guestImported: parsed.guestImported === true,
        outbox: Array.isArray(parsed.outbox) ? parsed.outbox.slice(-MAX_OUTBOX_SIZE) : [],
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
      sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (error) {
      console.warn('云同步队列保存失败', error)
    }
  }
}
