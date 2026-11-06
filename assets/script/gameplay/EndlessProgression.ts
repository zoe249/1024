import { cloneBoardConfig, isValidBoardConfig, type BoardConfig } from './BoardConfig'

export type StageChoice = 'diagonal' | 'wildcard' | 'shuffle'
export type PieceKind = 'normal' | 'wildcard'

/** 仅保存本局规则和进度，不能持有节点、组件或动画对象。 */
export type EndlessProgression = {
  version: 1
  phase: 1 | 2
  target: number
  wildcardInterval: number
  baseConfig: BoardConfig
  expandedConfig: BoardConfig
  highestMergeValue: number
  choice: StageChoice | null
  choiceApplied: boolean
  spawnedSinceChoice: number
}

export const STAGE_CHOICE_NAMES: Record<StageChoice, string> = {
  diagonal: '斜向合并', wildcard: '万能来客', shuffle: '打乱'
}

export function isStageChoice(value: unknown): value is StageChoice {
  return value === 'diagonal' || value === 'wildcard' || value === 'shuffle'
}

export function createProgression(config: BoardConfig, target = 1024, interval = 6): EndlessProgression {
  return {
    version: 1, phase: 1,
    target: Number.isSafeInteger(target) && target >= 2 && Number.isInteger(Math.log2(target)) ? target : 1024,
    wildcardInterval: Number.isSafeInteger(interval) && interval >= 2 ? interval : 6,
    baseConfig: cloneBoardConfig(config),
    expandedConfig: { columns: config.columns + 2, rows: config.rows + 1 },
    highestMergeValue: 0, choice: null, choiceApplied: false, spawnedSinceChoice: 0
  }
}

export function cloneProgression(state: EndlessProgression): EndlessProgression {
  return { ...state, baseConfig: cloneBoardConfig(state.baseConfig), expandedConfig: cloneBoardConfig(state.expandedConfig) }
}

export function isValidProgression(state: unknown, config: BoardConfig): state is EndlessProgression {
  if (!state || typeof state !== 'object') return false
  const value = state as EndlessProgression
  if (value.version !== 1 || (value.phase !== 1 && value.phase !== 2)
    || !isValidBoardConfig(value.baseConfig) || !value.expandedConfig
    || !Number.isSafeInteger(value.expandedConfig.columns) || !Number.isSafeInteger(value.expandedConfig.rows)
    || (value.phase === 2 && !isValidBoardConfig(value.expandedConfig))
    || value.expandedConfig.columns !== value.baseConfig.columns + 2
    || value.expandedConfig.rows !== value.baseConfig.rows + 1
    || !Number.isSafeInteger(value.target) || value.target < 2 || !Number.isInteger(Math.log2(value.target))
    || !Number.isSafeInteger(value.wildcardInterval) || value.wildcardInterval < 2
    || !Number.isSafeInteger(value.highestMergeValue) || value.highestMergeValue < 0
    || !Number.isSafeInteger(value.spawnedSinceChoice) || value.spawnedSinceChoice < 0
    || (value.choice !== null && !isStageChoice(value.choice)) || typeof value.choiceApplied !== 'boolean') return false
  const expected = value.phase === 1 ? value.baseConfig : value.expandedConfig
  return config.columns === expected.columns && config.rows === expected.rows
    && (value.phase === 2 || (value.choice === null && !value.choiceApplied && value.spawnedSinceChoice === 0))
    && (!value.choiceApplied || value.choice !== null)
}

export function shouldPromote(state: EndlessProgression) {
  return state.phase === 1 && state.highestMergeValue >= state.target && isValidBoardConfig(state.expandedConfig)
}

export function nextPieceKind(state: EndlessProgression): PieceKind {
  return state.choice === 'wildcard' && (state.spawnedSinceChoice + 1) % state.wildcardInterval === 0
    ? 'wildcard' : 'normal'
}

const FOUR_NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const
const EIGHT_NEIGHBORS = [...FOUR_NEIGHBORS, [-1, -1], [-1, 1], [1, -1], [1, 1]] as const

export function mergeNeighbors(choice: StageChoice | null) {
  return choice === 'diagonal' ? EIGHT_NEIGHBORS : FOUR_NEIGHBORS
}

export function canShuffle<T>(board: (T | null)[][], valueOf: (piece: T) => number) {
  if ((board[0]?.length ?? 0) < 2) return false
  let first: number | null = null
  for (const row of board) for (const piece of row) {
    if (piece === null) continue
    const value = valueOf(piece)
    if (first === null) first = value
    else if (value !== first) return true
  }
  return false
}

/** 落点和播放顺序同时固定；逐颗从未满列中随机选择，只兜底避免全部落到一列。 */
export function shuffleBoard<T>(board: (T | null)[][], valueOf: (piece: T) => number, random = Math.random): {
  board: (T | null)[][]; drops: { row: number; column: number }[]
} | null {
  if (!canShuffle(board, valueOf)) return null
  const pieces: T[] = []
  for (const row of board) for (const piece of row) if (piece !== null) pieces.push(piece)
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))))
    const piece = pieces[i]; pieces[i] = pieces[j]; pieces[j] = piece
  }
  const heights = Array.from({ length: board[0].length }, () => 0)
  const drops: { row: number; column: number }[] = []
  const result = board.map(row => row.map(() => null as T | null))
  pieces.forEach((piece, i) => {
    let columns = heights.map((_, column) => column).filter(column => heights[column] < board.length)
    if (i === pieces.length - 1 && heights.filter(height => height > 0).length === 1) {
      columns = columns.filter(column => heights[column] === 0)
    }
    const index = Math.max(0, Math.min(columns.length - 1, Math.floor(random() * columns.length)))
    const column = columns[index], row = heights[column]++
    result[row][column] = piece
    drops.push({ row, column })
  })
  if (result.every((row, r) => row.every((piece, c) =>
    piece === null ? board[r][c] === null : board[r][c] !== null && valueOf(piece) === valueOf(board[r][c]!)
  ))) {
    const different = pieces.findIndex(piece => valueOf(piece) !== valueOf(pieces[0]))
    const first = drops[0], other = drops[different]
    const piece = result[first.row][first.column]
    result[first.row][first.column] = result[other.row][other.column]; result[other.row][other.column] = piece
  }
  return { board: result, drops }
}
