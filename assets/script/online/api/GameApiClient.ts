import { getApiBaseUrl, ONLINE_SERVICE_CONFIG } from './OnlineServiceConfig'

type HttpMethod = 'GET' | 'POST' | 'PATCH'

type WechatRequestApi = {
  request?: (options: {
    url: string
    method: HttpMethod
    header: Record<string, string>
    data?: unknown
    timeout?: number
    success?: (response: { statusCode: number; data: unknown }) => void
    fail?: (error: { errMsg?: string }) => void
  }) => void
}

type ApiEnvelope<T> = { data: T }
type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } }

export type LoginResponse = {
  token: string
  expiresAt: string
  playerId: string
  isNewPlayer: boolean
}

export type SessionResponse = {
  playerId: string
  expiresAt: string
}

export type LeaderboardMetric = 'score' | 'highestNumber'

export type LeaderboardEntryDto = {
  rank: number | null
  displayName: string
  value: number
  avatarIndex: number
  isSelf: boolean
}

export type LeaderboardBoardDto = {
  metric: LeaderboardMetric
  entries: LeaderboardEntryDto[]
  self: LeaderboardEntryDto
}

export type LeaderboardResponse = {
  boards: LeaderboardBoardDto[]
}

export type PlayerProfileResponse = {
  playerId: string
  displayName: string
  avatarIndex: number
  highestScore: number
}

export type UpdatePlayerProfileRequest = {
  displayName?: string
  avatarIndex?: number
}

export type SyncResponse<TSnapshot> = {
  serverTime: string
  cloudRevision: number
  snapshot: TSnapshot
  acceptedOperationIds: string[]
  duplicateOperationIds: string[]
  rejectedOperations: Array<{ operationId: string; code: string; message: string }>
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

/**
 * 统一业务接口客户端。
 *
 * baseURL、超时、错误转换和 Bearer 注入只在这里处理；调用方不接触 token，
 * class 实例仅保存注入的 token getter，不保存另一份会话状态。
 */
export class GameApiClient {
  constructor(
    private readonly getToken: () => string | null,
    private readonly onUnauthorized: () => void
  ) {}

  login(code: string, installationId: string) {
    return this.request<LoginResponse>('POST', '/login', { code, installationId }, false)
  }

  getSession() {
    return this.request<SessionResponse>('GET', '/session', undefined, true)
  }

  sync<TSnapshot>(body: unknown) {
    return this.request<SyncResponse<TSnapshot>>('POST', '/sync', body, true)
  }

  getLeaderboard(limit = 7) {
    const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)))
    return this.request<LeaderboardResponse>('GET', `/leaderboard?limit=${safeLimit}`, undefined, true)
  }

  getProfile() {
    return this.request<PlayerProfileResponse>('GET', '/profile', undefined, true)
  }

  updateProfile(body: UpdatePlayerProfileRequest) {
    return this.request<PlayerProfileResponse>('PATCH', '/profile', body, true)
  }

  private request<T>(method: HttpMethod, path: string, body?: unknown, requiresAuth = false): Promise<T> {
    const url = `${getApiBaseUrl()}${path}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = requiresAuth ? this.getToken() : null
    if (requiresAuth && !token) {
      return Promise.reject(new ApiError(401, 'UNAUTHORIZED', '登录状态已失效'))
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const wxApi = (globalThis as { wx?: WechatRequestApi }).wx
    if (typeof wxApi?.request === 'function') {
      return new Promise((resolve, reject) => {
        wxApi.request?.({
          url,
          method,
          header: headers,
          ...(body === undefined ? {} : { data: body }),
          timeout: ONLINE_SERVICE_CONFIG.requestTimeoutMs,
          success: (response) => this.resolveResponse<T>(response.statusCode, response.data, resolve, reject),
          fail: () => reject(new ApiError(0, 'NETWORK_ERROR', '网络异常，请稍后重试'))
        })
      })
    }

    const fetchApi = (globalThis as { fetch?: typeof fetch }).fetch
    if (typeof fetchApi !== 'function') {
      return Promise.reject(new ApiError(0, 'NETWORK_UNAVAILABLE', '当前环境无法连接排行榜服务'))
    }
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ApiError(0, 'REQUEST_TIMEOUT', '网络请求超时，请稍后重试'))
      }, ONLINE_SERVICE_CONFIG.requestTimeoutMs)
      fetchApi(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }).then(async response => {
        let payload: unknown = null
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
        return new Promise<T>((innerResolve, innerReject) => {
          this.resolveResponse(response.status, payload, innerResolve, innerReject)
        })
      }).then(result => {
        clearTimeout(timeoutId)
        resolve(result)
      }, error => {
        clearTimeout(timeoutId)
        reject(error instanceof ApiError
          ? error
          : new ApiError(0, 'NETWORK_ERROR', '网络异常，请稍后重试'))
      })
    })
  }

  private resolveResponse<T>(
    statusCode: number,
    payload: unknown,
    resolve: (value: T) => void,
    reject: (reason: ApiError) => void
  ) {
    if (statusCode >= 200 && statusCode < 300) {
      const data = (payload as ApiEnvelope<T> | null)?.data
      if (data !== undefined) {
        resolve(data)
        return
      }
      reject(new ApiError(statusCode, 'INVALID_RESPONSE', '服务器返回了无效数据'))
      return
    }
    const error = payload as ErrorEnvelope | null
    if (statusCode === 401) {
      this.onUnauthorized()
    }
    reject(new ApiError(
      statusCode,
      error?.error?.code ?? 'REQUEST_FAILED',
      error?.error?.message ?? (statusCode >= 500 ? '服务器暂时不可用' : '请求失败'),
      error?.error?.details
    ))
  }
}
