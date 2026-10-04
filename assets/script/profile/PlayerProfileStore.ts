import type { PlayerProfileResponse, UpdatePlayerProfileRequest } from '../online/api/GameApiClient'
import { PlayerSessionStore } from '../online/auth/PlayerSessionStore'
import { normalizePlayerAvatar, normalizeWechatAvatarUrl } from './AvatarCatalog'

export type PlayerProfileSnapshot = PlayerProfileResponse

/** 个人资料由服务端持久化；读写代次防止旧读响应覆盖保存结果，更新按队列执行。 */
export class PlayerProfileStore {
  private static instance: PlayerProfileStore | null = null
  private readonly session = PlayerSessionStore.getInstance()
  private snapshot: PlayerProfileSnapshot | null = null
  private loadPromise: Promise<PlayerProfileSnapshot> | null = null
  private updateQueue: Promise<unknown> = Promise.resolve()
  private revision = 0
  private generation = 0
  private avatarContractSupported = false

  static getInstance() {
    if (!this.instance) this.instance = new PlayerProfileStore()
    return this.instance
  }

  getSnapshot() { return this.snapshot ? { ...this.snapshot } : null }

  load(force = false): Promise<PlayerProfileSnapshot> {
    if (!force && this.snapshot) return Promise.resolve({ ...this.snapshot })
    if (this.loadPromise) return this.loadPromise
    const generation = this.generation
    const request = this.updateQueue.then(() => {
      if (generation !== this.generation) throw new Error('登录状态已变更，请重试')
      const revision = this.revision
      return this.session.getApiClient().getProfile().then(profile => {
        if (generation !== this.generation) throw new Error('登录状态已变更，请重试')
        if (revision !== this.revision) {
          return this.updateQueue.then(() => {
            if (generation !== this.generation) throw new Error('登录状态已变更，请重试')
            if (this.snapshot) return { ...this.snapshot }
            this.loadPromise = null
            return this.load(true)
          })
        }
        return this.store(profile)
      })
    })
    this.loadPromise = request
    const finish = () => { if (this.loadPromise === request) this.loadPromise = null }
    void request.then(finish, finish)
    return request
  }

  update(changes: UpdatePlayerProfileRequest): Promise<PlayerProfileSnapshot> {
    const generation = this.generation
    const update = this.updateQueue.catch(() => {}).then(async () => {
      if (generation !== this.generation) throw new Error('登录状态已变更，请重试')
      const payload = { ...changes }
      if (payload.displayName !== undefined) payload.displayName = payload.displayName.trim()
      if (payload.avatarType === 'wechat') {
        if (!this.avatarContractSupported) throw new Error('微信头像暂不可保存')
        payload.wechatAvatarUrl = normalizeWechatAvatarUrl(payload.wechatAvatarUrl)
        if (!payload.wechatAvatarUrl) throw new Error('未获取到微信头像，请重试')
      }
      if (payload.avatarIndex !== undefined) {
        if (!Number.isInteger(payload.avatarIndex) || payload.avatarIndex < 0 || payload.avatarIndex > 10) {
          throw new Error('请选择有效头像')
        }
        // 旧服务端只接收编号；其响应仍作为内置头像确认。
        if (!this.avatarContractSupported) delete payload.avatarType
      }
      this.revision += 1
      const profile = await this.session.getApiClient().updateProfile(payload)
      if (generation !== this.generation) throw new Error('登录状态已变更，请重试')
      if (payload.avatarType === 'wechat' && (
        profile.avatarType !== 'wechat' || profile.wechatAvatarUrl !== payload.wechatAvatarUrl
      )) {
        this.snapshot = null
        throw new Error('头像未保存成功，请重试')
      }
      if (payload.avatarIndex !== undefined && (
        profile.avatarIndex !== payload.avatarIndex || profile.avatarType === 'wechat'
      )) throw new Error('头像未保存成功，请重试')
      if (payload.displayName !== undefined && profile.displayName !== payload.displayName) {
        throw new Error('昵称未保存成功，请重试')
      }
      return this.store(profile)
    })
    this.updateQueue = update.catch(() => {})
    return update
  }

  clear() {
    this.snapshot = null
    this.loadPromise = null
    this.avatarContractSupported = false
    this.revision += 1
    this.generation += 1
  }

  private store(profile: PlayerProfileResponse) {
    this.avatarContractSupported = (profile.avatarType === 'builtin' || profile.avatarType === 'wechat')
      && typeof profile.wechatAvatarUrl === 'string'
    this.snapshot = {
      ...profile,
      ...normalizePlayerAvatar(profile),
      highestScore: Math.max(0, Math.floor(profile.highestScore))
    }
    return { ...this.snapshot }
  }
}
