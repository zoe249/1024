import type { PieceAppearance } from '../appearance/AppearanceTypes'
import type { PieceAppearanceFrames } from './GameAppearance'
// 保留 Prefab 的序列化入口与棋子数值，具体图层交给 PieceAppearanceView。
import { _decorator, Component, SpriteFrame } from 'cc'
import { PieceAppearanceView } from './PieceAppearanceView'

const { ccclass, property } = _decorator

@ccclass('PieceController')
export class PieceController extends Component {
  @property({ type: SpriteFrame, tooltip: '128 以上棋子使用的星点装饰' })
  sparkleSpriteFrame: SpriteFrame | null = null

  @property({ type: SpriteFrame, tooltip: '8192 及以上棋子使用的皇冠装饰' })
  crownSpriteFrame: SpriteFrame | null = null

  private value = 2
  private appearanceView: PieceAppearanceView | null = null

  onLoad() {
    this.getAppearanceView().initialize()
  }

  /** 新建棋子紧接着设值，可合并刷新；已有棋子替换外观则立即更新所有图层。 */
  applyAppearance(appearance: PieceAppearance, frames: PieceAppearanceFrames = {}, refresh = true) {
    this.getAppearanceView().applyAppearance(appearance, frames, refresh)
  }

  getValue() { return this.value }

  setValue(value: number) {
    this.value = value
    this.getAppearanceView().setValue(value)
  }

  syncLayout(force = false) { this.getAppearanceView().syncLayout(force) }
  syncTrailEffect(force = false) { this.syncLayout(force) }
  stopParticle() { this.getAppearanceView().stopParticle() }
  getSpriteFrame(): SpriteFrame | null { return this.appearanceView?.getSpriteFrame() ?? null }
  getBackgroundColor() { return this.getAppearanceView().getBackgroundColor() }
  getTextColor() { return this.getAppearanceView().getTextColor() }

  private getAppearanceView() {
    if (!this.appearanceView) {
      this.appearanceView = new PieceAppearanceView(this.node, this.sparkleSpriteFrame, this.crownSpriteFrame)
    }
    return this.appearanceView
  }

  onDestroy() { this.appearanceView = null }
}
