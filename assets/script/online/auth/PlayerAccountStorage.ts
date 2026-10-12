import { sys } from 'cc'
import { getOnlineStorageKey } from '../api/OnlineServiceConfig'

/** 旧环境存档只迁移给首个账号，后续账号各自读取余额和未确认队列。 */
export function getPlayerAccountStorageKey(base: string, playerId: string | null) {
  const legacy = getOnlineStorageKey(base)
  if (!playerId) return legacy
  const scoped = `${legacy}:player:${encodeURIComponent(playerId)}`
  const ownerKey = `${legacy}:migration-owner`
  try {
    const owner = sys.localStorage.getItem(ownerKey)
    if (!owner) {
      const value = sys.localStorage.getItem(legacy)
      if (value && !sys.localStorage.getItem(scoped)) sys.localStorage.setItem(scoped, value)
      sys.localStorage.setItem(ownerKey, playerId)
    }
  } catch (error) {
    console.warn('账号存档迁移失败', error)
  }
  return scoped
}

export function isLaterPlayerAccount(base: string, playerId: string | null) {
  try { return !!playerId && sys.localStorage.getItem(`${getOnlineStorageKey(base)}:migration-owner`) !== playerId }
  catch { return !!playerId }
}
