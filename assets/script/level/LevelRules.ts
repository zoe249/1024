// 闯关规则完全独立于无尽模式；行从下向上，-1 为固定木块。
export const LEVEL_COLUMNS = 5
export const LEVEL_ROWS = 7
export type Cell = { row: number; column: number }
export type Matrix = number[][]
export type LevelDefinition = {
  id: number; title: string; hint: string; board: Matrix; ice: Matrix
  goals: { value: number; count: number }[]; sequence: number[]
}
export type LevelState = {
  levelId: number; board: Matrix; ice: Matrix; collected: number[]
  cursor: number; current: number; next: number; status: 'playing' | 'won' | 'lost'
}
export type LevelEvent =
  | { kind: 'drop'; cell: Cell; value: number }
  | { kind: 'merge'; members: Cell[]; anchor: Cell; value: number; broken: Cell[]; collected: number[]; chainDepth: number; batch: number }
  | { kind: 'gravity'; moves: { from: Cell; to: Cell }[] }

export const emptyMatrix = (): Matrix => Array.from({ length: LEVEL_ROWS }, () => Array(LEVEL_COLUMNS).fill(0))
export const copyMatrix = (matrix: Matrix): Matrix => matrix.map(row => row.slice())
const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.column === b.column
export const isNumberValue = (value: number) => Number.isSafeInteger(value) && value >= 2 && Number.isInteger(Math.log2(value))
const inside = (row: number, column: number) => row >= 0 && row < LEVEL_ROWS && column >= 0 && column < LEVEL_COLUMNS

// 关卡使用固定出子序列，游标只在有效落子并完整结算后推进。
export const valueAt = (level: LevelDefinition, cursor: number) => level.sequence[cursor % level.sequence.length]

export function landingRow(board: Matrix, column: number) {
  if (!Number.isInteger(column) || column < 0 || column >= LEVEL_COLUMNS) return -1
  for (let row = LEVEL_ROWS - 1; row >= 0; row--) {
    if (board[row][column] !== 0) return row + 1 < LEVEL_ROWS ? row + 1 : -1
  }
  return 0
}

export function createLevelState(level: LevelDefinition): LevelState {
  return { levelId: level.id, board: copyMatrix(level.board), ice: copyMatrix(level.ice),
    collected: level.goals.map(() => 0), cursor: 0, current: valueAt(level, 0), next: valueAt(level, 1), status: 'playing' }
}

function component(board: Matrix, start: Cell): Cell[] {
  const value = board[start.row][start.column]
  if (value <= 0) return []
  const cells = [start]
  const seen = emptyMatrix()
  seen[start.row][start.column] = 1
  for (let i = 0; i < cells.length; i++) {
    const { row, column } = cells[i]
    for (const [r, c] of [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]) {
      if (inside(r, c) && !seen[r][c] && board[r][c] === value) {
        seen[r][c] = 1; cells.push({ row: r, column: c })
      }
    }
  }
  return cells
}

/** 木块把列切为独立重力区间，棋子只能落在各区间底部。 */
function gravity(board: Matrix, columns: number[], events: LevelEvent[]) {
  const moves: { from: Cell; to: Cell }[] = []
  for (const column of columns) {
    let write = 0
    for (let row = 0; row < LEVEL_ROWS; row++) {
      const value = board[row][column]
      if (value === -1) { write = row + 1; continue }
      if (!value) continue
      if (write !== row) {
        board[write][column] = value; board[row][column] = 0
        moves.push({ from: { row, column }, to: { row: write, column } })
      }
      write++
    }
  }
  if (moves.length) events.push({ kind: 'gravity', moves })
  return moves
}

export function goalComplete(level: LevelDefinition, state: LevelState) {
  return level.goals.length > 0
    ? level.goals.every((goal, i) => state.collected[i] >= goal.count)
    : state.ice.every(row => row.every(value => value === 0))
}

/** 先落点局部连锁，再全盘重力及连通块扫描；动画只消费事件，不重算结果。 */
export function dropInColumn(level: LevelDefinition, previous: LevelState, column: number): { state: LevelState; events: LevelEvent[] } | null {
  const row = landingRow(previous.board, column)
  if (previous.status !== 'playing' || row < 0) return null
  const state: LevelState = { ...previous, board: copyMatrix(previous.board), ice: copyMatrix(previous.ice), collected: previous.collected.slice() }
  const events: LevelEvent[] = [{ kind: 'drop', cell: { row, column }, value: state.current }]
  state.board[row][column] = state.current
  let chainDepth = 1, batch = 0
  const merge = (members: Cell[], anchor: Cell) => {
    const value = state.board[anchor.row][anchor.column] * 2 ** (members.length - 1)
    const broken: Cell[] = []
    for (const cell of members) {
      state.board[cell.row][cell.column] = 0
      if (state.ice[cell.row][cell.column]) { state.ice[cell.row][cell.column] = 0; broken.push(cell) }
    }
    state.board[anchor.row][anchor.column] = value
    level.goals.forEach((goal, i) => { if (goal.value === value) state.collected[i] = Math.min(goal.count, state.collected[i] + 1) })
    events.push({ kind: 'merge', members, anchor: { ...anchor }, value, broken, collected: state.collected.slice(), chainDepth, batch })
  }
  let anchor = { row, column }
  while (true) {
    const members = component(state.board, anchor)
    if (members.length < 2) break
    merge(members, anchor)
    chainDepth++; batch++
    const columns = members.map(cell => cell.column).filter((value, i, all) => all.indexOf(value) === i)
    const moves = gravity(state.board, columns, events)
    const moved = moves.find(move => sameCell(move.from, anchor))
    if (moved) anchor = { ...moved.to }
  }
  while (true) {
    gravity(state.board, [0, 1, 2, 3, 4], events)
    const groups: Cell[][] = []
    const visited = emptyMatrix()
    for (let r = 0; r < LEVEL_ROWS; r++) for (let c = 0; c < LEVEL_COLUMNS; c++) {
      if (visited[r][c] || state.board[r][c] <= 0) continue
      const members = component(state.board, { row: r, column: c })
      members.forEach(cell => { visited[cell.row][cell.column] = 1 })
      if (members.length > 1) groups.push(members)
    }
    if (!groups.length) break
    for (const members of groups) merge(members, members[0])
    chainDepth++; batch++
  }
  state.status = goalComplete(level, state) ? 'won'
    : [0, 1, 2, 3, 4].every(c => landingRow(state.board, c) < 0) ? 'lost' : 'playing'
  if (state.status === 'playing') {
    state.cursor++; state.current = state.next; state.next = valueAt(level, state.cursor + 1)
  }
  return { state, events }
}

export function validMatrix(value: unknown, ice = false): value is Matrix {
  return Array.isArray(value) && value.length === LEVEL_ROWS && value.every(row => Array.isArray(row)
    && row.length === LEVEL_COLUMNS && row.every(cell => ice ? cell === 0 || cell === 1 : cell === 0 || cell === -1 || isNumberValue(cell)))
}

export function stableBoard(board: Matrix) {
  for (let row = 0; row < LEVEL_ROWS; row++) for (let column = 0; column < LEVEL_COLUMNS; column++) {
    if (board[row][column] > 0 && ((row > 0 && !board[row - 1][column]) || component(board, { row, column }).length > 1)) return false
  }
  return true
}

export function validateLevel(level: LevelDefinition) {
  if (!validMatrix(level.board) || !validMatrix(level.ice, true) || !level.sequence.length || !level.sequence.every(isNumberValue)) throw new Error('关卡配置不合法')
  if (level.goals.length > 2 || level.goals.some(g => !isNumberValue(g.value) || !Number.isInteger(g.count) || g.count < 1)
    || level.goals.some((g, i) => level.goals.findIndex(other => other.value === g.value) !== i)) throw new Error('收集目标不合法')
  if (!level.goals.length && level.ice.every(row => row.every(v => !v))) throw new Error('破冰关缺少目标')
  if (level.goals.length && level.ice.some(row => row.some(Boolean))) throw new Error('首版不混合收集与破冰目标')
  if (!stableBoard(level.board)) throw new Error('初始棋盘必须稳定')
  for (let row = 0; row < LEVEL_ROWS; row++) for (let column = 0; column < LEVEL_COLUMNS; column++) {
    if (level.ice[row][column] && level.board[row][column] <= 0) throw new Error('冰封位置必须有数字块')
  }
}
