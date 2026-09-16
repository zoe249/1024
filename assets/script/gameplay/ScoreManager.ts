import { PieceController } from './PieceController'

type BoardCell = PieceController | null

export type ScoreRewardEvent = {
  source: 'merge'
  amount: number
  resultValue: number
  consumedCount: number
  chainDepth: number
}

// 分数规则集中管理，PlayController 只需要在合并和重开时通知它。
export class ScoreManager {
  private bonusScore = 0
  private highestPieceValue = 0

  reset() {
    this.bonusScore = 0
    this.highestPieceValue = 0
  }

  // 从跨场景快照恢复累计奖励和历史最高值，续局时不重新计算已发生的合并奖励。
  restore(bonusScore: number, highestPieceValue: number) {
    this.bonusScore = Math.max(0, Math.floor(bonusScore))
    this.highestPieceValue = Math.max(0, Math.floor(highestPieceValue))
  }

  getBonusScore() {
    return this.bonusScore
  }

  getHighestPieceValue() {
    return this.highestPieceValue
  }

  // 当前分数定义为棋盘内所有已落地棋子的数字总和，不包含仍在下落中的当前棋子。
  getBoardScore(board: BoardCell[][]) {
    let score = 0
    for (const row of board) {
      for (const piece of row) {
        if (!piece) {
          continue
        }
        score += piece.getValue()
      }
    }

    return score
  }

  getTotalScore(board: BoardCell[][]) {
    return this.getBoardScore(board) + this.bonusScore
  }

  // 统一维护本局历史最高值，避免技能移除最高棋子后结算数字回落。
  updateHighestPieceValue(value: number) {
    this.highestPieceValue = Math.max(this.highestPieceValue, value)
  }

  /**
   * 构造一次合并奖励事件。
   *
   * 奖励分在动画开始前就可以结算，所以这里把结果值、吞并数量和连锁深度都记录下来，
   * 后续如果要接入日志、活动倍率或上报，也能复用同一份事件结构。
   *
   * @param nextValue 合并后锚点棋子的结果数字。
   * @param consumedCount 本次被吞并的棋子数量。
   * @param chainDepth 当前连锁深度。
   * @returns 可累计到奖励分里的合并奖励事件。
   */
  buildMergeReward(nextValue: number, consumedCount: number, chainDepth: number): ScoreRewardEvent {
    const amount = this.calculateMergeRewardAmount(nextValue, consumedCount, chainDepth)
    return {
      source: 'merge',
      amount,
      resultValue: nextValue,
      consumedCount,
      chainDepth
    }
  }

  /**
   * 累计一组奖励分事件。
   *
   * 当前只累加奖励分数，返回值用于告诉调用方是否需要刷新 UI。
   * 之后如果增加日志、埋点或临时活动加成，也应集中在这里扩展。
   *
   * @param rewards 待累计的奖励事件列表。
   * @returns 是否发生了分数变化。
   */
  applyScoreRewards(rewards: ScoreRewardEvent[]) {
    if (rewards.length === 0) {
      return false
    }

    for (const reward of rewards) {
      this.bonusScore += reward.amount
    }
    return true
  }

  /**
   * 计算合并奖励分。
   *
   * 当前规则为“结果值 x 消除倍率”，消除棋子越多倍率越高。
   * 连锁深度参数先保留在公式入口中，方便后续活动或模式扩展时直接叠加。
   *
   * @param nextValue 合并后锚点棋子的结果数字。
   * @param consumedCount 本次被吞并的棋子数量。
   * @param chainDepth 当前连锁深度。
   * @returns 本次合并产生的奖励分。
   */
  private calculateMergeRewardAmount(nextValue: number, consumedCount: number, chainDepth: number) {
    const clearMultiplier = Math.max(1, consumedCount)
    // 连锁深度先单独保留入口，当前版本不叠加倍率，后续活动或模式扩展时直接在这里继续乘即可。
    const chainMultiplier = 1 + Math.max(0, chainDepth - 1) * 0
    return Math.floor(nextValue * clearMultiplier * chainMultiplier)
  }
}
