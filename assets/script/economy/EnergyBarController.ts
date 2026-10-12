import { _decorator, Component, EventTouch, Label, Node, tween, Tween, UIOpacity, Vec3 } from 'cc'
import type { EnergyBarState } from './PlayerEconomyStore'

const { ccclass, property } = _decorator

/** 只渲染经济层的纯展示状态，获取方式由首页业务入口决定。 */
@ccclass('EnergyBarController')
export class EnergyBarController extends Component {
  @property(Label) valueLabel: Label | null = null
  @property(Node) recoveryTab: Node | null = null
  @property(Label) countdownLabel: Label | null = null
  @property(Label) fullLabel: Label | null = null
  @property(Label) gainFeedback: Label | null = null
  onAcquireTap: (() => void) | null = null
  private gainFeedbackOrigin: Vec3 | null = null

  onLoad() { this.gainFeedbackOrigin = this.gainFeedback?.node.position.clone() ?? null }

  onEnable() { this.node.on(Node.EventType.TOUCH_END, this.handleAcquireTap, this) }
  onDisable() {
    this.node.off(Node.EventType.TOUCH_END, this.handleAcquireTap, this)
    this.stopFeedback()
  }
  onDestroy() { this.onAcquireTap = null }

  renderState(state: EnergyBarState) {
    const value = `${state.energy}/${state.maxEnergy}`
    if (this.valueLabel && this.valueLabel.string !== value) this.valueLabel.string = value
    const full = state.status === 'full'
    if (this.recoveryTab) this.recoveryTab.active = !full
    if (this.fullLabel) this.fullLabel.node.active = full
    const seconds = state.remainingSeconds
    const minutes = seconds === null ? 0 : Math.floor(seconds / 60)
    const remainder = seconds === null ? 0 : seconds % 60
    const text = seconds === null ? '--:--' : `${minutes < 10 ? '0' : ''}${minutes}:${remainder < 10 ? '0' : ''}${remainder}`
    if (this.countdownLabel && this.countdownLabel.string !== text) this.countdownLabel.string = text
  }

  playGainFeedback(amount = 1) {
    const label = this.gainFeedback
    if (!label || !this.node.activeInHierarchy) return
    this.stopFeedback()
    const node = label.node
    label.string = `+${amount}`
    node.active = true
    const origin = this.gainFeedbackOrigin ?? node.position.clone()
    this.gainFeedbackOrigin = origin
    node.setPosition(origin)
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)
    opacity.opacity = 255
    tween(node).to(0.65, { position: new Vec3(origin.x, origin.y + 27, origin.z) }, { easing: 'quadOut' }).start()
    tween(opacity).delay(0.25).to(0.4, { opacity: 0 }).call(() => { if (node.isValid) node.active = false }).start()
  }

  private stopFeedback() {
    const node = this.gainFeedback?.node
    if (!node?.isValid) return
    Tween.stopAllByTarget(node)
    const opacity = node.getComponent(UIOpacity)
    if (opacity) Tween.stopAllByTarget(opacity)
    node.active = false
  }

  private handleAcquireTap(event: EventTouch) {
    event.propagationStopped = true
    this.onAcquireTap?.()
  }
}
