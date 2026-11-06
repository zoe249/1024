import { emptyMatrix, validateLevel, type LevelDefinition } from './LevelRules'

function make(id: number, title: string, hint: string, rows: number[][], goals: LevelDefinition['goals'], sequence: number[], frozen: number[][] = []): LevelDefinition {
  const board = emptyMatrix(), ice = emptyMatrix()
  rows.forEach((row, r) => row.forEach((value, c) => { board[r][c] = value }))
  frozen.forEach(([row, column]) => { ice[row][column] = 1 })
  const level = { id, title, hint, board, ice, goals, sequence }
  validateLevel(level)
  return level
}

// 三个入门关仅包含已确认的收集、破冰目标；出子不受操作次数限制。
export const LEVELS: ReadonlyArray<LevelDefinition> = [
  make(1, '收集花园', '合成目标数字，填满上方收集槽',
    [[2, 4, 8, 16, 4]], [{ value: 8, count: 2 }, { value: 32, count: 1 }], [2, 4, 8, 4, 2, 8, 16, 4]),
  make(2, '冰封草地', '在冰封位置参与合成，清除全部冰层',
    [[2, 4, 8, 4, 2], [4, 8, 16, 8, 4]], [], [4, 8, 16, 8, 4, 2], [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]),
  make(3, '林间破冰', '绕开固定木块，在两侧布置连锁',
    [[-1, 2, 4, 8, -1], [2, 4, 8, 4, 2], [4, 8, 16, 8, 4]], [], [4, 8, 16, 8, 4, 2], [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [1, 2]])
]

export function getLevel(id: number) { return LEVELS.find(level => level.id === id) ?? null }
