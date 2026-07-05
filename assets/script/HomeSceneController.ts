import { _decorator, AudioClip, Component, director, Prefab, SpriteFrame } from 'cc'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from './GameAudioManager'
import { GameShareAdapter } from './GameShareAdapter'
import { PlayerEconomyStore } from './PlayerEconomyStore'

const { ccclass, property } = _decorator

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

  // 首页只展示体力条；金币条由 game.scene 的单局 HUD 负责。
  @property({ type: Prefab, tooltip: 'Home energy bar prefab' })
  energyBarPrefab: Prefab | null = null

  private startPageController: StartPageController | null = null
  private audioManager: GameAudioManager | null = null
  private readonly shareAdapter = new GameShareAdapter()
  private readonly economy = PlayerEconomyStore.getInstance()
  private isLoadingGameScene = false
  private dailyLoginReward = 0

  onLoad() {
    this.audioManager = new GameAudioManager(this.node)
    this.audioManager.setup()
    const dailyResult = this.economy.claimDailyLogin()
    this.dailyLoginReward = dailyResult.claimed ? dailyResult.amount : 0
    const resources = this.economy.getSnapshot()
    this.startPageController = this.getComponent(StartPageController) ?? this.addComponent(StartPageController)
    this.startPageController.setup({
      onStartTap: () => this.enterGameScene(),
      onShareTap: () => this.shareGameFromStartPage(),
      backgroundSpriteFrame: this.startPageBackgroundSpriteFrame,
      rankButtonSpriteFrame: this.startPageRankButtonSpriteFrame,
      settingsButtonSpriteFrame: this.startPageSettingsButtonSpriteFrame,
      shareButtonSpriteFrame: this.startPageShareButtonSpriteFrame,
      energyBarPrefab: this.energyBarPrefab,
      energy: resources.energy,
      maxEnergy: resources.maxEnergy,
      onEnergyMoreTap: () => void this.shareForEnergyReward()
    })
  }

  start() {
    // 首帧后再同步一次布局，兼容微信安全区和 Creator 预览尺寸变化。
    this.startPageController?.syncLayout()
    this.audioManager?.playStartPageBackgroundMusic(this.getHomeBgmClip())
    if (this.dailyLoginReward > 0) {
      this.startPageController?.showMessage(`每日登录奖励：金币 +${this.dailyLoginReward}`)
    }
  }

  // 开始游戏前由经济层统一扣除体力，扣除失败时停留首页并给出补充入口提示。
  private enterGameScene() {
    if (this.isLoadingGameScene) {
      return
    }
    if (!this.economy.tryConsumeEnergy()) {
      this.startPageController?.showMessage('体力不足，点击体力条分享补充')
      return
    }

    this.isLoadingGameScene = true
    this.refreshPlayerResources()
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
   * 点击顶部资源 Prefab 后完成分享并领取对应资源。
   * 分享不限制每日次数；经济层只负责体力上限校验和成功后的持久化。
   */
  private async shareForEnergyReward() {
    if (!this.economy.canClaimShareReward('energy')) {
      this.startPageController?.showMessage('体力已满，无需补充')
      return
    }

    const result = await this.shareAdapter.shareReward('energy')
    if (!this.node.isValid) {
      return
    }
    if (result === 'cancelled') {
      this.startPageController?.showMessage('分享未完成，未发放奖励')
      return
    }
    if (result === 'unsupported') {
      this.startPageController?.showMessage('当前平台暂不支持分享奖励')
      return
    }

    const claim = this.economy.claimShareReward('energy')
    if (!claim.claimed) {
      this.startPageController?.showMessage('体力已满，无需补充')
      return
    }

    this.refreshPlayerResources()
    this.startPageController?.showMessage(`分享奖励：体力 +${claim.amount}`)
  }

  // 每次资源发生变化后，从仓库快照重新渲染，首页 UI 不缓存也不修改玩家数据。
  private refreshPlayerResources() {
    const snapshot = this.economy.getSnapshot()
    this.startPageController?.renderPlayerResources(
      snapshot.energy,
      snapshot.maxEnergy
    )
  }

  // 首页分享还没有本局分数，使用邀请挑战文案更符合入口语境。
  private shareGameFromStartPage() {
    void this.shareAdapter.shareStartPage('start_share')
  }
}
