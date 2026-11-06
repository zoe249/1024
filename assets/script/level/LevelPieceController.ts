import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc'

const { ccclass, property } = _decorator
const COLORS = ['#F8ECDC', '#F7A536', '#FFC22E', '#9BC849', '#50AE61', '#35A1A5', '#3F88C7', '#5872C8', '#6E55B8', '#8F54AD', '#CF586D', '#DB5935']
export const levelPieceColor = (value: number) => value === 8192 ? '#2F6C78' : COLORS[Math.log2(value) - 1] ?? '#CF586D'

@ccclass('LevelPieceController')
export class LevelPieceController extends Component {
  @property({ type: Sprite }) body: Sprite = null!
  @property({ type: Sprite }) outline: Sprite = null!
  @property({ type: Sprite }) highlight: Sprite = null!
  @property({ type: Sprite }) decoration: Sprite = null!
  @property({ type: SpriteFrame }) crownFrame: SpriteFrame = null!
  @property({ type: Label }) valueLabel: Label = null!
  @property({ type: Node }) woodGrain: Node = null!
  private value = 2

  onLoad() { this.setValue(this.value) }

  setValue(value: number) {
    this.value = value
    const wood = value === -1
    this.body.color = new Color(wood ? '#BE7B3C' : levelPieceColor(value))
    this.valueLabel.node.active = !wood
    this.valueLabel.string = wood ? '' : `${value}`
    this.valueLabel.color = new Color(value === 8192 ? '#FFE4A0' : '#FFF9EA')
    this.valueLabel.isBold = false
    this.valueLabel.enableOutline = true
    this.valueLabel.enableShadow = false
    this.valueLabel.outlineColor = new Color(74, 49, 37, 235)
    this.outline.color = new Color(value === 8192 ? '#E8AD2D' : '#4B3528')
    this.highlight.node.active = !wood
    this.highlight.color = new Color(255, 255, 255, 125)
    this.decoration.node.active = !wood && value === 8192
    if (value === 8192) this.decoration.spriteFrame = this.crownFrame
    const size = this.node.getComponent(UITransform)!
    const scale = Math.min(size.width, size.height) / 120, digits = `${value}`.length
    const fontSize = digits >= 5 ? 32 : digits === 4 ? 37 : digits === 3 ? 46 : 56
    const textScale = value === 1024 ? .94 : value === 2048 || value === 4096 ? .9 : value === 8192 ? .86 : 1
    this.valueLabel.fontSize = Math.max(18, Math.round(fontSize * scale * textScale))
    this.valueLabel.lineHeight = this.valueLabel.fontSize
    this.valueLabel.spacingX = Math.round((digits >= 5 ? -5 : digits === 4 ? -4 : digits === 3 ? -2 : 0) * scale)
    this.valueLabel.outlineWidth = Math.max(1, Math.round(2 * scale))
    this.valueLabel.node.setPosition(0, value === 8192 ? -size.height * .08 : 0, 0)
    this.valueLabel.node.getComponent(UITransform)!.setContentSize(size.width * .92, size.height * .72)
    this.woodGrain.active = wood
    if (wood) {
      const g = this.woodGrain.getComponent(Graphics)!
      g.clear(); g.lineWidth = 2.5; g.strokeColor = new Color('#82502D')
      for (const y of [-31, -12, 16, 35]) {
        g.moveTo(-40, y); g.bezierCurveTo(-15, y + 10, 14, y - 12, 40, y + 1); g.stroke()
      }
      g.ellipse(15, -9, 11, 6); g.stroke(); g.ellipse(15, -9, 4, 2); g.stroke()
    }
  }

  getValue() { return this.value }
  getSpriteFrame() { return this.body.spriteFrame }
  getBackgroundColor() { return this.body.color.clone() }
}
