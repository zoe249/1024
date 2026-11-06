import { _decorator, Color, Component, Graphics, Label, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { StageChoice } from './EndlessProgression'

const { ccclass, property } = _decorator
const CHOICES: StageChoice[] = ['diagonal', 'wildcard', 'shuffle']

/** 只负责预制件展示、动画和选择回调，不计算棋盘或修改本局规则。 */
@ccclass('StageChoicePopupController')
export class StageChoicePopupController extends Component {
  @property(Node) panel: Node | null = null
  @property(UIOpacity) maskOpacity: UIOpacity | null = null
  @property(UIOpacity) panelOpacity: UIOpacity | null = null
  @property([Node]) cards: Node[] = []
  @property([Node]) selections: Node[] = []
  @property(Node) confirmNode: Node | null = null
  @property(Label) hint: Label | null = null

  private selected: StageChoice | null = null
  private canShuffle = false
  private shown = false
  private closing = false
  private entering = false
  private disposed = false
  private revision = 0
  private layoutScale = 1
  private hideDone: ((completed: boolean) => void) | null = null
  private chooseHandler: ((choice: StageChoice) => void) | null = null
  private readonly selectDiagonal = () => this.select('diagonal')
  private readonly selectWildcard = () => this.select('wildcard')
  private readonly selectShuffle = () => this.select('shuffle')
  private readonly confirm = () => {
    if (!this.selected || this.closing || !this.shown) return
    this.closing = true
    this.chooseHandler?.(this.selected)
  }

  onLoad() {
    const handlers = [this.selectDiagonal, this.selectWildcard, this.selectShuffle]
    this.cards.forEach((card, i) => card.on(Node.EventType.TOUCH_END, handlers[i], this))
    this.confirmNode?.on(Node.EventType.TOUCH_END, this.confirm, this)
  }

  setup(choose: (choice: StageChoice) => void) { this.chooseHandler = choose }

  show(canShuffle: boolean) {
    if (this.disposed || !this.panel?.isValid || this.shown) return
    this.shown = true; this.closing = false; this.entering = true; this.canShuffle = canShuffle; this.selected = null
    this.node.active = true
    this.syncLayout()
    this.renderSelection()
    const scale = this.layoutScale
    this.panel.setPosition(0, -28, 0)
    this.panel.setScale(scale * 0.88, scale * 0.88, 1)
    if (this.maskOpacity) this.maskOpacity.opacity = 0
    if (this.panelOpacity) this.panelOpacity.opacity = 0
    this.drawMask()
    if (this.maskOpacity) tween(this.maskOpacity).to(0.20, { opacity: 155 }, { easing: 'sineOut', onUpdate: () => this.drawMask() }).start()
    if (this.panelOpacity) tween(this.panelOpacity).to(0.16, { opacity: 255 }).start()
    tween(this.panel).to(0.24, { position: Vec3.ZERO, scale: new Vec3(scale * 1.025, scale * 1.025, 1) }, { easing: 'cubicOut' })
      .to(0.10, { scale: new Vec3(scale, scale, 1) }, { easing: 'sineOut' })
      .call(() => { if (!this.disposed && this.node?.isValid) this.entering = false }).start()
  }

  syncLayout() {
    if (this.disposed || !this.node.isValid || !this.panel?.isValid) return
    const parent = this.node.parent?.getComponent(UITransform) ?? this.node.parent?.parent?.getComponent(UITransform)
    const width = parent?.width ?? 750, height = parent?.height ?? 1334
    this.node.getComponent(UITransform)?.setContentSize(width, height)
    this.maskOpacity?.node.getComponent(UITransform)?.setContentSize(width, height)
    this.drawMask()
    this.layoutScale = Math.min(1, (width - 32) / 680, (height - 100) / 970)
    if (!this.closing) this.panel.setScale(this.layoutScale, this.layoutScale, 1)
  }

  /** Creator 3.8 的 Graphics 顶点色不跟随 UIOpacity，遮罩需同步重绘自身 Alpha。 */
  private drawMask() {
    if (!this.maskOpacity?.isValid || !this.maskOpacity.node?.isValid) return
    const mask = this.maskOpacity.node.getComponent(Graphics)
    const size = this.node.getComponent(UITransform)
    if (!mask || !size) return
    mask.clear()
    mask.fillColor = new Color(25, 21, 15, this.maskOpacity.opacity)
    mask.rect(-size.width / 2, -size.height / 2, size.width, size.height)
    mask.fill()
  }

  private select(choice: StageChoice) {
    if (this.disposed || !this.shown || this.closing || this.entering || (choice === 'shuffle' && !this.canShuffle)) return
    this.selected = choice
    this.renderSelection()
    const card = this.cards[CHOICES.indexOf(choice)]
    if (!card?.isValid) return
    Tween.stopAllByTarget(card)
    tween(card).to(0.07, { scale: new Vec3(0.975, 0.975, 1) }).to(0.12, { scale: Vec3.ONE }, { easing: 'sineOut' }).start()
  }

  private renderSelection() {
    this.selections.forEach((node, i) => { if (node.isValid) node.active = CHOICES[i] === this.selected })
    const confirmOpacity = this.confirmNode?.getComponent(UIOpacity)
    if (confirmOpacity) confirmOpacity.opacity = this.selected ? 255 : 130
    const shuffleOpacity = this.cards[2]?.getComponent(UIOpacity)
    if (shuffleOpacity) shuffleOpacity.opacity = this.canShuffle ? 255 : 110
    if (this.hint?.isValid) this.hint.string = this.canShuffle ? '选择一项效果，继续挑战' : '当前盘面无需打乱，请选择持续增益'
  }

  hide(): Promise<boolean> {
    if (this.disposed || !this.panel?.isValid) return Promise.resolve(false)
    if (!this.shown) return Promise.resolve(true)
    this.closing = true
    const revision = ++this.revision
    this.stopAnimations()
    const previous = this.hideDone; this.hideDone = null; previous?.(false)
    return new Promise(resolve => {
      this.hideDone = resolve
      if (this.maskOpacity?.isValid) tween(this.maskOpacity).to(0.18, { opacity: 0 }, { onUpdate: () => this.drawMask() }).start()
      if (this.panelOpacity?.isValid) tween(this.panelOpacity).to(0.16, { opacity: 0 }).start()
      tween(this.panel).to(0.18, { position: new Vec3(0, 18, 0), scale: new Vec3(this.layoutScale * 0.94, this.layoutScale * 0.94, 1) }, { easing: 'quadIn' })
        .call(() => {
          if (this.disposed || !this.isValid || !this.node?.isValid || revision !== this.revision) return
          this.node.active = false; this.shown = false; this.closing = false
          const done = this.hideDone; this.hideDone = null; done?.(true)
        }).start()
    })
  }

  private stopAnimations() {
    if (this.panel?.isValid) Tween.stopAllByTarget(this.panel)
    if (this.maskOpacity?.isValid) Tween.stopAllByTarget(this.maskOpacity)
    if (this.panelOpacity?.isValid) Tween.stopAllByTarget(this.panelOpacity)
    for (const card of this.cards ?? []) if (card?.isValid) Tween.stopAllByTarget(card)
  }

  suspend() {
    if (this.disposed) return
    this.revision++
    this.stopAnimations()
    this.shown = false; this.closing = false; this.entering = false
    if (this.node?.isValid) this.node.active = false
    const done = this.hideDone; this.hideDone = null; done?.(false)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true; this.revision++
    this.stopAnimations()
    const handlers = [this.selectDiagonal, this.selectWildcard, this.selectShuffle]
    for (let i = 0; i < (this.cards?.length ?? 0); i++) {
      const card = this.cards[i]
      if (card?.isValid) card.off(Node.EventType.TOUCH_END, handlers[i], this)
    }
    if (this.confirmNode?.isValid) this.confirmNode.off(Node.EventType.TOUCH_END, this.confirm, this)
    this.chooseHandler = null
    const done = this.hideDone; this.hideDone = null; done?.(false)
  }

  onDestroy() { this.dispose() }
}
