// 纯样式计算；展示位置的既有差异由用途参数保留，布局刷新沿用注入配置。
import { BASE_APPEARANCE } from '../appearance/BaseAppearance'
import type { PieceAppearance, PieceStyle } from '../appearance/AppearanceTypes'
export type { PieceDecoration, PieceStyle } from '../appearance/AppearanceTypes'
export type PieceDisplay = 'board' | 'preview' | 'settlement'

export function getPieceStyle(value: number, appearance: PieceAppearance = BASE_APPEARANCE.piece): PieceStyle {
  const style = appearance.stylesByValue[value] ?? appearance.fallbackStyle
  return appearance.bodyMode === 'fullColor' ? { ...style, bodyColor: '#ffffff' } : style
}

export function getPieceDisplayStyle(value: number, display: PieceDisplay, appearance: PieceAppearance = BASE_APPEARANCE.piece): PieceStyle {
  if (display === 'preview') {
    const bodyColor = appearance.preview.styledValues.indexOf(value) >= 0
      ? getPieceStyle(value, appearance).bodyColor : appearance.bodyMode === 'fullColor' ? '#ffffff' : appearance.fallbackStyle.bodyColor
    return { bodyColor, textColor: appearance.preview.textColor, outlineColor: appearance.preview.outlineColor }
  }
  return getPieceStyle(value, appearance)
}
