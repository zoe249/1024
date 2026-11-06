import { sys } from 'cc'
import { getLevel, LEVELS } from './LevelCatalog'
import { copyMatrix, createLevelState, goalComplete, landingRow, stableBoard, validMatrix, valueAt, type LevelState } from './LevelRules'

const KEY = 'number-garden-level-progress-v1'
type Progress = { version: 1; unlocked: number; checkpoint: LevelState | null }

// 首版只保存设备本地进度，不写入无尽模式续局、经济或云同步队列。
export class LevelProgressStore {
  private static read(): Progress {
    try {
      const value = JSON.parse(sys.localStorage.getItem(KEY) || 'null')
      if (value?.version === 1 && Number.isInteger(value.unlocked) && value.unlocked >= 1 && value.unlocked <= LEVELS.length) return value
    } catch (error) { console.warn('读取闯关进度失败', error) }
    return { version: 1, unlocked: 1, checkpoint: null }
  }

  static currentLevelId() { return this.read().unlocked }

  static restore(levelId: number): LevelState {
    const level = getLevel(levelId)!
    const saved = this.read().checkpoint
    if (saved && saved.levelId === levelId && validMatrix(saved.board) && validMatrix(saved.ice, true)
      && Array.isArray(saved.collected) && saved.collected.length === level.goals.length
      && saved.collected.every((count, i) => Number.isInteger(count) && count >= 0 && count <= level.goals[i].count)
      && Number.isSafeInteger(saved.cursor) && saved.cursor >= 0 && saved.current === valueAt(level, saved.cursor)
      && saved.next === valueAt(level, saved.cursor + 1) && (saved.status === 'playing' || saved.status === 'lost')
      && stableBoard(saved.board) && !goalComplete(level, saved) && (saved.status === 'lost') === [0, 1, 2, 3, 4].every(c => landingRow(saved.board, c) < 0)
      && saved.board.every((row, r) => row.every((cell, c) => (cell === -1) === (level.board[r][c] === -1)
        && saved.ice[r][c] <= level.ice[r][c]))) {
      return { ...saved, board: copyMatrix(saved.board), ice: copyMatrix(saved.ice), collected: saved.collected.slice() }
    }
    return createLevelState(level)
  }

  static save(state: LevelState) {
    const progress = this.read()
    if (state.status === 'won') {
      progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, state.levelId + 1))
      progress.checkpoint = null
    } else progress.checkpoint = state
    try { sys.localStorage.setItem(KEY, JSON.stringify(progress)) }
    catch (error) { console.warn('保存闯关进度失败', error) }
  }
}
