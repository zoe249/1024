// 生产目录只登记现有 Base；隔离测试配置不进入玩家可选目录。
import { BASE_APPEARANCE } from './BaseAppearance'
import type { AppearanceTheme } from './AppearanceTypes'

const THEMES: Readonly<Record<string, AppearanceTheme>> = Object.freeze({})
export function findAppearanceTheme(themeId: string): AppearanceTheme | undefined { return THEMES[themeId] }
export const BASE_APPEARANCE_VERSION = BASE_APPEARANCE.version
