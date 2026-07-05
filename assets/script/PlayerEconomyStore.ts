import { sys } from 'cc'
import type { SkillCounts, SkillKind } from './SkillStock'

export type ShareRewardKind = 'coins' | 'energy'

export type EconomySnapshot = {
  energy: number
  maxEnergy: number
  coins: number
  skills: SkillCounts
}

export type RewardClaimResult = {
  claimed: boolean
  amount: number
  reason: 'claimed' | 'already-claimed' | 'energy-full'
}

export type SkillPurchaseResult = {
  purchased: boolean
  price: number
  balance: number
  reason: 'purchased' | 'insufficient-coins'
}

// 所有经济数值集中在这里，策划调参时不需要进入首页或玩法流程代码。
export const ECONOMY_CONFIG = {
  initialEnergy: 3,
  maxEnergy: 4,
  initialCoins: 99999,
  initialSkillCount: 1,
  dailyLoginCoins: 500,
  shareCoins: 200,
  shareEnergy: 1,
  gameEnergyCost: 1,
  skillPrices: {
    bomb: 500,
    hammer: 300,
    swap: 400
  } satisfies Record<SkillKind, number>
} as const

type PersistedEconomyState = EconomySnapshot & {
  version: 1
  lastDailyLoginDate: string
}

const STORAGE_KEY = 'number-garden-player-economy-v1'

/**
 * 跨场景共享的玩家经济仓库。
 *
 * 首页和玩法层只能通过公开方法完成领取、消费和购买；每次成功变更都会立即持久化，
 * 从而保证切换 home/loading/game 场景时资源和技能库存不会被组件生命周期重置。
 */
export class PlayerEconomyStore {
  private static instance: PlayerEconomyStore | null = null
  private state: PersistedEconomyState

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerEconomyStore()
    }
    return this.instance
  }

  private constructor() {
    this.state = this.loadState()
  }

  getSnapshot(): EconomySnapshot {
    return {
      energy: this.state.energy,
      maxEnergy: this.state.maxEnergy,
      coins: this.state.coins,
      skills: { ...this.state.skills }
    }
  }

  // 每个本地自然日首次进入首页领取一次金币。
  claimDailyLogin(now = new Date()): RewardClaimResult {
    const today = this.getLocalDateKey(now)
    if (this.state.lastDailyLoginDate === today) {
      return { claimed: false, amount: 0, reason: 'already-claimed' }
    }

    this.state.lastDailyLoginDate = today
    this.state.coins += ECONOMY_CONFIG.dailyLoginCoins
    this.saveState()
    return { claimed: true, amount: ECONOMY_CONFIG.dailyLoginCoins, reason: 'claimed' }
  }

  canClaimShareReward(kind: ShareRewardKind) {
    return kind !== 'energy' || this.state.energy < this.state.maxEnergy
  }

  // 分享奖励不限制每日次数；体力只受体力槽容量限制，金币每次成功分享都可领取。
  claimShareReward(kind: ShareRewardKind): RewardClaimResult {
    if (kind === 'energy' && this.state.energy >= this.state.maxEnergy) {
      return { claimed: false, amount: 0, reason: 'energy-full' }
    }

    const amount = kind === 'coins' ? ECONOMY_CONFIG.shareCoins : ECONOMY_CONFIG.shareEnergy
    if (kind === 'coins') {
      this.state.coins += amount
    } else {
      this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + amount)
    }
    this.saveState()
    return { claimed: true, amount, reason: 'claimed' }
  }

  // 开始一局和重玩都必须先成功扣除体力。
  tryConsumeEnergy(amount = ECONOMY_CONFIG.gameEnergyCost) {
    const cost = Math.max(0, Math.floor(amount))
    if (this.state.energy < cost) {
      return false
    }

    this.state.energy -= cost
    this.saveState()
    return true
  }

  hasSkill(skill: SkillKind) {
    return this.state.skills[skill] > 0
  }

  consumeSkill(skill: SkillKind) {
    if (!this.hasSkill(skill)) {
      return false
    }

    this.state.skills[skill] -= 1
    this.saveState()
    return true
  }

  purchaseSkill(skill: SkillKind): SkillPurchaseResult {
    const price = ECONOMY_CONFIG.skillPrices[skill]
    if (this.state.coins < price) {
      return {
        purchased: false,
        price,
        balance: this.state.coins,
        reason: 'insufficient-coins'
      }
    }

    this.state.coins -= price
    this.state.skills[skill] += 1
    this.saveState()
    return {
      purchased: true,
      price,
      balance: this.state.coins,
      reason: 'purchased'
    }
  }

  private createDefaultState(): PersistedEconomyState {
    return {
      version: 1,
      energy: ECONOMY_CONFIG.initialEnergy,
      maxEnergy: ECONOMY_CONFIG.maxEnergy,
      coins: ECONOMY_CONFIG.initialCoins,
      skills: {
        bomb: ECONOMY_CONFIG.initialSkillCount,
        hammer: ECONOMY_CONFIG.initialSkillCount,
        swap: ECONOMY_CONFIG.initialSkillCount
      },
      lastDailyLoginDate: ''
    }
  }

  private loadState(): PersistedEconomyState {
    const fallback = this.createDefaultState()
    try {
      const raw = sys.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return fallback
      }

      const parsed = JSON.parse(raw) as Partial<PersistedEconomyState>
      const maxEnergy = Math.max(1, Math.floor(parsed.maxEnergy ?? fallback.maxEnergy))
      return {
        version: 1,
        energy: Math.min(maxEnergy, Math.max(0, Math.floor(parsed.energy ?? fallback.energy))),
        maxEnergy,
        coins: Math.max(0, Math.floor(parsed.coins ?? fallback.coins)),
        skills: {
          bomb: Math.max(0, Math.floor(parsed.skills?.bomb ?? fallback.skills.bomb)),
          hammer: Math.max(0, Math.floor(parsed.skills?.hammer ?? fallback.skills.hammer)),
          swap: Math.max(0, Math.floor(parsed.skills?.swap ?? fallback.skills.swap))
        },
        lastDailyLoginDate: parsed.lastDailyLoginDate ?? ''
      }
    } catch (error) {
      console.warn('玩家经济存档读取失败，已使用默认值', error)
      return fallback
    }
  }

  private saveState() {
    try {
      sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (error) {
      console.warn('玩家经济存档写入失败', error)
    }
  }

  // 使用本地日期而非 UTC，保证“每日”切换符合玩家所在时区的自然日。
  private getLocalDateKey(date: Date) {
    const year = date.getFullYear()
    const monthValue = date.getMonth() + 1
    const dayValue = date.getDate()
    const month = monthValue < 10 ? `0${monthValue}` : `${monthValue}`
    const day = dayValue < 10 ? `0${dayValue}` : `${dayValue}`
    return `${year}-${month}-${day}`
  }
}
