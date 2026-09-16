import type { PlayerProfileResponse, UpdatePlayerProfileRequest } from '../online/api/GameApiClient'
import { PlayerSessionStore } from '../online/auth/PlayerSessionStore'
import { normalizeAvatarIndex } from './AvatarCatalog'

export type PlayerProfileSnapshot = PlayerProfileResponse

/** 个人资料只由服务端持久化；本地缓存仅用于减少同一场景内的重复请求。 */
export class PlayerProfileStore {
  private static instance: PlayerProfileStore | null = null
  private readonly session = PlayerSessionStore.getInstance()
  private snapshot: PlayerProfileSnapshot | null = null
  private loadPromise: Promise<PlayerProfileSnapshot> | null = null
  private updatePromise: Promise<PlayerProfileSnapshot> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerProfileStore()
    }
    return this.instance
  }

  getSnapshot() {
    return this.snapshot ? { ...this.snapshot } : null
  }

  load(force = false): Promise<PlayerProfileSnapshot> {
    if (!force && this.snapshot) {
      return Promise.resolve({ ...this.snapshot })
    }
    if (this.loadPromise) {
      return this.loadPromise
    }
    const load = this.session.getApiClient().getProfile().then(profile => this.store(profile))
    this.loadPromise = load.then(result => {
      this.loadPromise = null
      return result
    }, error => {
      this.loadPromise = null
      throw error
    })
    return this.loadPromise
  }

  update(changes: UpdatePlayerProfileRequest): Promise<PlayerProfileSnapshot> {
    if (this.updatePromise) {
      return this.updatePromise
    }
    const payload: UpdatePlayerProfileRequest = {
      ...(changes.displayName === undefined ? {} : { displayName: changes.displayName.trim() }),
      ...(changes.avatarIndex === undefined ? {} : { avatarIndex: normalizeAvatarIndex(changes.avatarIndex) })
    }
    const update = this.session.getApiClient().updateProfile(payload).then(profile => this.store(profile))
    this.updatePromise = update.then(result => {
      this.updatePromise = null
      return result
    }, error => {
      this.updatePromise = null
      throw error
    })
    return this.updatePromise
  }

  clear() {
    this.snapshot = null
  }

  private store(profile: PlayerProfileResponse) {
    this.snapshot = {
      ...profile,
      avatarIndex: normalizeAvatarIndex(profile.avatarIndex),
      highestScore: Math.max(0, Math.floor(profile.highestScore))
    }
    return { ...this.snapshot }
  }
}
