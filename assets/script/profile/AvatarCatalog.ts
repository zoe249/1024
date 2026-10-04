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


export type PlayerAvatar = {
  avatarIndex: number
  avatarType?: 'builtin' | 'wechat'
  wechatAvatarUrl?: string
}

export type AvatarOption = { kind: 'wechat' } | { kind: 'builtin'; avatarIndex: number }

// 浣熊仍供旧资料显示，但新列表只开放前 11 个编号。
export const AVATAR_OPTIONS: AvatarOption[] = [
  { kind: 'wechat' },
  ...Array.from({ length: 11 }, (_, avatarIndex) => ({ kind: 'builtin' as const, avatarIndex }))
]

export function normalizeWechatAvatarUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const url = value.trim()
  // 不依赖 URL 全局对象，兼容小游戏环境；允许查询参数和无图片后缀地址。
  return url.length <= 2048 && /^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?][^\s\\]*)?$/i.test(url)
    ? url : ''
}

export function normalizePlayerAvatar(avatar: PlayerAvatar): Required<PlayerAvatar> {
  return {
    avatarIndex: normalizeAvatarIndex(avatar.avatarIndex),
    avatarType: avatar.avatarType === 'wechat' ? 'wechat' : 'builtin',
    wechatAvatarUrl: normalizeWechatAvatarUrl(avatar.wechatAvatarUrl)
  }
}
