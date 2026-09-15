// baseURL 统一包含接口版本，业务方法只声明资源路径，避免调用处重复拼接 `/v1`。
export const ONLINE_SERVICE_CONFIG = {
  baseURL: 'https://leyian.online/v1',
  requestTimeoutMs: 10_000
} as const

export function getApiBaseUrl() {
  const configured = (globalThis as {
    __NUMBER_GARDEN_API_BASE_URL__?: unknown
  }).__NUMBER_GARDEN_API_BASE_URL__
  const value = typeof configured === 'string' ? configured.trim() : ''
  return (value || ONLINE_SERVICE_CONFIG.baseURL).replace(/\/+$/, '')
}
