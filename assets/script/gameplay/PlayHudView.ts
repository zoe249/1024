import { BASE_APPEARANCE } from '../appearance/BaseAppearance'
import type { PieceAppearance } from '../appearance/AppearanceTypes'
// 只渲染已绑定的 HUD 节点；不持有单局或经济状态。
import { Color, Graphics, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc'
import { getPieceDisplayStyle } from './PieceStyle'

const HUD_CARD_BORDER_COLOR = new Color(75, 53, 40, 255)

export class PlayHudView {
  private static readonly imageLabels = new WeakMap<Label, boolean>()

  static restoreNextPieceLabel(label: Label | null) {
    if (!label || !this.imageLabels.has(label)) return
    if (label.isValid && label.node?.isValid) label.enabled = this.imageLabels.get(label)!
    this.imageLabels.delete(label)
  }

  static renderNextPiece(value: number, nextValueLabel: Label | null, nextValueTile: Graphics | null, appearance: PieceAppearance = BASE_APPEARANCE.piece, bodyFrame?: SpriteFrame, valueImage?: SpriteFrame): Sprite | null {
    if (!nextValueLabel || !nextValueTile) {
      return null
    }

    const bodyColor = Color.fromHEX(new Color(), getPieceDisplayStyle(value, 'preview', appearance).bodyColor)
    nextValueTile.clear()
    nextValueTile.fillColor = HUD_CARD_BORDER_COLOR
    nextValueTile.roundRect(-26, -26, 52, 52, 9)
    nextValueTile.fill()
    nextValueTile.fillColor = bodyColor
    nextValueTile.roundRect(-23, -23, 46, 46, 7)
    nextValueTile.fill()
    nextValueLabel.string = `${value}`
    nextValueLabel.fontSize = value >= 100 ? 19 : value >= 10 ? 21 : 24
    nextValueLabel.color = Color.fromHEX(new Color(), appearance.preview.textColor)
    nextValueLabel.enableOutline = true
    nextValueLabel.outlineColor = Color.fromHEX(new Color(), appearance.preview.outlineColor)
    nextValueLabel.outlineWidth = 2
    if (!valueImage) this.restoreNextPieceLabel(nextValueLabel)
    // 只有已准备的贴图覆盖才需要轻量缩略图；默认预览仍使用原 Graphics，层级不变。
    const parent = nextValueTile.node
    if (!parent?.isValid) return null
    let body = parent.getChildByName('AppearanceBody')
    const frame = valueImage ?? bodyFrame
    if (!frame) {
      if (body) { body.active = false; const sprite = body.getComponent(Sprite); if (sprite) sprite.spriteFrame = null }
      return body?.getComponent(Sprite) ?? null
    }
    if (!body) { body = new Node('AppearanceBody'); body.setParent(parent); body.addComponent(UITransform); body.addComponent(Sprite) }
    body.active = true
    body.setPosition(0, 0, 0)
    body.getComponent(UITransform)!.setContentSize(46, 46)
    body.setSiblingIndex(0)
    const sprite = body.getComponent(Sprite)!
    sprite.spriteFrame = frame
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.trim = false
    sprite.color = valueImage ? new Color(255, 255, 255, 255) : bodyColor
    if (valueImage) {
      if (!this.imageLabels.has(nextValueLabel)) this.imageLabels.set(nextValueLabel, nextValueLabel.enabled)
      nextValueLabel.enabled = false
    }
    return sprite
  }

}
