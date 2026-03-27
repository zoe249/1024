import {
  _decorator,
  Color,
  Component,
  Label,
  LabelShadow,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2
} from 'cc'

const { ccclass } = _decorator

type PieceStyle = {
  bg: string
}

const DEFAULT_STYLE: PieceStyle = {
  bg: '#ff89d1'
}

const PIECE_STYLE: Record<number, PieceStyle> = {
  2: { bg: '#ff89d1' },
  4: { bg: '#7c55fa' },
  8: { bg: '#a55fd4' },
  16: { bg: '#14e2de' },
  32: { bg: '#62ccfe' },
  64: { bg: '#89e66c' },
  128: { bg: '#f87275' },
  256: { bg: '#a46f62' },
  512: { bg: '#8d949c' },
  1024: { bg: '#ffb659' }
}

@ccclass('PieceController')
export class PieceController extends Component {
  private value = 2
  private sprite: Sprite | null = null
  private valueLabel: Label | null = null
  private valueTransform: UITransform | null = null
  private currentBgColor = new Color(53, 80, 107, 255)
  private currentTextColor = new Color(245, 250, 255, 255)

  onLoad() {
    this.sprite = this.node.getComponent(Sprite)
    const valueNode = this.node.getChildByName('Value')
    this.valueLabel = valueNode?.getComponent(Label) ?? null
    this.valueTransform = valueNode?.getComponent(UITransform) ?? null
    this.ensureLabelEffects()
    this.refreshView()
  }

  getValue() {
    return this.value
  }

  getSpriteFrame(): SpriteFrame | null {
    return this.sprite?.spriteFrame ?? null
  }

  getBackgroundColor() {
    return this.currentBgColor.clone()
  }

  getTextColor() {
    return this.currentTextColor.clone()
  }

  setValue(value: number) {
    this.value = value
    this.refreshView()
  }

  private ensureLabelEffects() {
    if (!this.valueLabel) {
      return
    }

    const shadow = this.valueLabel.getComponent(LabelShadow) ?? this.valueLabel.addComponent(LabelShadow)
    shadow.offset = new Vec2(0, 0)
    shadow.blur = 0
    shadow.color = new Color(255, 255, 255, 0)

    this.valueLabel.fontFamily = 'Courier New'
    this.valueLabel.isBold = true
  }

  private refreshView() {
    const style = PIECE_STYLE[this.value] ?? DEFAULT_STYLE
    this.currentBgColor = this.fromHex(style.bg)
    this.currentTextColor = new Color(255, 255, 255, 255)

    if (this.sprite) {
      this.sprite.color = this.currentBgColor
    }

    if (!this.valueLabel) {
      return
    }

    const digits = `${this.value}`.length
    this.valueLabel.string = `${this.value}`
    this.valueLabel.color = this.currentTextColor
    this.valueLabel.fontSize = digits >= 5 ? 40 : digits === 4 ? 52 : digits === 3 ? 64 : 76
    this.valueLabel.lineHeight = this.valueLabel.fontSize
    this.valueLabel.spacingX = digits >= 5 ? -6 : digits === 4 ? -4 : digits === 3 ? -2 : 0

    if (this.valueTransform) {
      const width = digits >= 5 ? 120 : digits === 4 ? 116 : digits === 3 ? 110 : 104
      const height = digits >= 4 ? 88 : 96
      this.valueTransform.setContentSize(width, height)
    }
  }

  private fromHex(hex: string) {
    const color = new Color()
    Color.fromHEX(color, hex)
    return color
  }
}
