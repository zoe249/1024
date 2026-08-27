import type { SkillKind } from './SkillStock'
import {
  areBoardConfigsEqual,
  cloneBoardConfig,
  DEFAULT_BOARD_CONFIG,
  isBoardMatrixCompatible,
  isValidBoardConfig,
  normalizeBoardConfig,
  type BoardConfig,
  type BoardConfigInput
} from './BoardConfig'

export type OngoingGameSnapshot = {
  // 新快照必须保存棋盘尺寸；可选标记仅用于兼容重构前仍驻留在内存中的 5×7 快照。
  boardConfig?: BoardConfig
  boardValues: Array<Array<number | null>>
  currentPieceValue: number | null
  nextPieceValue?: number | null
  currentPieceY: number | null
  currentColumn: number
  bonusScore: number
  highestPieceValue: number
  usedSkillsThisGame: Record<SkillKind, boolean>
}

function cloneBoardValues(boardValues: Array<Array<number | null>>) {
  return boardValues.map((row) => [...row])
}

function cloneSnapshot(snapshot: OngoingGameSnapshot, boardConfig: BoardConfig): OngoingGameSnapshot {
  return {
    ...snapshot,
    boardConfig: cloneBoardConfig(boardConfig),
    boardValues: cloneBoardValues(snapshot.boardValues),
    usedSkillsThisGame: { ...snapshot.usedSkillsThisGame }
  }
}

/**
 * 首页与玩法场景之间只传递纯数据快照，不让首页直接持有棋盘节点。
 * 模块状态会在 director.loadScene 切场景时保留，结束游戏后统一清空。
 */
export const OngoingGameSession = {
  active: false,
  boardConfig: cloneBoardConfig(DEFAULT_BOARD_CONFIG),
  snapshot: null as OngoingGameSnapshot | null,

  hasActiveGame() {
    return this.active
  },

  /**
   * 在切入玩法场景前创建一局，并确定本局棋盘尺寸。
   *
   * 示例：`beginNewGame({ columns: 3, rows: 7 })`。未传配置时保持经典 5×7，
   * 部分配置或非法字段会由 normalizeBoardConfig 安全补齐。
   */
  beginNewGame(config?: BoardConfigInput) {
    this.active = true
    this.boardConfig = normalizeBoardConfig(config)
    this.snapshot = null
  },

  getBoardConfig() {
    return cloneBoardConfig(this.boardConfig)
  },

  /**
   * 保存续局数据前同时校验配置与矩阵形状。
   *
   * 返回 false 表示快照已拒绝保存；调用方仍可安全回首页，但首页不会展示错误续局入口。
   */
  save(snapshot: OngoingGameSnapshot) {
    const sessionConfig = this.getBoardConfig()
    const candidateConfig = snapshot.boardConfig
    const snapshotConfig = candidateConfig === undefined
      ? sessionConfig
      : isValidBoardConfig(candidateConfig)
        ? cloneBoardConfig(candidateConfig)
        : null

    if (
      !snapshotConfig ||
      !areBoardConfigsEqual(snapshotConfig, sessionConfig) ||
      !isBoardMatrixCompatible(snapshot.boardValues, snapshotConfig)
    ) {
      this.finishGame()
      return false
    }

    this.active = true
    this.boardConfig = cloneBoardConfig(snapshotConfig)
    this.snapshot = cloneSnapshot(snapshot, snapshotConfig)
    return true
  },

  /**
   * 取出快照时再次验证，避免跨版本热更新或外部误写把错误尺寸带进玩法场景。
   * 旧版未携带 boardConfig 的快照只在矩阵与当前（默认 5×7）配置一致时恢复。
   */
  consumeSnapshot() {
    const snapshot = this.snapshot
    this.snapshot = null
    if (!snapshot) {
      return null
    }

    const sessionConfig = this.getBoardConfig()
    const snapshotConfig = snapshot.boardConfig === undefined
      ? sessionConfig
      : isValidBoardConfig(snapshot.boardConfig)
        ? cloneBoardConfig(snapshot.boardConfig)
        : null

    if (
      !snapshotConfig ||
      !areBoardConfigsEqual(snapshotConfig, sessionConfig) ||
      !isBoardMatrixCompatible(snapshot.boardValues, snapshotConfig)
    ) {
      // 快照损坏时只丢弃快照，仍保留玩家正在进入的关卡尺寸并从空棋盘开始。
      this.beginNewGame(sessionConfig)
      return null
    }

    this.active = true
    this.boardConfig = cloneBoardConfig(snapshotConfig)
    return cloneSnapshot(snapshot, snapshotConfig)
  },

  finishGame() {
    this.active = false
    this.boardConfig = cloneBoardConfig(DEFAULT_BOARD_CONFIG)
    this.snapshot = null
  }
}
