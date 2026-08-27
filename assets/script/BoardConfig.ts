/**
 * 一局游戏使用的棋盘尺寸。
 *
 * columns 表示从左到右的列数，rows 表示从下到上的行数；
 * 两个字段都必须是处于当前画布支持范围内的安全整数。
 */
export type BoardConfig = {
  columns: number
  rows: number
}

export type BoardConfigInput = Partial<BoardConfig> | null | undefined

export const DEFAULT_BOARD_CONFIG: Readonly<BoardConfig> = Object.freeze({
  columns: 5,
  rows: 7
})

/**
 * 当前 750×1334 玩法布局可完整容纳的棋盘范围。
 *
 * 六列的外框宽度为 748，七行的内区高度为 854；继续增大会遮挡 HUD 或技能栏。
 * 小于默认尺寸的关卡（例如 3×7）则保持原棋子尺寸并自动居中。
 */
export const BOARD_CONFIG_LIMITS = Object.freeze({
  minColumns: 1,
  maxColumns: 6,
  minRows: 1,
  maxRows: 7
})

// 棋盘尺寸会参与数组分配，必须排除小数、NaN、Infinity 和非正数。
export function isPositiveBoardDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function isSupportedBoardColumnCount(value: unknown): value is number {
  return isPositiveBoardDimension(value)
    && value >= BOARD_CONFIG_LIMITS.minColumns
    && value <= BOARD_CONFIG_LIMITS.maxColumns
}

export function isSupportedBoardRowCount(value: unknown): value is number {
  return isPositiveBoardDimension(value)
    && value >= BOARD_CONFIG_LIMITS.minRows
    && value <= BOARD_CONFIG_LIMITS.maxRows
}

/** 严格校验一份完整棋盘配置，主要用于检查续局快照。 */
export function isValidBoardConfig(value: unknown): value is BoardConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<BoardConfig>
  return isSupportedBoardColumnCount(candidate.columns) && isSupportedBoardRowCount(candidate.rows)
}

/**
 * 把关卡提供的部分配置补齐为可安全使用的完整配置。
 *
 * 关卡只覆盖列数时会沿用默认行数；某个字段非法时只回退该字段，
 * 从而避免一个错误值让另一项合法配置也失效。
 */
export function normalizeBoardConfig(
  input?: BoardConfigInput,
  fallback: Readonly<BoardConfig> = DEFAULT_BOARD_CONFIG
): BoardConfig {
  const safeFallback = isValidBoardConfig(fallback) ? fallback : DEFAULT_BOARD_CONFIG
  return {
    columns: isSupportedBoardColumnCount(input?.columns) ? input.columns : safeFallback.columns,
    rows: isSupportedBoardRowCount(input?.rows) ? input.rows : safeFallback.rows
  }
}

export function cloneBoardConfig(config: Readonly<BoardConfig>): BoardConfig {
  return {
    columns: config.columns,
    rows: config.rows
  }
}

export function areBoardConfigsEqual(left: Readonly<BoardConfig>, right: Readonly<BoardConfig>) {
  return left.columns === right.columns && left.rows === right.rows
}

/**
 * 验证快照矩阵是否与配置完全一致。
 *
 * 使用严格行列数而不是截断/补齐，防止把 5×7 快照误恢复到 3×7 棋盘后
 * 静默丢失棋子，或让多余列游离在玩法边界之外。
 */
export function isBoardMatrixCompatible(boardValues: unknown, config: Readonly<BoardConfig>) {
  if (!Array.isArray(boardValues) || boardValues.length !== config.rows) {
    return false
  }

  return boardValues.every((row) => Array.isArray(row) && row.length === config.columns)
}
