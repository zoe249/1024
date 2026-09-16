/**
 * 头像编号是客户端资源和数据库之间唯一稳定的契约。
 * 调整显示顺序时不能修改已有编号，只能在数组末尾追加新头像。
 */
export const PLAYER_AVATARS = [
  'rabbit',
  'fox',
  'blue-bird',
  'orange-cat',
  'chick',
  'turtle',
  'deer',
  'alpaca',
  'squirrel',
  'frog',
  'hedgehog',
  'raccoon'
] as const

export const PLAYER_AVATAR_COUNT = PLAYER_AVATARS.length

export function normalizeAvatarIndex(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(PLAYER_AVATAR_COUNT - 1, Math.max(0, Math.floor(value)))
}

export function getAvatarKey(index: number) {
  return PLAYER_AVATARS[normalizeAvatarIndex(index)]
}

export function getAvatarSpritePath(index: number) {
  return `Leaderboard/Avatars/avatar-${getAvatarKey(index)}/spriteFrame`
}
