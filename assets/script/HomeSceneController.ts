import { _decorator, AudioClip, Component, director, Prefab, SpriteFrame } from 'cc'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from './GameAudioManager'
import { GameShareAdapter } from './GameShareAdapter'

const { ccclass, property } = _decorator

// 首页资源条按设计稿默认展示 3/4 体力和 99,999 金币，后续存档或商城系统可统一覆盖。
const INITIAL_ENERGY = 3
const MAX_ENERGY = 4
const INITIAL_COINS = 99999

@ccclass('HomeSceneController')
export class HomeSceneController extends Component {
  // 首页点击开始后加载的轻量加载场景，默认对应 assets/scence/loading.scene。
  @property({ tooltip: 'Loading scene name' })
  loadingSceneName = 'loading'

  // loading 预加载完成后进入的玩法场景名，loadingSceneName 为空时也会作为安全兜底。
  @property({ tooltip: 'Game scene name' })
  gameSceneName = 'game'

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

  // 体力条与金币条是首页大厅组件，不再进入 game.scene 的单局 HUD。
  @property({ type: Prefab, tooltip: 'Home energy bar prefab' })
  energyBarPrefab: Prefab | null = null

  @property({ type: Prefab, tooltip: 'Home coin bar prefab' })
  coinBarPrefab: Prefab | null = null

  private startPageController: StartPageController | null = null
  private audioManager: GameAudioManager | null = null
  private readonly shareAdapter = new GameShareAdapter()
  private isLoadingGameScene = false
  // 玩家资源由首页逻辑层持有，StartPageController 只负责展示和发送加号点击意图。
  private currentEnergy = INITIAL_ENERGY
  private maxEnergy = MAX_ENERGY
  private coinCount = INITIAL_COINS

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
      shareButtonSpriteFrame: this.startPageShareButtonSpriteFrame,
      energyBarPrefab: this.energyBarPrefab,
      coinBarPrefab: this.coinBarPrefab,
      energy: this.currentEnergy,
      maxEnergy: this.maxEnergy,
      coins: this.coinCount,
      onEnergyMoreTap: () => this.requestEnergyStoreFromUi(),
      onCoinMoreTap: () => this.requestCoinStoreFromUi()
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
    const sceneName = this.getStartTargetSceneName()
    // 点击事件分发结束前直接切场景，部分平台会在销毁按钮节点时触发事件系统空引用。
    // 这里只延后一帧进入目标场景，每次从首页开始都先展示一条随机加载提示。
    this.scheduleOnce(() => director.loadScene(sceneName), 0)
  }

  // 每次从首页进入游戏都走 loading；若场景名未配置，再直接进入玩法场景兜底。
  private getStartTargetSceneName() {
    return this.loadingSceneName || this.gameSceneName
  }

  // Home 页优先使用新字段，旧字段只作为历史场景的兜底资源位。
  private getHomeBgmClip() {
    return this.homeBgmClip ?? this.startPageBgmClip
  }

  /**
   * 由登录、商城或存档系统统一更新首页玩家资源。
   *
   * 这里完成整数化和边界收口，避免外部数据让体力槽或金币文本进入非法状态；
   * 首页 UI 只接收整理后的纯数值，不直接修改资源。
   */
  public setPlayerResources(energy: number, maxEnergy: number, coins: number) {
    this.maxEnergy = Math.max(1, Math.floor(maxEnergy))
    this.currentEnergy = Math.min(this.maxEnergy, Math.max(0, Math.floor(energy)))
    this.coinCount = Math.max(0, Math.floor(coins))
    this.startPageController?.renderPlayerResources(this.currentEnergy, this.maxEnergy, this.coinCount)
  }

  // 加号只向外发送商城入口意图，避免在商城尚未接入时凭空赠送资源。
  private requestEnergyStoreFromUi() {
    this.node.emit('request-energy-store')
  }

  private requestCoinStoreFromUi() {
    this.node.emit('request-coin-store')
  }

  // 首页分享还没有本局分数，使用邀请挑战文案更符合入口语境。
  private shareGameFromStartPage() {
    this.shareAdapter.shareStartPage('start_share')
  }
}
