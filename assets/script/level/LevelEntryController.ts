import { _decorator, Button, Component, director, Label, Node } from 'cc'
import { LevelProgressStore } from './LevelProgressStore'

const { ccclass, property } = _decorator

@ccclass('LevelEntryController')
export class LevelEntryController extends Component {
  @property({ type: Label }) titleLabel: Label = null!
  @property({ type: Node }) endlessButton: Node = null!
  private opening = false
  private alive = true

  onLoad() {
    this.titleLabel.string = `继续闯关 · 第${LevelProgressStore.currentLevelId()}关`
    this.node.on(Button.EventType.CLICK, this.enter, this)
  }

  lateUpdate() {
    // 入口跟随首页已有的主按钮布局，不接管首页其他节点。
    if (this.endlessButton?.isValid) this.node.setPosition(0, this.endlessButton.position.y + 132, 0)
  }

  private enter() {
    if (this.opening) return
    this.opening = true
    const accepted = director.loadScene('level', error => {
      if (!error || !this.alive || !this.isValid || !this.node?.isValid) return
      this.opening = false; this.titleLabel.string = '加载失败，点击重试'
    })
    if (accepted === false) { this.opening = false; this.titleLabel.string = '加载失败，点击重试' }
  }

  onDestroy() {
    this.alive = false
    if (this.node?.isValid) this.node.off(Button.EventType.CLICK, this.enter, this)
  }
}
