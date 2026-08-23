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
  energyFilled?: number
}

export type SkillPurchaseResult = {
  purchased: boolean
  price: number
  balance: number
  reason: 'purchased' | 'insufficient-coins' | 'max-reached'
}

// 所有经济数值集中在这里，策划调参时不需要进入首页或玩法流程代码。
export const ECONOMY_CONFIG = {
  initialEnergy: 10,
  maxEnergy: 10,
  initialCoins: 99999,
  initialSkillCount: 1,
  maxSkillCount: 9,
  dailyLoginCoins: 500,
  shareCoins: 200,
  shareEnergy: 1,
  energyRecoverySeconds: 5 * 60,
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
  lastEnergyRecoveryAtMs: number
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
    this.syncEnergyRecovery()
    return {
      energy: this.state.energy,
      maxEnergy: this.state.maxEnergy,
      coins: this.state.coins,
      skills: { ...this.state.skills }
    }
  }

  // 每个本地自然日首次进入首页领取金币，并把体力补满。
  claimDailyLogin(now = new Date()): RewardClaimResult {
    this.syncEnergyRecovery(now.getTime())
    const today = this.getLocalDateKey(now)
    if (this.state.lastDailyLoginDate === today) {
      return { claimed: false, amount: 0, reason: 'already-claimed' }
    }

    const energyBeforeFill = this.state.energy
    this.state.lastDailyLoginDate = today
    this.state.coins += ECONOMY_CONFIG.dailyLoginCoins
    this.state.energy = this.state.maxEnergy
    this.state.lastEnergyRecoveryAtMs = now.getTime()
    this.saveState()
    return {
      claimed: true,
      amount: ECONOMY_CONFIG.dailyLoginCoins,
      reason: 'claimed',
      energyFilled: Math.max(0, this.state.energy - energyBeforeFill)
    }
  }

  canClaimShareReward(kind: ShareRewardKind) {
    this.syncEnergyRecovery()
    return kind !== 'energy' || this.state.energy < this.state.maxEnergy
  }

  // 分享奖励不限制每日次数；体力只受体力槽容量限制，金币每次成功分享都可领取。
  claimShareReward(kind: ShareRewardKind): RewardClaimResult {
    this.syncEnergyRecovery()
    if (kind === 'energy' && this.state.energy >= this.state.maxEnergy) {
      return { claimed: false, amount: 0, reason: 'energy-full' }
    }

    const amount = kind === 'coins' ? ECONOMY_CONFIG.shareCoins : ECONOMY_CONFIG.shareEnergy
    if (kind === 'coins') {
      this.state.coins += amount
    } else {
      this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + amount)
      if (this.state.energy >= this.state.maxEnergy) {
        this.state.lastEnergyRecoveryAtMs = Date.now()
      }
    }
    this.saveState()
    return { claimed: true, amount, reason: 'claimed' }
  }

  // 单局结算金币由玩法层计算，这里只负责安全入账和持久化。
  addCoins(amount: number) {
    const coins = Math.max(0, Math.floor(amount))
    if (coins <= 0) {
      return {
        added: 0,
        balance: this.state.coins
      }
    }

    this.state.coins += coins
    this.saveState()
    return {
      added: coins,
      balance: this.state.coins
    }
  }

  // 开始一局和重玩都必须先成功扣除体力。
  tryConsumeEnergy(amount = ECONOMY_CONFIG.gameEnergyCost) {
    this.syncEnergyRecovery()
    const cost = Math.max(0, Math.floor(amount))
    if (this.state.energy < cost) {
      return false
    }

    this.state.energy -= cost
    if (this.state.energy < this.state.maxEnergy) {
      this.state.lastEnergyRecoveryAtMs = Date.now()
    }
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
    if (this.state.skills[skill] >= ECONOMY_CONFIG.maxSkillCount) {
      return {
        purchased: false,
        price,
        balance: this.state.coins,
        reason: 'max-reached'
      }
    }

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
      lastDailyLoginDate: '',
      lastEnergyRecoveryAtMs: Date.now()
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
      const maxEnergy = ECONOMY_CONFIG.maxEnergy
      return {
        version: 1,
        energy: Math.min(maxEnergy, Math.max(0, Math.floor(parsed.energy ?? fallback.energy))),
        maxEnergy,
        coins: Math.max(0, Math.floor(parsed.coins ?? fallback.coins)),
        skills: {
          bomb: this.clampSkillCount(parsed.skills?.bomb ?? fallback.skills.bomb),
          hammer: this.clampSkillCount(parsed.skills?.hammer ?? fallback.skills.hammer),
          swap: this.clampSkillCount(parsed.skills?.swap ?? fallback.skills.swap)
        },
        lastDailyLoginDate: parsed.lastDailyLoginDate ?? '',
        lastEnergyRecoveryAtMs: this.normalizeRecoveryTime(parsed.lastEnergyRecoveryAtMs)
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

  private clampSkillCount(count: number) {
    return Math.min(ECONOMY_CONFIG.maxSkillCount, Math.max(0, Math.floor(count)))
  }

  /**
   * 按自然时间恢复体力。
   *
   * 这里不依赖首页定时器；任何读取、消费或领取体力的入口都会先同步一次，
   * 保证切场景或重新打开游戏后也能得到正确体力。
   */
  private syncEnergyRecovery(nowMs = Date.now()) {
    const intervalMs = ECONOMY_CONFIG.energyRecoverySeconds * 1000
    const maxEnergy = ECONOMY_CONFIG.maxEnergy
    const previousEnergy = this.state.energy
    const previousMaxEnergy = this.state.maxEnergy
    this.state.maxEnergy = maxEnergy

    if (previousEnergy >= maxEnergy) {
      this.state.energy = maxEnergy
      if (previousEnergy !== this.state.energy || previousMaxEnergy !== maxEnergy) {
        this.saveState()
      }
      return
    }

    const lastRecoveryAtMs = this.normalizeRecoveryTime(this.state.lastEnergyRecoveryAtMs, nowMs)
    const elapsedMs = Math.max(0, nowMs - lastRecoveryAtMs)
    const recovered = Math.floor(elapsedMs / intervalMs)
    if (recovered <= 0) {
      this.state.lastEnergyRecoveryAtMs = lastRecoveryAtMs
      if (previousMaxEnergy !== maxEnergy) {
        this.saveState()
      }
      return
    }

    this.state.energy = Math.min(maxEnergy, this.state.energy + recovered)
    this.state.lastEnergyRecoveryAtMs = this.state.energy >= maxEnergy
      ? nowMs
      : lastRecoveryAtMs + recovered * intervalMs
    this.saveState()
  }

  private normalizeRecoveryTime(value: unknown, fallback = Date.now()) {
    const time = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
    return Math.max(0, time)
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
