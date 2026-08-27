import { _decorator, AudioClip, CCInteger, Component, director, instantiate, Node, Prefab, SpriteFrame, UITransform } from 'cc'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from './GameAudioManager'
import { GameFeedbackAdapter } from './GameFeedbackAdapter'
import { GameShareAdapter } from './GameShareAdapter'
import { PauseOverlayController } from './PauseOverlayController'
import { ECONOMY_CONFIG, PlayerEconomyStore } from './PlayerEconomyStore'
import { SkillShopPopupController } from './SkillShopPopupController'
import { DailyRewardPopupController } from './DailyRewardPopupController'
import type { SkillKind } from './SkillStock'
import { OngoingGameSession } from './OngoingGameSession'
import { BOARD_CONFIG_LIMITS } from './BoardConfig'

const { ccclass, property } = _decorator
const HOME_RESOURCE_REFRESH_INTERVAL_SECONDS = 30
// 切场景前给按钮 one-shot 留出起声时间，避免当前场景销毁时把点击反馈截断。
const BUTTON_CLICK_SCENE_DELAY_SECONDS = 0.18

@ccclass('HomeSceneController')
export class HomeSceneController extends Component {
  // 首页点击开始后加载的轻量加载场景，默认对应 assets/scence/loading.scene。
  @property({ tooltip: 'Loading scene name' })
  loadingSceneName = 'loading'

  // loading 预加载完成后进入的玩法场景名，loadingSceneName 为空时也会作为安全兜底。
  @property({ tooltip: 'Game scene name' })
  gameSceneName = 'game'

  // 当前首页新开一局时使用的棋盘列数；未来选关只需在进入场景前替换该配置。
  @property({
    type: CCInteger,
    min: BOARD_CONFIG_LIMITS.minColumns,
    max: BOARD_CONFIG_LIMITS.maxColumns,
    step: 1,
    tooltip: 'New game board columns'
  })
  newGameColumns = 5

  // 当前首页新开一局时使用的棋盘行数，默认保持经典 5×7。
  @property({
    type: CCInteger,
    min: BOARD_CONFIG_LIMITS.minRows,
    max: BOARD_CONFIG_LIMITS.maxRows,
    step: 1,
    tooltip: 'New game board rows'
  })
  newGameRows = 7

  // Home 页专用背景音乐，进入首页场景后循环播放。
  @property({ type: AudioClip, tooltip: 'Home page background music' })
  homeBgmClip: AudioClip | null = null

  // 旧版首页背景音乐字段，保留用于兼容已经绑定过 startPageBgmClip 的场景。
  @property({ type: AudioClip, tooltip: 'Start page background music' })
  startPageBgmClip: AudioClip | null = null

  // 所有首页按钮共用的点击反馈音效。
  @property({ type: AudioClip, tooltip: 'Button click sound effect' })
  buttonClickAudioClip: AudioClip | null = null

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

  // 首页商店入口使用的技能购买弹窗，布局和素材封装在独立 Prefab 中。
  @property({ type: Prefab, tooltip: 'Pre-game skill shop popup prefab' })
  skillShopPopupPrefab: Prefab | null = null

  // 首页每日奖励弹窗，奖励状态由经济仓库提供，Prefab 只负责渲染和交互。
  @property({ type: Prefab, tooltip: 'Daily reward popup prefab' })
  dailyRewardPopupPrefab: Prefab | null = null

  private startPageController: StartPageController | null = null
  private skillShopNode: Node | null = null
  private skillShopController: SkillShopPopupController | null = null
  private dailyRewardNode: Node | null = null
  private dailyRewardController: DailyRewardPopupController | null = null
  private homeSettingsNode: Node | null = null
  private homeSettingsController: PauseOverlayController | null = null
  private audioManager: GameAudioManager | null = null
  private readonly shareAdapter = new GameShareAdapter()
  private readonly feedbackAdapter = new GameFeedbackAdapter()
  private readonly economy = PlayerEconomyStore.getInstance()
  private isLoadingGameScene = false
  private dailyRewardStateKey = ''
  private readonly refreshResourceTick = () => this.refreshPlayerResources()

  onLoad() {
    this.audioManager = new GameAudioManager(this.node)
    this.audioManager.setup()
    const resources = this.economy.getSnapshot()
    this.startPageController = this.getComponent(StartPageController) ?? this.addComponent(StartPageController)
    this.startPageController.setup({
      onStartTap: () => this.startGameFromHome(),
      onShareTap: () => this.shareGameFromStartPage(),
      onButtonClick: () => this.playButtonClickFeedback(),
      backgroundSpriteFrame: this.startPageBackgroundSpriteFrame,
      rankButtonSpriteFrame: this.startPageRankButtonSpriteFrame,
      settingsButtonSpriteFrame: this.startPageSettingsButtonSpriteFrame,
      shareButtonSpriteFrame: this.startPageShareButtonSpriteFrame,
      energyBarPrefab: this.energyBarPrefab,
      energy: resources.energy,
      maxEnergy: resources.maxEnergy,
      coins: resources.coins,
      onEnergyMoreTap: () => void this.shareForEnergyReward(),
      onSettingsTap: () => this.openHomeSettings(),
      onDailyRewardTap: () => this.openDailyReward(),
      onShopTap: () => this.openSkillShop()
    })
  }

  start() {
    // 首帧后再同步一次布局，兼容微信安全区和 Creator 预览尺寸变化。
    this.startPageController?.syncLayout()
    this.skillShopController?.syncLayout()
    this.dailyRewardController?.syncLayout()
    this.homeSettingsController?.syncLayout()
    this.audioManager?.playStartPageBackgroundMusic(this.getHomeBgmClip())
    this.schedule(this.refreshResourceTick, HOME_RESOURCE_REFRESH_INTERVAL_SECONDS)
  }

  onDestroy() {
    this.unschedule(this.refreshResourceTick)
    this.skillShopController = null
    this.skillShopNode = null
    this.dailyRewardController = null
    this.dailyRewardNode = null
    this.homeSettingsController = null
    this.homeSettingsNode = null
  }

  /**
   * 首页主按钮直接进入游戏。
   *
   * 有未结束对局时直接续局；新开一局只做体力校验和扣除，不再强制展示技能购买弹窗。
   */
  private startGameFromHome() {
    if (this.isLoadingGameScene) {
      return
    }

    if (OngoingGameSession.hasActiveGame()) {
      this.enterOngoingGameScene()
      return
    }

    if (!this.canStartNewGame()) {
      this.closeSkillShop()
      this.startPageController?.showMessage('体力不足，请先点击体力条补充')
      this.refreshPlayerResources()
      return
    }

    this.enterGameScene()
  }

  // 首页商店入口用于手动补充技能；已有未结束对局时仍直接续局，避免覆盖当前棋盘快照。
  private openSkillShop() {
    if (this.isLoadingGameScene) {
      return
    }

    if (OngoingGameSession.hasActiveGame()) {
      this.enterOngoingGameScene()
      return
    }

    if (!this.canStartNewGame()) {
      this.closeSkillShop()
      this.startPageController?.showMessage('体力不足，请先点击体力条补充')
      this.refreshPlayerResources()
      return
    }

    if (!this.skillShopNode?.isValid || !this.skillShopController?.isValid) {
      if (!this.skillShopPopupPrefab) {
        this.startPageController?.showMessage('技能购买弹窗资源未配置')
        return
      }

      this.skillShopNode = instantiate(this.skillShopPopupPrefab)
      this.skillShopNode.setParent(this.node)
      this.skillShopNode.setPosition(0, 0, 0)
      this.skillShopController = this.skillShopNode.getComponent(SkillShopPopupController)
        ?? this.skillShopNode.addComponent(SkillShopPopupController)
      this.skillShopController.setup({
        hostNode: this.node,
        onPurchase: (skill) => this.purchaseSkill(skill),
        onClose: () => this.closeSkillShop(),
        onButtonClick: () => this.playButtonClickFeedback()
      })
    }

    this.skillShopController.renderState(this.economy.getSnapshot())
    this.skillShopController.showMessage('点击价格即可购买')
    this.skillShopController.syncLayout()
    this.skillShopController.show()
  }

  // 购买结果由经济仓库生成，弹窗只渲染最新余额并展示反馈。
  private purchaseSkill(skill: SkillKind) {
    const result = this.economy.purchaseSkill(skill)
    const skillName = skill === 'bomb' ? '炸弹' : skill === 'hammer' ? '木槌' : '交换'
    this.skillShopController?.renderState(this.economy.getSnapshot())
    this.skillShopController?.showMessage(
      result.purchased
        ? `购买成功：${skillName} +1`
        : result.reason === 'max-reached'
          ? `${skillName}最多持有 ${ECONOMY_CONFIG.maxSkillCount} 个`
          : `金币不足，购买${skillName}需要 ${result.price} 金币`,
      !result.purchased,
      result.purchased
    )
  }

  private closeSkillShop() {
    this.skillShopController?.hide()
  }

  // 开始游戏前由经济层统一扣除体力，扣除失败时停留首页并给出补充入口提示。
  private enterGameScene() {
    if (this.isLoadingGameScene) {
      return
    }
    if (!this.economy.tryConsumeEnergy()) {
      this.closeSkillShop()
      this.startPageController?.showMessage('体力不足，请先点击体力条补充')
      this.refreshPlayerResources()
      return
    }

    this.isLoadingGameScene = true
    OngoingGameSession.beginNewGame({
      columns: this.newGameColumns,
      rows: this.newGameRows
    })
    this.refreshPlayerResources()
    this.skillShopController?.hide()
    const sceneName = this.getStartTargetSceneName()
    this.loadSceneAfterButtonFeedback(sceneName)
  }

  // 续局不重复扣体力，也不经过开始前的技能购买弹窗和 loading 提示页。
  private enterOngoingGameScene() {
    if (this.isLoadingGameScene) {
      return
    }

    this.isLoadingGameScene = true
    this.skillShopController?.hide()
    const sceneName = this.gameSceneName || this.getStartTargetSceneName()
    this.loadSceneAfterButtonFeedback(sceneName)
  }

  private loadSceneAfterButtonFeedback(sceneName: string) {
    this.scheduleOnce(() => director.loadScene(sceneName), BUTTON_CLICK_SCENE_DELAY_SECONDS)
  }

  // 每次从首页进入游戏都走 loading；若场景名未配置，再直接进入玩法场景兜底。
  private getStartTargetSceneName() {
    return this.loadingSceneName || this.gameSceneName
  }

  // 新开一局前先在首页拦截体力不足，避免玩家先看到技能购买弹窗再被拦住。
  private canStartNewGame() {
    return this.economy.getSnapshot().energy >= ECONOMY_CONFIG.gameEnergyCost
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
      snapshot.maxEnergy,
      snapshot.coins
    )
    if (this.dailyRewardNode?.active) {
      this.refreshDailyRewardState()
    }
  }

  private openHomeSettings() {
    if (!this.homeSettingsNode?.isValid || !this.homeSettingsController?.isValid) {
      this.homeSettingsNode = new Node('HomeSettingsOverlay')
      this.homeSettingsNode.setParent(this.node)
      const hostTransform = this.node.getComponent(UITransform)
      this.homeSettingsNode.addComponent(UITransform).setContentSize(
        hostTransform?.width ?? 750,
        hostTransform?.height ?? 1334
      )
      this.homeSettingsController = this.homeSettingsNode.addComponent(PauseOverlayController)
      this.homeSettingsController.setup({
        hostNode: this.node,
        pauseHandler: () => this.homeSettingsController?.hide(),
        replayHandler: null,
        homeHandler: null,
        shareHandler: () => this.shareGameFromStartPage(),
        feedbackHandler: () => void this.openHomeFeedback(),
        onButtonClick: () => this.playButtonClickFeedback(),
        mode: 'home'
      })
    }

    this.homeSettingsController.syncLayout()
    this.homeSettingsController.show()
  }

  private async openHomeFeedback() {
    const result = await this.feedbackAdapter.open('home_settings')
    if (!this.node.isValid || result === 'opened') {
      return
    }
    this.startPageController?.showMessage(
      result === 'unsupported' ? '当前平台暂不支持客服反馈' : '客服反馈打开失败，请稍后重试'
    )
  }

  private openDailyReward() {
    if (this.isLoadingGameScene) {
      return
    }

    if (!this.dailyRewardNode?.isValid || !this.dailyRewardController?.isValid) {
      if (!this.dailyRewardPopupPrefab) {
        this.startPageController?.showMessage('每日奖励弹窗资源未配置')
        return
      }

      this.dailyRewardNode = instantiate(this.dailyRewardPopupPrefab)
      this.dailyRewardNode.setParent(this.node)
      this.dailyRewardNode.setPosition(0, 0, 0)
      this.dailyRewardController = this.dailyRewardNode.getComponent(DailyRewardPopupController)
        ?? this.dailyRewardNode.addComponent(DailyRewardPopupController)
      this.dailyRewardController.setup({
        hostNode: this.node,
        onClaim: () => this.claimDailyReward(),
        onClose: () => this.closeDailyReward(),
        onButtonClick: () => this.playButtonClickFeedback()
      })
    }

    this.refreshDailyRewardState(true)
    this.dailyRewardController.syncLayout()
    this.dailyRewardController.show()
  }

  private claimDailyReward() {
    const result = this.economy.claimDailyLogin()
    this.refreshDailyRewardState(true)
    if (!result.claimed) {
      this.dailyRewardController?.showMessage(
        result.reason === 'storage-failed' ? '领取失败，请稍后重试' : '今日奖励已经领取'
      )
      return
    }

    this.refreshPlayerResources()
    this.dailyRewardController?.showMessage(`领取成功：金币 +${result.amount}`, true)
  }

  private closeDailyReward() {
    this.dailyRewardController?.hide()
  }

  /**
   * 弹窗保持开启并跨过本地零点时刷新领取日，避免展示金额与实际入账金额不一致。
   * 状态未变化时不重复 render，保留领取成功提示。
   */
  private refreshDailyRewardState(force = false) {
    if (!this.dailyRewardController?.isValid) {
      return
    }

    const state = this.economy.getDailyRewardState()
    const stateKey = `${state.currentDay}:${state.todayAmount}:${state.canClaim ? 1 : 0}`
    if (!force && stateKey === this.dailyRewardStateKey) {
      return
    }

    this.dailyRewardStateKey = stateKey
    this.dailyRewardController.renderState(state)
  }

  // 首页分享还没有本局分数，使用邀请挑战文案更符合入口语境。
  private shareGameFromStartPage() {
    void this.shareAdapter.shareStartPage('start_share')
  }

  private playButtonClickFeedback() {
    this.audioManager?.playButtonClickEffect(this.buttonClickAudioClip)
  }
}
