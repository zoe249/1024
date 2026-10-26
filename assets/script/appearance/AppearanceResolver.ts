// 每次从 Base 重新解析白名单覆盖；非法字段和明确的空资源均拒绝，不隐式继承。
import { BASE_APPEARANCE } from './BaseAppearance'
import type { AppearanceAssetRef, AppearanceTheme, ResolvedAppearance } from './AppearanceTypes'

type Data = Record<string, any>
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('外观配置必须是对象')
  return Object.assign(Object.create(null), value) as Data
}
function keys(value: Data, allowed: string[]) {
  for (const key of Object.keys(value)) if (allowed.indexOf(key) < 0) throw new Error(`不支持的外观字段: ${key}`)
}
function color(value: unknown) { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('外观颜色必须为六位十六进制') }
function asset(value: unknown): AppearanceAssetRef {
  const data = object(value)
  const fields = data.source === 'binding' ? ['source', 'kind', 'id'] : data.source === 'uuid' ? ['source', 'kind', 'uuid'] : data.source === 'resources' ? ['source', 'kind', 'path'] : data.source === 'bundle' ? ['source', 'kind', 'bundle', 'path'] : []
  if (!fields.length) throw new Error('不支持的外观资源来源')
  keys(data, fields)
  if (data.kind !== 'spriteFrame' && data.kind !== 'prefab') throw new Error('不支持的外观资源类型')
  for (const field of fields) if (typeof data[field] !== 'string' || !data[field] || /(?:\.\.|:\/\/|[\\\u0000])/u.test(data[field])) throw new Error('外观资源标识无效')
  if (data.source === 'bundle' && !/^theme_[a-z0-9_-]+$/.test(data.bundle)) throw new Error('外观 Bundle 必须是本地主题名')
  if (data.path && (/^\//.test(data.path) || data.path.indexOf(':') >= 0)) throw new Error('外观资源必须使用包内相对路径')
  return { ...data } as AppearanceAssetRef
}
function scalarPatch(target: Data, patch: unknown, validators: Record<string, (value: any) => void>) {
  const data = object(patch); keys(data, Object.keys(validators))
  for (const key of Object.keys(data)) { if (data[key] === undefined) continue; validators[key](data[key]); target[key] = Array.isArray(data[key]) ? [...data[key]] : data[key] }
}
function refs(target: Data, patch: unknown) {
  const data = object(patch); keys(data, Object.keys(target))
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) continue
    const ref = asset(data[key])
    if (ref.kind !== target[key].kind) throw new Error('外观资源用途与类型不匹配')
    // 绑定只允许继承已知入口，不允许主题凭空读取任意宿主字段。
    if (ref.source === 'binding' && (target[key].source !== 'binding' || ref.id !== target[key].id)) throw new Error('不支持的外观绑定')
    target[key] = ref
  }
}
function style(target: Data, patch: unknown) {
  scalarPatch(target, patch, { bodyColor: color, textColor: color, outlineColor: color,
    decoration: v => { if (['none', 'sparkle', 'crown'].indexOf(v) < 0) throw new Error('不支持的棋子装饰') },
    textScale: v => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error('棋子字号比例无效') } })
}
function freeze<T extends object>(value: T): T { for (const key of Object.keys(value)) { const child = (value as Data)[key]; if (child && typeof child === 'object') freeze(child) }; Object.freeze(value); return value }

function mergeLoading(target: ResolvedAppearance['loading'], patch: unknown) {
  const p = object(patch)
  keys(p, ['background', 'leaf', 'progress'])
  if (p.background !== undefined) refs(target, { background: p.background })
  if (p.leaf !== undefined) {
    const leaf = object(p.leaf)
    keys(leaf, ['enabled', 'asset'])
    if (leaf.enabled !== undefined) {
      if (typeof leaf.enabled !== 'boolean') throw new Error('装饰开关无效')
      target.leaf.enabled = leaf.enabled
    }
    if (leaf.asset !== undefined) refs(target.leaf, { asset: leaf.asset })
  }
  if (p.progress !== undefined) scalarPatch(target.progress, p.progress, { fill: color, track: color, text: color })
}

function mergeGame(target: ResolvedAppearance['game'], patch: unknown) {
  const p = object(patch)
  keys(p, ['background', 'settings', 'skills', 'board'])
  if (p.background !== undefined) refs(target, { background: p.background })
  if (p.settings !== undefined) refs(target, { settings: p.settings })
  if (p.skills !== undefined) refs(target.skills, p.skills)
  if (p.board !== undefined) {
    const board = object(p.board)
    keys(board, Object.keys(target.board))
    for (const key of Object.keys(board)) {
      if (board[key] === undefined) continue
      scalarPatch((target.board as Data)[key], board[key], { color, opacity: value => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 255) throw new Error('外观透明度无效')
      } })
    }
  }
}

function mergePiece(target: ResolvedAppearance['piece'], patch: unknown) {
  const p = object(patch)
  keys(p, ['layers', 'imagesByValue', 'bodyMode', 'stylesByValue', 'fallbackStyle', 'preview'])
  if (p.layers !== undefined) refs(target.layers, p.layers)
  if (p.imagesByValue !== undefined) {
    const images = object(p.imagesByValue)
    for (const key of Object.keys(images)) {
      const value = Number(key)
      if (String(value) !== key || !Number.isSafeInteger(value) || value < 2 || 2 ** Math.round(Math.log2(value)) !== value) throw new Error('方块图片数值必须是安全整数范围内的二次幂')
      const ref = asset(images[key])
      if (ref.kind !== 'spriteFrame' || ref.source === 'binding') throw new Error('带数字的方块图片必须明确提供本地 SpriteFrame')
      target.imagesByValue[value] = ref
    }
  }
  if (p.bodyMode !== undefined) {
    if (p.bodyMode !== 'tinted' && p.bodyMode !== 'fullColor') throw new Error('棋子染色模式无效')
    target.bodyMode = p.bodyMode
  }
  if (p.fallbackStyle !== undefined) style(target.fallbackStyle, p.fallbackStyle)
  if (p.stylesByValue !== undefined) {
    const values = object(p.stylesByValue)
    keys(values, Object.keys(target.stylesByValue))
    for (const key of Object.keys(values)) if (values[key] !== undefined) style((target.stylesByValue as Data)[key], values[key])
  }
  if (p.preview !== undefined) scalarPatch(target.preview, p.preview, {
    textColor: color, outlineColor: color, styledValues: values => {
      if (!Array.isArray(values) || values.some(value => !Object.prototype.hasOwnProperty.call(target.stylesByValue, value))) throw new Error('预览色阶无效')
    }
  })
  if (target.bodyMode === 'fullColor' && target.layers.body.source === 'binding') throw new Error('完整彩色模式必须明确提供主体贴图')
}

export function resolveAppearance(theme?: AppearanceTheme): ResolvedAppearance {
  const result: ResolvedAppearance = JSON.parse(JSON.stringify(BASE_APPEARANCE))
  if (!theme) return freeze(result)
  const definition = object(theme)
  keys(definition, ['themeId', 'version', 'overrides'])
  if (definition.themeId === 'base' || !/^[a-z][a-z0-9_-]*$/.test(definition.themeId) || !Number.isInteger(definition.version) || definition.version < 1) throw new Error('外观版本或 ID 无效')
  const patch = object(definition.overrides)
  keys(patch, ['home', 'loading', 'game', 'piece'])
  result.themeId = definition.themeId
  result.version = definition.version
  if (patch.home !== undefined) {
    const p = object(patch.home)
    keys(p, ['artwork'])
    if (p.artwork !== undefined) refs(result.home.artwork, p.artwork)
  }
  if (patch.loading !== undefined) mergeLoading(result.loading, patch.loading)
  if (patch.game !== undefined) mergeGame(result.game, patch.game)
  if (patch.piece !== undefined) mergePiece(result.piece, patch.piece)
  return freeze(result)
}
