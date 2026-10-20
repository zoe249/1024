import { ApiError, type LeaderboardEntryDto, type LeaderboardTargetResponse } from '../api/GameApiClient'
import { PlayerSessionStore } from '../auth/PlayerSessionStore'
import { PlayerProfileStore, type PlayerProfileSnapshot } from '../../profile/PlayerProfileStore'
import type { PlayerAvatar } from '../../profile/AvatarCatalog'

export type OvertakeView = {
  kind: 'self' | 'rival'
  key: string
  name: string
  value: number
  avatar: PlayerAvatar
  revision: number
  animate: boolean
} | { kind: 'top'; key: 'top'; revision: number; animate: boolean } | null

type Cache = { account: string; at: number; baseline: number; data: LeaderboardTargetResponse }
const MIN_INTERVAL = 1500
const CACHE_TTL = 5 * 60_000

/** 本局仅持有纯数据；进度更新负责补查，resolveOvertake 不发请求。 */
export class OvertakeRivalStore {
  private static instance: OvertakeRivalStore | null = null
  private readonly session = PlayerSessionStore.getInstance()
  private cache: Cache | null = null
  private generation = 0
  private revision = 0
  private account: string | null = null
  private listener: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = false
  private attempts = 0
  private failures = 0
  private retryAt = 0
  private lastRequestAt = -Infinity
  private score = 0
  private selfBest = 0
  private self: LeaderboardEntryDto | null = null
  private entries: LeaderboardEntryDto[] = []
  private exhausted = false
  private enabled = false
  private ready = false
  private view: OvertakeView = null

  static getInstance() {
    if (!this.instance) this.instance = new OvertakeRivalStore()
    return this.instance
  }

  begin(score: number, listener: () => void) {
    this.end()
    this.listener = listener
    this.score = score
    this.attempts = this.failures = 0
    this.retryAt = 0
    this.selfBest = 0
    this.self = null
    this.entries = []
    this.exhausted = this.enabled = this.ready = false
    this.view = null
    const state = this.session.getSnapshot()
    this.account = state.status === 'authenticated' ? state.playerId : null
    if (!this.account) return
    const generation = this.generation
    const profiles = PlayerProfileStore.getInstance()
    const cachedProfile = profiles.getSnapshot()
    const useProfile = (profile: PlayerProfileSnapshot) => {
      if (!this.isCurrent(generation)) return
      this.selfBest = profile.highestScore
      if (this.selfBest <= 0) return
      this.self = { ...profile, value: this.selfBest, rank: null, isSelf: true }
      this.enabled = true
      const cache = this.cache
      if (cache && cache.account === this.account && Date.now() - cache.at < CACHE_TTL && cache.baseline <= this.selfBest) {
        this.apply(cache.data, false)
      } else this.request()
    }
    void profiles.load(true).then(useProfile).catch(() => {
      if (cachedProfile?.playerId === this.account && this.cache?.account === this.account && Date.now() - this.cache.at < CACHE_TTL) useProfile(cachedProfile)
    })
  }

  updateScore(score: number) {
    this.score = Math.max(0, Math.floor(score))
    if (!this.isCurrent(this.generation)) { this.view = null; return }
    if (!this.ready) return
    this.reconcile(true)
    if (this.needsPage()) this.request()
  }

  resolveOvertake(_score: number): OvertakeView { return this.view }

  end() {
    this.generation += 1
    this.listener = null
    this.account = null
    this.inFlight = false
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }

  clear() { this.end(); this.cache = null; this.view = null }

  private isCurrent(generation: number) {
    const state = this.session.getSnapshot()
    return generation === this.generation && this.account !== null && state.status === 'authenticated' && state.playerId === this.account
  }

  private needsPage() {
    return this.enabled && !this.exhausted && this.score > this.selfBest && !this.entries.some(entry => entry.value >= this.score)
  }

  private request() {
    if (!this.enabled || this.inFlight || this.attempts >= 6 || this.failures >= 3 || !this.isCurrent(this.generation)) return
    const wait = Math.max(this.lastRequestAt + MIN_INTERVAL, this.retryAt) - Date.now()
    if (wait > 0) {
      if (this.timer === null) this.timer = setTimeout(() => { this.timer = null; this.request() }, wait)
      return
    }
    const generation = this.generation
    const account = this.account!
    const baseline = this.ready ? Math.max(this.entries[this.entries.length - 1]?.value ?? this.selfBest, this.score - 1) : this.selfBest
    this.inFlight = true
    this.attempts += 1
    this.lastRequestAt = Date.now()
    void this.session.getApiClient().getLeaderboardTarget('score', baseline).then(data => {
      if (!this.isCurrent(generation)) return
      this.inFlight = false
      this.apply(data, this.ready)
      this.cache = { account, at: Date.now(), baseline: this.cache?.account === account ? Math.min(this.cache.baseline, baseline) : baseline,
        data: { ...data, entries: this.entries.slice() } }
      if (this.needsPage()) this.request()
    }).catch(error => {
      if (generation !== this.generation || account !== this.session.getSnapshot().playerId) return
      this.inFlight = false
      this.failures += 1
      if (!this.isCurrent(generation) || (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 404))) {
        this.enabled = false
        this.view = null
        this.listener?.()
        return
      }
      this.retryAt = Date.now() + MIN_INTERVAL * Math.pow(2, this.failures - 1)
      this.request()
    })
  }

  private apply(data: LeaderboardTargetResponse, animate: boolean) {
    if (!this.ready) this.selfBest = Math.max(this.selfBest, data.self.value)
    this.self = { ...data.self, value: this.selfBest }
    const entries = new Map(this.entries.map(entry => [`${entry.value}:${entry.displayName}`, entry]))
    for (const entry of data.entries) if (!entry.isSelf) entries.set(`${entry.value}:${entry.displayName}`, entry)
    this.entries = [...entries.values()].sort((a, b) => a.value - b.value || (a.rank ?? 0) - (b.rank ?? 0))
    this.exhausted = data.isTop
    this.ready = true
    this.reconcile(animate)
    this.listener?.()
    if (this.needsPage()) this.request()
  }

  private reconcile(animate: boolean) {
    const entry = this.score <= this.selfBest ? this.self : this.entries.find(row => row.value >= this.score)
    let next: OvertakeView
    if (entry) {
      const kind = this.score <= this.selfBest ? 'self' : 'rival'
      next = {
        kind, key: `${kind}:${entry.value}:${entry.displayName}:${entry.avatarIndex}:${entry.avatarType ?? 'builtin'}:${entry.wechatAvatarUrl ?? ''}`,
        name: entry.displayName, value: entry.value,
        avatar: { avatarIndex: entry.avatarIndex, avatarType: entry.avatarType ?? 'builtin', wechatAvatarUrl: entry.wechatAvatarUrl ?? '' },
        revision: this.revision, animate: false
      }
    } else if (this.exhausted) next = { kind: 'top', key: 'top', revision: this.revision, animate: false }
    else return
    if (next.key === this.view?.key) return
    next.animate = !!(animate && this.view && this.view.kind !== 'top' && this.score > this.view.value)
    next.revision = ++this.revision
    this.view = next
  }
}
