// 绑定已有首页贴图；首帧保留序列化图片，缺图加载与覆盖资源由本视图持有租约。
import { Color, Node, Sprite, SpriteFrame, UITransform } from 'cc'
import { appearanceAssetLoader, type AppearanceAssetLease } from '../appearance/AppearanceAssetLoader'
import { appearanceRuntime, type AppearanceLease } from '../appearance/AppearanceRuntime'
import type { HomeArtworkKey } from '../appearance/AppearanceTypes'

export class HomeAppearance {
  private disposed = false
  private readonly requests = new Set<AppearanceAssetLease>()
  private readonly bindings = new Map<Sprite, { initial: SpriteFrame | null; applied: SpriteFrame | null }>()
  constructor(private readonly lease: AppearanceLease = appearanceRuntime.acquireBase('home')) {}

  applyArtwork(node: Node, artwork: HomeArtworkKey, width: number, height: number) {
    if (this.disposed) return
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform)
    transform.setContentSize(width, height)
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite)
    sprite.enabled = true
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.trim = false
    sprite.color = Color.WHITE
    if (!this.bindings.has(sprite)) this.bindings.set(sprite, { initial: sprite.spriteFrame, applied: null })
    const ref = this.lease.appearance.home.artwork[artwork]
    const prepared = this.lease.asset(ref)
    if (prepared instanceof SpriteFrame) { this.bindings.get(sprite)!.applied = prepared; sprite.spriteFrame = prepared; return }
    // 仅 Base 沿用已序列化首帧；明确的主题覆盖不能被已有图片挡住。
    if (this.lease.appearance.themeId === 'base' && sprite.spriteFrame) return
    if (this.lease.appearance.themeId !== 'base') throw new Error('首页候选外观尚未准备完成')
    const request = appearanceAssetLoader.acquire(ref, (error, asset) => {
      if (this.disposed || !node.isValid || !sprite.isValid || !transform.isValid) return
      if (error || !(asset instanceof SpriteFrame)) { console.warn(`[首页] 素材加载失败: ${artwork}`, error); return }
      this.bindings.get(sprite)!.applied = asset
      sprite.spriteFrame = asset
      transform.setContentSize(width, height)
    })
    this.requests.add(request)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const [sprite, binding] of this.bindings) {
      if (sprite.isValid && sprite.node?.isValid && binding.applied && sprite.spriteFrame === binding.applied) sprite.spriteFrame = binding.initial?.isValid ? binding.initial : null
    }
    this.bindings.clear()
    for (const request of this.requests) request.release()
    this.requests.clear()
    this.lease.release()
  }
}
