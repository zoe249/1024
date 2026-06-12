import { _decorator, AudioClip, Component, director, SpriteFrame } from 'cc'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from './GameAudioManager'
import { GameShareAdapter } from './GameShareAdapter'

const { ccclass, property } = _decorator

@ccclass('HomeSceneController')
export class HomeSceneController extends Component {
  // 首页点击开始后加载的轻量加载场景，默认对应 assets/scence/loading.scene。
  @property({ tooltip: 'Loading scene name' })
  loadingSceneName = 'loading'

  // Home 页专用背景音乐，进入首页场景后循环播放。
  @property({ type: AudioClip, tooltip: 'Home page background music' })
  homeBgmClip: AudioClip | null = null

  // 旧版首页背景音乐字段，保留用于兼容已经绑定过 startPageBgmClip 的场景。
  @property({ type: AudioClip, tooltip: 'Start page background music' })
  startPageBgmClip: AudioClip | null = null

  // 首页背景图，建议在 home.scene 的层级中维护 Sprite，脚本只做兜底传入。
  @property({ type: SpriteFrame, tooltip: 'Start page background sprite frame' })
  startPageBackgroundSpriteFrame: SpriteFrame | null = null

  // 首页底部排行榜按钮贴图，优先由层级管理器中的按钮节点维护。
  @property({ type: SpriteFrame, tooltip: 'Start page rank button sprite frame' })
  startPageRankButtonSpriteFrame: SpriteFrame | null = null

  // 首页底部设置按钮贴图，优先由层级管理器中的按钮节点维护。
  @property({ type: SpriteFrame, tooltip: 'Start page settings button sprite frame' })
  startPageSettingsButtonSpriteFrame: SpriteFrame | null = null

  // 首页底部分享按钮贴图，优先由层级管理器中的按钮节点维护。
  @property({ type: SpriteFrame, tooltip: 'Start page share button sprite frame' })
  startPageShareButtonSpriteFrame: SpriteFrame | null = null

  private startPageController: StartPageController | null = null
  private audioManager: GameAudioManager | null = null
  private readonly shareAdapter = new GameShareAdapter()
  private isLoadingGameScene = false

  onLoad() {
    this.audioManager = new GameAudioManager(this.node)
    this.audioManager.setup()
    this.startPageController = this.getComponent(StartPageController) ?? this.addComponent(StartPageController)
    this.startPageController.setup({
      onStartTap: () => this.enterGameScene(),
      onShareTap: () => this.shareGameFromStartPage(),
      backgroundSpriteFrame: this.startPageBackgroundSpriteFrame,
      rankButtonSpriteFrame: this.startPageRankButtonSpriteFrame,
      settingsButtonSpriteFrame: this.startPageSettingsButtonSpriteFrame,
      shareButtonSpriteFrame: this.startPageShareButtonSpriteFrame
    })
  }

  start() {
    // 首帧后再同步一次布局，兼容微信安全区和 Creator 预览尺寸变化。
    this.startPageController?.syncLayout()
    this.audioManager?.playStartPageBackgroundMusic(this.getHomeBgmClip())
  }

  // 首页只负责切场景，真正的玩法状态由 game.scene 里的 PlayController 初始化。
  private enterGameScene() {
    if (this.isLoadingGameScene) {
      return
    }

    this.isLoadingGameScene = true
    const sceneName = this.loadingSceneName
    // 点击事件分发结束前直接切场景，部分平台会在销毁按钮节点时触发事件系统空引用。
    // 这里只延后一帧进入轻量加载页，真正的游戏资源由 loading.scene 统一加载。
    this.scheduleOnce(() => director.loadScene(sceneName), 0)
  }

  // Home 页优先使用新字段，旧字段只作为历史场景的兜底资源位。
  private getHomeBgmClip() {
    return this.homeBgmClip ?? this.startPageBgmClip
  }

  // 首页分享还没有本局分数，使用邀请挑战文案更符合入口语境。
  private shareGameFromStartPage() {
    this.shareAdapter.shareStartPage('start_share')
  }
}
