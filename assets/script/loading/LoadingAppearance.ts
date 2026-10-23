// 加载页只读取本场景外观；默认背景和叶子继续使用 Inspector 引用。
import { Color, SpriteFrame } from 'cc'
import { appearanceRuntime, type AppearanceLease } from '../appearance/AppearanceRuntime'

export class LoadingAppearance {
  constructor(private readonly lease: AppearanceLease = appearanceRuntime.acquireBase('loading')) {}
  background(fallback: SpriteFrame | null) { return this.frame(this.lease.appearance.loading.background, fallback) }
  leaf(fallback: SpriteFrame | null) { const leaf = this.lease.appearance.loading.leaf; return leaf.enabled ? this.frame(leaf.asset, fallback) : null }
  color(key: 'fill' | 'track' | 'text') { return Color.fromHEX(new Color(), this.lease.appearance.loading.progress[key]) }
  dispose() { this.lease.release() }

  private frame(ref: Parameters<AppearanceLease['asset']>[0], fallback: SpriteFrame | null) {
    if (ref.source === 'binding') return fallback
    const asset = this.lease.asset(ref)
    if (!(asset instanceof SpriteFrame)) throw new Error('加载页候选外观尚未准备完成')
    return asset
  }
}
