import { sys } from 'cc'
import { ApiError, GameApiClient } from '../api/GameApiClient'
import { WechatLoginAdapter } from './WechatLoginAdapter'

export type AuthStatus =
  | 'guest'
  | 'restoring'
  | 'logging-in'
  | 'authenticated'
  | 'reauth-required'

export type PlayerSessionSnapshot = {
  status: AuthStatus
  token: string | null
  expiresAtMs: number | null
  playerId: string | null
}

const STORAGE_KEY = 'number-garden-player-session-v1'

/** 只持久化业务凭证，不保存 openid、session_key 或微信用户资料。 */
export class PlayerSessionStore {
  private static instance: PlayerSessionStore | null = null
  private readonly api = new GameApiClient(() => this.snapshot.token, () => this.markUnauthorized())
  private readonly wechat = new WechatLoginAdapter()
  private snapshot: PlayerSessionSnapshot
  private restorePromise: Promise<PlayerSessionSnapshot> | null = null
  private loginPromise: Promise<PlayerSessionSnapshot> | null = null

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerSessionStore()
    }
    return this.instance
  }

  private constructor() {
    this.snapshot = this.loadSnapshot()
  }

  getSnapshot(): PlayerSessionSnapshot {
    return { ...this.snapshot }
  }

  getToken() {
    return this.snapshot.status === 'authenticated' ? this.snapshot.token : null
  }

  getApiClient() {
    return this.api
  }

  restore(): Promise<PlayerSessionSnapshot> {
    if (this.restorePromise) {
      return this.restorePromise
    }
    const token = this.snapshot.token
    if (!token) {
      return Promise.resolve(this.getSnapshot())
    }
    if (this.snapshot.expiresAtMs !== null && this.snapshot.expiresAtMs <= Date.now()) {
      this.setReauthRequired()
      return Promise.resolve(this.getSnapshot())
    }

    this.snapshot.status = 'restoring'
    const restore = this.api.getSession()
      .then(session => {
        this.snapshot = {
          status: 'authenticated',
          token,
          playerId: session.playerId,
          expiresAtMs: this.parseExpiresAt(session.expiresAt)
        }
        this.saveSnapshot()
        return this.getSnapshot()
      })
      .catch(error => {
        if (error instanceof ApiError && error.statusCode === 401) {
          this.setReauthRequired()
        } else {
          // 网络故障不能把仍可能有效的凭证误判为退出登录。
          this.snapshot.status = 'authenticated'
        }
        return this.getSnapshot()
      })
    this.restorePromise = restore.then(result => {
      this.restorePromise = null
      return result
    }, error => {
      this.restorePromise = null
      throw error
    })
    return this.restorePromise
  }

  loginInteractively(installationId: string): Promise<PlayerSessionSnapshot> {
    if (this.snapshot.status === 'authenticated' && this.snapshot.token) {
      return Promise.resolve(this.getSnapshot())
    }
    if (this.loginPromise) {
      return this.loginPromise
    }

    this.snapshot.status = 'logging-in'
    const login = this.loginOnce(installationId, true)
      .then(login => {
        this.snapshot = {
          status: 'authenticated',
          token: login.token,
          expiresAtMs: this.parseExpiresAt(login.expiresAt),
          playerId: login.playerId
        }
        this.saveSnapshot()
        return this.getSnapshot()
      })
      .catch(error => {
        this.snapshot.status = this.snapshot.token ? 'reauth-required' : 'guest'
        throw error
      })
    this.loginPromise = login.then(result => {
      this.loginPromise = null
      return result
    }, error => {
      this.loginPromise = null
      throw error
    })
    return this.loginPromise
  }

  markUnauthorized() {
    this.setReauthRequired()
  }

  private async loginOnce(installationId: string, canRetry: boolean) {
    const code = await this.wechat.login()
    try {
      return await this.api.login(code, installationId)
    } catch (error) {
      if (
        canRetry && error instanceof ApiError &&
        (
          error.code === 'WECHAT_CODE_REUSED' ||
          error.code === 'WECHAT_CODE_INVALID' ||
          error.statusCode === 0 ||
          error.statusCode >= 500
        )
      ) {
        await new Promise(resolve => setTimeout(resolve, 350))
        // 每次重试都重新调用 wx.login，避免复用已经被服务端消费的临时 code。
        return this.loginOnce(installationId, false)
      }
      throw error
    }
  }

  private loadSnapshot(): PlayerSessionSnapshot {
    try {
      const raw = sys.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { status: 'guest', token: null, expiresAtMs: null, playerId: null }
      }
      const parsed = JSON.parse(raw) as Partial<PlayerSessionSnapshot>
      const token = typeof parsed.token === 'string' && parsed.token ? parsed.token : null
      const playerId = typeof parsed.playerId === 'string' && parsed.playerId ? parsed.playerId : null
      const expiresAtMs = typeof parsed.expiresAtMs === 'number' && Number.isFinite(parsed.expiresAtMs)
        ? parsed.expiresAtMs
        : null
      return {
        status: token && expiresAtMs !== null && expiresAtMs > Date.now()
          ? 'authenticated'
          : token ? 'reauth-required' : 'guest',
        token,
        playerId,
        expiresAtMs
      }
    } catch {
      return { status: 'guest', token: null, expiresAtMs: null, playerId: null }
    }
  }

  private setReauthRequired() {
    this.snapshot.status = 'reauth-required'
    this.saveSnapshot()
  }

  private saveSnapshot() {
    try {
      sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot))
    } catch (error) {
      console.warn('业务登录状态保存失败', error)
    }
  }

  private parseExpiresAt(value: string) {
    const time = new Date(value).getTime()
    return Number.isFinite(time) ? time : Date.now()
  }
}
