// 游戏视图的资源入口与本局方块样式；不读写棋盘、分数或经济状态。
import { Color, Sprite, SpriteFrame } from 'cc'
import { appearanceAssetLoader, type AppearanceAssetLease } from '../appearance/AppearanceAssetLoader'
import { appearanceRuntime, type AppearanceLease } from '../appearance/AppearanceRuntime'
import { appearanceAssetKey, type AppearanceAssetRef, type BoardColorKey, type PieceLayer } from '../appearance/AppearanceTypes'

export type PieceAppearanceFrames = Partial<Record<PieceLayer, SpriteFrame>> & { imagesByValue?: Readonly<Record<number, SpriteFrame>> }
export class GameAppearance {
  private disposed = false
  private pieceFrames: PieceAppearanceFrames | null = null
  private readonly boardColors = new Map<BoardColorKey, Color>()
  private readonly requests = new Set<AppearanceAssetLease>()
  private readonly bindings = new Map<Sprite, { key: string; initial: SpriteFrame | null; applied: SpriteFrame | null }>()
  constructor(readonly lease: AppearanceLease = appearanceRuntime.acquireBase('game')) {}
  get piece() { return this.lease.appearance.piece }

  frames(): PieceAppearanceFrames {
    if (this.pieceFrames) return this.pieceFrames
    const result: PieceAppearanceFrames = {}
    for (const key of Object.keys(this.piece.layers) as PieceLayer[]) {
      const ref = this.piece.layers[key]
      if (ref.source === 'binding') continue
      const frame = this.lease.asset(ref)
      if (!(frame instanceof SpriteFrame)) throw new Error('方块候选外观尚未准备完成')
      result[key] = frame
    }
    const images: Record<number, SpriteFrame> = {}
    for (const key of Object.keys(this.piece.imagesByValue)) {
      const frame = this.lease.asset(this.piece.imagesByValue[Number(key)])
      if (!(frame instanceof SpriteFrame)) throw new Error('带数字的方块图片尚未准备完成')
      images[Number(key)] = frame
    }
    if (Object.keys(images).length) result.imagesByValue = Object.freeze(images)
    this.pieceFrames = Object.freeze(result)
    return this.pieceFrames
  }

  boardColor(key: BoardColorKey) {
    const cached = this.boardColors.get(key)
    if (cached) return cached
    const entry = this.lease.appearance.game.board[key]
    const color = Color.fromHEX(new Color(), entry.color); color.a = entry.opacity
    this.boardColors.set(key, color)
    return color
  }

  private loadSprite(ref: AppearanceAssetRef, callback: (error: Error | null, frame: SpriteFrame | null) => void) {
    if (this.disposed) return
    const prepared = this.lease.asset(ref)
    if (prepared instanceof SpriteFrame) { callback(null, prepared); return }
    if (this.lease.appearance.themeId !== 'base') throw new Error('游戏候选外观尚未准备完成')
    const request = appearanceAssetLoader.acquire(ref, (error, asset) => {
      if (!this.disposed) callback(error, asset instanceof SpriteFrame ? asset : null)
    })
    this.requests.add(request)
  }

  bindSprite(ref: AppearanceAssetRef, sprite: Sprite, onApplied: () => void) {
    if (this.disposed) return
    const key = appearanceAssetKey(ref)
    const previous = this.bindings.get(sprite)
    if (previous?.key === key) {
      if (previous.applied) { sprite.spriteFrame = previous.applied; onApplied() }
      return
    }
    const binding = { key, initial: previous ? previous.initial : sprite.spriteFrame, applied: null as SpriteFrame | null }
    this.bindings.set(sprite, binding)
    this.loadSprite(ref, (error, frame) => {
      if (this.bindings.get(sprite) !== binding || !sprite.isValid || !sprite.node?.isValid) return
      if (error || !frame) { this.bindings.delete(sprite); return }
      binding.applied = frame
      sprite.spriteFrame = frame
      onApplied()
    })
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
    this.pieceFrames = null
    this.boardColors.clear()
    this.lease.release()
  }
}
