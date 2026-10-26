// 纯数据外观契约；只允许本地资源与展示字段，不包含节点路径或玩法参数。
export type AppearanceAssetRef =
  | { source: 'binding'; id: string; kind: 'spriteFrame' | 'prefab' }
  | { source: 'uuid'; uuid: string; kind: 'spriteFrame' | 'prefab' }
  | { source: 'resources'; path: string; kind: 'spriteFrame' | 'prefab' }
  | { source: 'bundle'; bundle: string; path: string; kind: 'spriteFrame' | 'prefab' }

export type PieceDecoration = 'none' | 'sparkle' | 'crown'
export type PieceStyle = { bodyColor: string; textColor?: string; outlineColor?: string; decoration?: PieceDecoration; textScale?: number }
export type PieceLayer = 'shadow' | 'body' | 'outline' | 'highlight' | 'sparkle' | 'crown'
export type PieceAppearance = {
  layers: Record<PieceLayer, AppearanceAssetRef>
  // 可选皮肤按数值提供自带数字的底图；缺少的数值沿用图层与 Label。
  imagesByValue: Record<number, AppearanceAssetRef>
  bodyMode: 'tinted' | 'fullColor'
  stylesByValue: Record<number, PieceStyle>
  fallbackStyle: PieceStyle
  preview: { styledValues: number[]; textColor: string; outlineColor: string }
}

export type HomeArtworkKey = 'background' | 'start' | 'swingBird' | 'swingSeat' | 'swingRope' | 'swingKnot' | 'swingLeaf' | 'daily' | 'leaderboard' | 'share' | 'shop' | 'logo' | 'coin' | 'avatarFrame' | 'settings'
export type BoardColorKey = 'shadow' | 'tint' | 'inner' | 'columnTint' | 'columnEdge' | 'dash'
export type AppearanceScene = 'home' | 'loading' | 'game'
export type ResolvedAppearance = {
  themeId: string
  version: number
  home: { artwork: Record<HomeArtworkKey, AppearanceAssetRef> }
  loading: { background: AppearanceAssetRef; leaf: { enabled: boolean; asset: AppearanceAssetRef }; progress: { fill: string; track: string; text: string } }
  game: { background: AppearanceAssetRef; settings: AppearanceAssetRef; skills: Record<'bomb' | 'hammer' | 'swap', AppearanceAssetRef>; board: Record<BoardColorKey, { color: string; opacity: number }> }
  piece: PieceAppearance
}

export type AppearanceOverrides = {
  home?: { artwork?: Partial<ResolvedAppearance['home']['artwork']> }
  loading?: { background?: AppearanceAssetRef; leaf?: Partial<ResolvedAppearance['loading']['leaf']>; progress?: Partial<ResolvedAppearance['loading']['progress']> }
  game?: { background?: AppearanceAssetRef; settings?: AppearanceAssetRef; skills?: Partial<ResolvedAppearance['game']['skills']>; board?: Partial<Record<BoardColorKey, Partial<{ color: string; opacity: number }>>> }
  piece?: { layers?: Partial<PieceAppearance['layers']>; imagesByValue?: PieceAppearance['imagesByValue']; bodyMode?: PieceAppearance['bodyMode']; stylesByValue?: Record<number, Partial<PieceStyle>>; fallbackStyle?: Partial<PieceStyle>; preview?: Partial<PieceAppearance['preview']> }
}
export type AppearanceTheme = { themeId: string; version: number; overrides: AppearanceOverrides }

export function appearanceAssetKey(ref: AppearanceAssetRef) {
  switch (ref.source) {
    case 'binding': return `binding:${ref.kind}:${ref.id}`
    case 'uuid': return `uuid:${ref.kind}:${ref.uuid}`
    case 'resources': return `resources:${ref.kind}:${ref.path}`
    case 'bundle': return `bundle:${ref.kind}:${ref.bundle}:${ref.path}`
  }
}

export function sceneAppearanceAssets(appearance: ResolvedAppearance, scene: AppearanceScene): AppearanceAssetRef[] {
  if (scene === 'home') return Object.keys(appearance.home.artwork).map(key => appearance.home.artwork[key as HomeArtworkKey])
  if (scene === 'loading') return [appearance.loading.background, ...(appearance.loading.leaf.enabled ? [appearance.loading.leaf.asset] : [])]
  return [appearance.game.background, appearance.game.settings, ...Object.keys(appearance.game.skills).map(key => appearance.game.skills[key as 'bomb' | 'hammer' | 'swap']), ...Object.keys(appearance.piece.layers).map(key => appearance.piece.layers[key as PieceLayer]), ...Object.keys(appearance.piece.imagesByValue).map(key => appearance.piece.imagesByValue[Number(key)])]
}
