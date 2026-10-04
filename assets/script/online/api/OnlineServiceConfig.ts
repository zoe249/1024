// baseURL 统一包含接口版本，业务方法只声明资源路径，避免调用处重复拼接 `/v1`。
export const ONLINE_SERVICE_CONFIG = {
  baseURL: 'https://leyian.online/dev/v1',
  productionBaseURL: 'https://leyian.online/v1',
  requestTimeoutMs: 10_000
} as const

let resolvedApiBaseUrl: string | null = null

export function getApiBaseUrl() {
  if (resolvedApiBaseUrl !== null) {
    return resolvedApiBaseUrl
  }
  const runtime = globalThis as {
    __NUMBER_GARDEN_API_BASE_URL__?: unknown
    wx?: {
      getAccountInfoSync?: () => { miniProgram?: { envVersion?: string } }
    }
  }
  const configured = runtime.__NUMBER_GARDEN_API_BASE_URL__
  const value = typeof configured === 'string' ? configured.trim() : ''
  let isRelease = false
  try {
    isRelease = runtime.wx?.getAccountInfoSync?.().miniProgram?.envVersion === 'release'
  } catch {
    // 无法识别运行版本时使用开发接口，避免预览或调试误写正式数据。
  }
  // 首次使用后固定地址，让本次运行的请求、凭证和同步队列始终属于同一环境。
  resolvedApiBaseUrl = (value || (isRelease
    ? ONLINE_SERVICE_CONFIG.productionBaseURL
    : ONLINE_SERVICE_CONFIG.baseURL)).replace(/\/+$/, '')
  return resolvedApiBaseUrl
}

/** 正式版沿用已有存档键，开发接口使用独立存档，避免测试记录被同步到正式库。 */
export function getOnlineStorageKey(key: string) {
  const baseUrl = getApiBaseUrl()
  return baseUrl === ONLINE_SERVICE_CONFIG.productionBaseURL
    ? key
    : `${key}:${encodeURIComponent(baseUrl)}`
}
