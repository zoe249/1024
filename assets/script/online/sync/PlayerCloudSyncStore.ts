import { ApiError } from '../api/GameApiClient'
import {
  PlayerEconomyStore,
  type CloudCheckInSnapshot,
  type CloudEconomySnapshot
} from '../../PlayerEconomyStore'
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

function createIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 负责会话后的批量同步；失败时不清空本地数据或待同步操作。 */
export class PlayerCloudSyncStore {
  private static instance: PlayerCloudSyncStore | null = null
  private readonly session = PlayerSessionStore.getInstance()
  private readonly outbox = PlayerSyncOutbox.getInstance()
  private syncPromise: Promise<PlayerCloudSnapshot> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerCloudSyncStore()
    }
    return this.instance
  }

  sync(economy = PlayerEconomyStore.getInstance()): Promise<PlayerCloudSnapshot> {
    if (this.syncPromise) {
      return this.syncPromise
    }
    const sync = this.performSync(economy)
    this.syncPromise = sync.then(result => {
      this.syncPromise = null
      return result
    }, error => {
      this.syncPromise = null
      throw error
    })
    return this.syncPromise
  }

  private async performSync(economy: PlayerEconomyStore) {
    let latest: PlayerCloudSnapshot | null = null
    // 接口单批最多 100 条；循环上限防止异常状态形成高频请求。
    for (let batchIndex = 0; batchIndex < 3; batchIndex += 1) {
      const initialImport = !this.outbox.hasImportedGuest()
      const operations = initialImport ? [] : this.outbox.getOperations().slice(0, 100)
      latest = await this.syncBatch(economy, initialImport, operations, true)
      if (initialImport || this.outbox.getOperations().length === 0) {
        break
      }
    }
    if (!latest) {
      throw new Error('数据同步未完成')
    }
    return latest
  }

  private async syncBatch(
    economy: PlayerEconomyStore,
    initialImport: boolean,
    operations: ReturnType<PlayerSyncOutbox['getOperations']>,
    canResolveConflict: boolean
  ): Promise<PlayerCloudSnapshot> {
    const token = this.session.getToken()
    if (!token) {
      throw new ApiError(401, 'UNAUTHORIZED', '请先登录')
    }
    const local = economy.getCloudSnapshot()
    const progress = this.outbox.getProgress()
    const body = {
      installationId: this.outbox.getInstallationId(),
      baseRevision: this.outbox.getCloudRevision(),
      idempotencyKey: createIdentifier('sync'),
      guestSnapshot: initialImport ? {
        schemaVersion: 1,
        economy: local.economy,
        checkIn: local.checkIn,
        progress,
        // 进行中的棋盘只在后续稳定结算点接入，避免上传动画中间态。
        ongoingGame: null
      } : null,
      operations
    }

    try {
      const result = await this.session.getApiClient().sync<PlayerCloudSnapshot>(body)
      const acknowledgedIds = [
        ...result.acceptedOperationIds,
        ...result.duplicateOperationIds,
        ...result.rejectedOperations.map(operation => operation.operationId)
      ]
      this.outbox.applySyncResult(
        result.cloudRevision,
        acknowledgedIds,
        {
          highestScore: result.snapshot.progress.highestScore,
          highestNumber: result.snapshot.progress.highestNumber,
          completedGames: result.snapshot.progress.completedGames
        },
        initialImport
      )
      economy.applyCloudSnapshot(result.snapshot.economy, result.snapshot.checkIn)
      return result.snapshot
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        this.session.markUnauthorized()
      }
      if (canResolveConflict && error instanceof ApiError && error.statusCode === 409) {
        const revision = this.readConflictRevision(error.details)
        if (revision !== null) {
          this.outbox.updateCloudRevision(revision)
          return this.syncBatch(economy, initialImport, operations, false)
        }
      }
      throw error
    }
  }

  private readConflictRevision(details: unknown) {
    if (!details || typeof details !== 'object' || !('cloudRevision' in details)) {
      return null
    }
    const revision = Number((details as { cloudRevision?: unknown }).cloudRevision)
    return Number.isInteger(revision) && revision >= 0 ? revision : null
  }
}
