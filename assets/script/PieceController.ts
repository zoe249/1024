import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  LabelShadow,
  Node,
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

// colors follow the skill definition in my-skills/sklii.md
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
  private static readonly CORNER_RADIUS = 8

  private value = 2
  private sprite: Sprite | null = null
  private bodyGraphics: Graphics | null = null
  private valueLabel: Label | null = null
  private valueTransform: UITransform | null = null
  private currentBgColor = new Color(53, 80, 107, 255)
  private currentTextColor = new Color(245, 250, 255, 255)

  onLoad() {
    this.sprite = this.ensureRoundedBody()
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
    // keep label appearance consistent across digits
  }

  // ensure there is a dedicated body node that draws the rounded background
  private ensureRoundedBody() {
    const rootTransform = this.node.getComponent(UITransform)
    const sourceSprite = this.node.getComponent(Sprite)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? 120

    let body = this.node.getChildByName('Body')
    if (!body) {
      body = new Node('Body')
      body.setParent(this.node)
      body.setSiblingIndex(0)
    }

    const bodyTransform = body.getComponent(UITransform) ?? body.addComponent(UITransform)
    bodyTransform.setContentSize(width, height)

    const graphics = body.getComponent(Graphics) ?? body.addComponent(Graphics)
    this.bodyGraphics = graphics

    if (sourceSprite) {
      sourceSprite.enabled = false
    }

    return sourceSprite
  }

  // redraws the Graphics component each time the color or size changes
  private redrawRoundedBody() {
    if (!this.bodyGraphics) {
      return
    }

    const rootTransform = this.node.getComponent(UITransform)
    const width = rootTransform?.contentSize.width ?? 120
    const height = rootTransform?.contentSize.height ?? 120
    const radius = Math.min(PieceController.CORNER_RADIUS, width * 0.5, height * 0.5)

    this.bodyGraphics.clear()
    this.bodyGraphics.fillColor = this.currentBgColor
    this.bodyGraphics.roundRect(-width * 0.5, -height * 0.5, width, height, radius)
    this.bodyGraphics.fill()
  }

  private refreshView() {
    const style = PIECE_STYLE[this.value] ?? DEFAULT_STYLE
    this.currentBgColor = this.fromHex(style.bg)
    this.currentTextColor = new Color(255, 255, 255, 255)

    this.redrawRoundedBody()

    if (!this.valueLabel) {
      return
    }

    const digits = `${this.value}`.length
    const blockSize = this.node.getComponent(UITransform)?.contentSize.width ?? 120
    const scale = blockSize / 120
    this.valueLabel.string = `${this.value}`
    this.valueLabel.color = this.currentTextColor
    // Scale the label with the block so smaller board pieces still fit cleanly.
    const baseFontSize = digits >= 5 ? 40 : digits === 4 ? 52 : digits === 3 ? 64 : 76
    this.valueLabel.fontSize = Math.round(baseFontSize * scale)
    this.valueLabel.lineHeight = this.valueLabel.fontSize
    this.valueLabel.spacingX = Math.round((digits >= 5 ? -6 : digits === 4 ? -4 : digits === 3 ? -2 : 0) * scale)

    if (this.valueTransform) {
      // adjust label bounds so multi-digit numbers stay within the block
      const width = Math.min(
        blockSize,
        Math.round((digits >= 5 ? 120 : digits === 4 ? 116 : digits === 3 ? 110 : 104) * scale)
      )
      const height = Math.round((digits >= 4 ? 88 : 96) * scale)
      this.valueTransform.setContentSize(width, height)
    }
  }

  private fromHex(hex: string) {
    const color = new Color()
    Color.fromHEX(color, hex)
    return color
  }
}
