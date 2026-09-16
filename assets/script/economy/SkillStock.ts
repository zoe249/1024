export type SkillKind = 'bomb' | 'hammer' | 'swap'

export type SkillCounts = Record<SkillKind, number>

// 技能库存只关心次数，不关心技能动画或棋盘结算，方便玩法控制器保持轻量。
export class SkillStock {
  private counts: SkillCounts

  constructor(private readonly initialCount: number) {
    this.counts = this.createInitialCounts()
  }

  // 每局开始时统一重置技能库存，保证炸弹、锤子、交换都从默认次数开始。
  reset() {
    this.counts = this.createInitialCounts()
  }

  // 技能只有在真正施放成功后才扣次数，取消技能或无效目标不会消耗库存。
  consume(skill: SkillKind) {
    this.counts[skill] = Math.max(0, this.counts[skill] - 1)
  }

  has(skill: SkillKind) {
    return this.counts[skill] > 0
  }

  // 返回一份拷贝，避免 UI 或外部调用方误改库存内部状态。
  toUiState(): SkillCounts {
    return {
      bomb: this.counts.bomb,
      hammer: this.counts.hammer,
      swap: this.counts.swap
    }
  }

  private createInitialCounts(): SkillCounts {
    return {
      bomb: this.initialCount,
      hammer: this.initialCount,
      swap: this.initialCount
    }
  }
}
