// 当前默认外观的唯一描述；保留所有现有资源入口、颜色和预览差异。
import type { AppearanceAssetRef, HomeArtworkKey, ResolvedAppearance } from './AppearanceTypes'

const binding = (id: string): AppearanceAssetRef => ({ source: 'binding', id, kind: 'spriteFrame' })
const uuid = (value: string): AppearanceAssetRef => ({ source: 'uuid', uuid: value, kind: 'spriteFrame' })
const homePaths: Record<HomeArtworkKey, string> = {
  background: 'SwingV14/background-tree-branch', start: 'button-start-game', swingBird: 'SwingV14/swing-bird-seated',
  swingSeat: 'SwingV14/swing-seat', swingRope: 'SwingV14/swing-rope', swingKnot: 'SwingV14/swing-seat-knot', swingLeaf: 'SwingV14/swing-leaf',
  daily: 'feature-daily-reward', leaderboard: 'feature-leaderboard', share: 'feature-share', shop: 'feature-shop',
  logo: 'logo-1024-number-garden', coin: 'resource-coin', avatarFrame: 'avatar-frame', settings: 'ui-settings'
}
const artwork = {} as ResolvedAppearance['home']['artwork']
for (const key of Object.keys(homePaths) as HomeArtworkKey[]) artwork[key] = { source: 'resources', path: `base/Homepage/${homePaths[key]}/spriteFrame`, kind: 'spriteFrame' }

export const BASE_APPEARANCE: ResolvedAppearance = {
  themeId: 'base', version: 1,
  home: { artwork },
  loading: {
    background: binding('loading.background'), leaf: { enabled: true, asset: binding('loading.leaf') },
    progress: { fill: '#7eb736', track: '#ffefc7', text: '#4a301c' }
  },
  game: {
    background: uuid('5ad49fb5-9e08-4dc5-9ee9-1451320c9378@f9941'),
    settings: uuid('84a1f2b0-6d31-4e77-9c42-2b80d1f5100d@f9941'),
    skills: { bomb: uuid('c2bd34f2-a783-4855-8af8-fa07fe942dc1@f9941'), hammer: uuid('a7c0480a-a4dd-46dc-ab94-4c0df29d1bd8@f9941'), swap: uuid('32927f70-f651-471d-b8a1-7c2bbe5ddc17@f9941') },
    board: { shadow: { color: '#4b3720', opacity: 18 }, tint: { color: '#fff8dc', opacity: 8 }, inner: { color: '#fff8dc', opacity: 0 }, columnTint: { color: '#ffffff', opacity: 0 }, columnEdge: { color: '#ffffff', opacity: 0 }, dash: { color: '#ffffff', opacity: 0 } }
  },
  piece: {
    imagesByValue: {},
    layers: { shadow: binding('piece.shadow'), body: binding('piece.body'), outline: binding('piece.outline'), highlight: binding('piece.highlight'), sparkle: binding('piece.sparkle'), crown: binding('piece.crown') },
    bodyMode: 'tinted', fallbackStyle: { bodyColor: '#cf586d' },
    stylesByValue: {
      2: { bodyColor: '#f8ecdc' }, 4: { bodyColor: '#f7a536' }, 8: { bodyColor: '#ffc22e' }, 16: { bodyColor: '#9bc849' },
      32: { bodyColor: '#50ae61' }, 64: { bodyColor: '#35a1a5' }, 128: { bodyColor: '#3f88c7' }, 256: { bodyColor: '#5872c8' },
      512: { bodyColor: '#6e55b8' }, 1024: { bodyColor: '#8f54ad', textScale: 0.94 }, 2048: { bodyColor: '#cf586d', textScale: 0.9 },
      4096: { bodyColor: '#db5935', textScale: 0.9 }, 8192: { bodyColor: '#2f6c78', textColor: '#ffe4a0', outlineColor: '#e8ad2d', decoration: 'crown', textScale: 0.86 }
    },
    preview: { styledValues: [2, 4, 8, 16, 32, 64, 128], textColor: '#fff9ea', outlineColor: '#4b3528' }
  }
}

function freeze(value: object) {
  for (const key of Object.keys(value)) { const child = (value as Record<string, unknown>)[key]; if (child && typeof child === 'object') freeze(child) }
  Object.freeze(value)
}
freeze(BASE_APPEARANCE)
