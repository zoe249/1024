import { _decorator, Color, Component, game, Game, Graphics, Label, Node, Sprite, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { OvertakeView } from '../online/leaderboard/OvertakeRivalStore'
import { PlayerAvatarRenderer } from '../profile/PlayerAvatarRenderer'

const { ccclass, property } = _decorator
const INK = new Color(98, 57, 31, 255)
const LEAF = new Color(84, 141, 46, 255)
type Target = NonNullable<OvertakeView>
type Slot = { node: Node; opacity: UIOpacity; avatarRoot: Node; renderer: PlayerAvatarRenderer; border: Graphics; name: Label; score: Label }

/** 固定分数字框与独立双槽目标；异步预备完成后再成组交替。 */
@ccclass('OvertakeTargetWidget')
export class OvertakeTargetWidget extends Component {
  @property(Label) currentScoreLabel: Label | null = null
  @property(Node) targetViewport: Node | null = null
  @property([Node]) targetSlots: Node[] = []
  @property(Node) topContent: Node | null = null
  private slots: Slot[] = []
  private desired: OvertakeView = null
  private displayed: OvertakeView = null
  private prepared: { target: Target; index: number } | null = null
  private currentSlot = 0
  private generation = 0
  private preparingKey = ''
  private moving = false
  private disposed = false
  private entryStarted = false
  private exitFinished = false
  private suspended = false
  private foreground = true
  private targetFits = true
  private score = -1
  private readonly counter = { value: 0 }
  private readonly reducedMotion = (globalThis as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  private readonly onHide = () => { this.foreground = false; this.settle() }
  private readonly onShow = () => { this.foreground = true; this.refreshTarget(false) }

  initialize(): boolean {
    if (!this.currentScoreLabel || !this.targetViewport || !this.topContent || this.targetSlots.length !== 2) return false
    if (this.slots.length) return true
    for (const node of this.targetSlots) {
      const avatarRoot = node.getChildByName('Avatar')
      const sprite = avatarRoot?.getChildByName('Image')?.getComponent(Sprite)
      const name = node.getChildByName('Name')?.getComponent(Label)
      const score = node.getChildByName('Score')?.getComponent(Label)
      const border = avatarRoot?.getChildByName('Frame')?.getComponent(Graphics)
      if (!avatarRoot || !sprite || !name || !score || !border) { this.dispose(); return false }
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
      this.slots.push({ node, opacity, avatarRoot, renderer: new PlayerAvatarRenderer(sprite), border, name, score })
      this.drawBorder(border, INK)
      node.active = false
    }
    this.topContent.active = false
    return true
  }

  onEnable() {
    game.on(Game.EVENT_HIDE, this.onHide, this)
    game.on(Game.EVENT_SHOW, this.onShow, this)
    if (this.slots.length) this.refreshTarget(false)
  }

  render(view: OvertakeView, score: number, suspended = false) {
    const nextScore = Math.max(0, Math.floor(score))
    if (nextScore !== this.score && this.currentScoreLabel) {
      const immediate = this.score < 0 || nextScore < this.score || suspended || !this.foreground || this.reducedMotion
      this.score = nextScore
      Tween.stopAllByTarget(this.counter)
      if (immediate) { this.counter.value = nextScore; this.currentScoreLabel.string = `${nextScore}` }
      else tween(this.counter).to(0.22, { value: nextScore }, {
        easing: 'quadOut', onUpdate: () => { if (this.currentScoreLabel?.isValid) this.currentScoreLabel.string = `${Math.round(this.counter.value)}` }
      }).start()
    }
    const wasSuspended = this.suspended
    this.suspended = suspended
    this.desired = view
    if (suspended && !wasSuspended) this.settle()
    this.refreshTarget(!suspended && this.foreground)
  }

  setTargetFits(fits: boolean) {
    if (this.targetFits === fits) return
    this.targetFits = fits
    if (!fits) this.settle()
    this.refreshTarget(false)
  }

  onDisable() {
    game.off(Game.EVENT_HIDE, this.onHide, this)
    game.off(Game.EVENT_SHOW, this.onShow, this)
    this.stopMotion()
    Tween.stopAllByTarget(this.counter)
    this.counter.value = Math.max(0, this.score)
    if (this.currentScoreLabel?.isValid) this.currentScoreLabel.string = `${this.counter.value}`
    for (const slot of this.slots) slot.renderer.clear()
    this.displayed = null
    this.prepared = null
  }

  onDestroy() { this.dispose() }

  dispose() {
    // 父组件移除与本组件销毁都可能触发释放，头像和动画只能清理一次。
    if (this.disposed || !this.isValid) return
    this.disposed = true
    this.onDisable()
    for (const slot of this.slots) slot.renderer.dispose()
    this.slots = []
    this.desired = this.displayed = null
    this.prepared = null
  }

  private stopMotion() {
    this.generation += 1
    this.preparingKey = ''
    this.moving = false
    this.entryStarted = this.exitFinished = false
    for (const slot of this.slots) {
      if (!slot.node.isValid) continue
      Tween.stopAllByTarget(slot.node)
      Tween.stopAllByTarget(slot.opacity)
      Tween.stopAllByTarget(slot.avatarRoot)
      slot.node.setPosition(0, 0, 0)
      slot.opacity.opacity = 255
      slot.avatarRoot.setScale(Vec3.ONE)
      this.drawBorder(slot.border, INK)
    }
    if (this.topContent?.isValid) {
      Tween.stopAllByTarget(this.topContent)
      const opacity = this.topContent.getComponent(UIOpacity)
      if (opacity) { Tween.stopAllByTarget(opacity); opacity.opacity = 255 }
      this.topContent.setPosition(0, 0, 0)
    }
  }

  private settle() {
    this.stopMotion()
    Tween.stopAllByTarget(this.counter)
    this.counter.value = Math.max(0, this.score)
    if (this.currentScoreLabel?.isValid) this.currentScoreLabel.string = `${this.counter.value}`
    if (this.prepared?.target.key === this.desired?.key) this.showDirect(this.prepared.target, this.prepared.index)
    else if (this.displayed) this.showDirect(this.displayed, this.currentSlot)
    this.refreshTarget(false)
  }

  private refreshTarget(allowAnimation: boolean) {
    if (!this.slots.length || !this.targetViewport || !this.topContent) return
    if (!this.desired || !this.targetFits) {
      this.stopMotion()
      this.targetViewport.active = false
      this.displayed = null
      this.prepared = null
      for (const slot of this.slots) { slot.node.active = false; slot.renderer.clear() }
      this.topContent.active = false
      return
    }
    this.targetViewport.active = true
    if ((this.moving && this.entryStarted) || this.preparingKey === this.desired.key || this.displayed?.revision === this.desired.revision) return
    if (this.moving && this.prepared?.target.key === this.desired.key) return
    const next = this.desired
    const generation = ++this.generation
    this.preparingKey = next.key
    const index = this.displayed ? 1 - this.currentSlot : this.currentSlot
    const slot = this.slots[index]
    slot.node.active = false
    this.prepared = null
    const ready = next.kind === 'top' ? Promise.resolve() : this.prepare(slot, next)
    void ready.then(() => {
      if (!this.isValid || !this.node.isValid || !this.enabledInHierarchy || generation !== this.generation) return
      this.preparingKey = ''
      this.prepared = { target: next, index }
      if (this.moving) { if (this.exitFinished) this.startIncoming(); return }
      const animate = !!(allowAnimation && !this.reducedMotion && !this.suspended && this.foreground && next.animate && this.displayed && this.displayed.kind !== 'top' && this.score > this.displayed.value)
      if (!animate) { this.showDirect(next, index); return }
      this.playSwap()
    }).catch(() => { if (generation === this.generation) this.preparingKey = '' })
  }

  private async prepare(slot: Slot, target: Exclude<Target, { kind: 'top' }>) {
    const nameWidth = this.setNickname(slot.name, target.name)
    slot.score.string = `${target.value}`
    const scoreTransform = slot.score.node.getComponent(UITransform)!
    const width = scoreTransform.width
    const height = scoreTransform.height
    slot.score.overflow = Label.Overflow.NONE
    slot.score.updateRenderData(true)
    const scoreWidth = Math.min(width, scoreTransform.width)
    slot.score.overflow = Label.Overflow.SHRINK
    scoreTransform.setContentSize(width, height)
    // 文字靠同一右边缘，头像贴近实际字宽，短分数也不会留下大段空隙。
    const right = slot.score.node.position.x + width * (1 - scoreTransform.anchorX)
    const avatarHalfWidth = slot.avatarRoot.getComponent(UITransform)!.width * 0.5
    slot.avatarRoot.setPosition(right - Math.max(nameWidth, scoreWidth) - 16 - avatarHalfWidth, 0, 0)
    await slot.renderer.render(target.avatar)
  }

  private showDirect(target: Target, index: number) {
    for (const slot of this.slots) slot.node.active = false
    this.topContent!.active = target.kind === 'top'
    if (target.kind !== 'top') this.slots[index].node.active = true
    this.currentSlot = index
    this.displayed = target
  }

  private playSwap() {
    this.moving = true
    this.entryStarted = this.exitFinished = false
    const old = this.slots[this.currentSlot]
    this.drawBorder(old.border, LEAF)
    tween(old.avatarRoot).to(0.07, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'quadOut' })
      .to(0.07, { scale: Vec3.ONE }, { easing: 'quadIn' }).start()
    tween(old.opacity).delay(0.14).to(0.14, { opacity: 0 }, { easing: 'cubicOut' }).start()
    tween(old.node).delay(0.14).call(() => this.drawBorder(old.border, INK))
      .to(0.14, { position: new Vec3(0, 20, 0) }, { easing: 'cubicOut' })
      .call(() => {
        old.node.setPosition(0, 0, 0)
        old.opacity.opacity = 255
        this.exitFinished = true
        this.startIncoming()
      }).start()
  }

  private startIncoming() {
    const prepared = this.prepared
    if (!prepared || prepared.target.key !== this.desired?.key || this.entryStarted) return
    this.entryStarted = true
    const { target, index } = prepared
    const old = this.slots[this.currentSlot]
    const incoming = target.kind === 'top' ? this.topContent! : this.slots[index].node
    const opacity = incoming.getComponent(UIOpacity) ?? incoming.addComponent(UIOpacity)
    old.node.active = false
    old.renderer.clear()
    incoming.setPosition(0, -20, 0)
    opacity.opacity = 0
    incoming.active = true
    tween(opacity).to(0.11, { opacity: 255 }).start()
    tween(incoming).to(0.22, { position: Vec3.ZERO }, { easing: 'backOut' }).call(() => {
      this.moving = false
      this.entryStarted = this.exitFinished = false
      this.showDirect(target, index)
      this.refreshTarget(true)
    }).start()
  }

  private drawBorder(graphics: Graphics, color: Color) {
    if (!graphics.isValid) return
    graphics.clear()
    graphics.strokeColor = color
    graphics.lineWidth = 2
    graphics.circle(0, 0, 25)
    graphics.stroke()
  }

  private setNickname(label: Label, name: string) {
    const transform = label.node.getComponent(UITransform)!
    label.overflow = Label.Overflow.NONE
    const characters = Array.from(name)
    label.string = name
    label.updateRenderData(true)
    while (transform.width > 176 && characters.length) {
      characters.pop()
      label.string = `${characters.join('')}...`
      label.updateRenderData(true)
    }
    const width = Math.min(176, transform.width)
    label.overflow = Label.Overflow.CLAMP
    transform.setContentSize(176, 26)
    return width
  }
}
