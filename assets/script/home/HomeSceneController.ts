import { _decorator, AudioClip, CCInteger, Component, director, instantiate, Node, Prefab, resources, SpriteFrame, UITransform } from 'cc'
import { StartPageController } from './StartPageController'
import { GameAudioManager } from '../platform/GameAudioManager'
import { GameFeedbackAdapter } from '../platform/GameFeedbackAdapter'
import { GameShareAdapter } from '../platform/GameShareAdapter'
import {
  WechatPrivacyAdapter,
  WechatPrivacyAuthorizationError
} from '../platform/WechatPrivacyAdapter'
import { PauseOverlayController } from '../settings/PauseOverlayController'
import { ECONOMY_CONFIG, PlayerEconomyStore } from '../economy/PlayerEconomyStore'
import { SkillShopPopupController } from '../skill-shop/SkillShopPopupController'
import { DailyRewardPopupController } from '../daily-reward/DailyRewardPopupController'
import type { SkillKind } from '../economy/SkillStock'
import { OngoingGameSession } from '../gameplay/OngoingGameSession'
import { BOARD_CONFIG_LIMITS } from '../gameplay/BoardConfig'
import { ApiError, type LeaderboardBoardDto, type LeaderboardEntryDto } from '../online/api/GameApiClient'
import { PlayerSessionStore } from '../online/auth/PlayerSessionStore'
import { PlayerCloudSyncStore } from '../online/sync/PlayerCloudSyncStore'
import { PlayerSyncOutbox } from '../online/sync/PlayerSyncOutbox'
import { LoginStatusController } from '../online/auth/LoginStatusController'
import { getAvatarKey } from '../profile/AvatarCatalog'
import { PlayerProfileStore } from '../profile/PlayerProfileStore'
import {
  ProfilePopupController,
  type ProfileViewState
} from '../profile/ProfilePopupController'

const { ccclass, property } = _decorator
const HOME_RESOURCE_REFRESH_INTERVAL_SECONDS = 30
// 切场景前给按钮 one-shot 留出起声时间，避免当前场景销毁时把点击反馈截断。
const BUTTON_CLICK_SCENE_DELAY_SECONDS = 0.18
const PROFILE_PREFAB_PATH = 'Profile/ProfilePopup'

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
  private readonly privacyAdapter = new WechatPrivacyAdapter()
  private readonly economy = PlayerEconomyStore.getInstance()
  private readonly playerSession = PlayerSessionStore.getInstance()
  private readonly playerProfile = PlayerProfileStore.getInstance()
  private readonly cloudSync = PlayerCloudSyncStore.getInstance()
  private readonly syncOutbox = PlayerSyncOutbox.getInstance()
  private loginStatusNode: Node | null = null
  private loginStatusController: LoginStatusController | null = null
  private isOpeningLeaderboard = false
  private isOpeningProfile = false
  private profileNode: Node | null = null
  private profileController: ProfilePopupController | null = null
  private profileLoadPromise: Promise<ProfilePopupController> | null = null
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
      onRankTap: () => void this.openLeaderboard(),
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
      onShopTap: () => this.openSkillShop(),
      onProfileTap: () => void this.openProfile(),
      avatarIndex: this.playerProfile.getSnapshot()?.avatarIndex ?? 0
    })
  }

  start() {
    // 首帧后再同步一次布局，兼容微信安全区和 Creator 预览尺寸变化。
    this.startPageController?.syncLayout()
    this.scheduleOnce(() => this.startPageController?.syncLayout(), 0)
    this.skillShopController?.syncLayout()
    this.dailyRewardController?.syncLayout()
    this.homeSettingsController?.syncLayout()
    this.profileController?.syncLayout()
    this.audioManager?.playStartPageBackgroundMusic(this.getHomeBgmClip())
    this.schedule(this.refreshResourceTick, HOME_RESOURCE_REFRESH_INTERVAL_SECONDS)
    void this.restoreOnlineSession()
  }

  onDestroy() {
    this.unschedule(this.refreshResourceTick)
    this.skillShopController = null
    this.skillShopNode = null
    this.dailyRewardController = null
    this.dailyRewardNode = null
    this.homeSettingsController = null
    this.homeSettingsNode = null
    this.loginStatusController = null
    this.loginStatusNode = null
    this.profileController = null
    this.profileNode = null
    this.profileLoadPromise = null
  }

  /** 已有凭证只做静默恢复；游客启动时绝不调用 wx.login。 */
  private async restoreOnlineSession() {
    const session = await this.playerSession.restore()
    if (session.status !== 'authenticated' || !this.isValid || !this.node.isValid) {
      return
    }
    try {
      await this.cloudSync.sync(this.economy)
      if (this.isValid && this.node.isValid) {
        this.refreshPlayerResources()
      }
    } catch (error) {
      console.info('后台恢复云同步暂未完成，将在打开排行榜时重试', this.describeOnlineError(error))
    }
    try {
      const profile = await this.playerProfile.load(true)
      if (this.isValid && this.node.isValid) {
        this.startPageController?.renderProfileAvatar(profile.avatarIndex)
      }
    } catch (error) {
      console.info('个人资料后台恢复暂未完成，将在打开个人中心时重试', this.describeOnlineError(error))
    }
  }

  /** 排行榜首次使用先完成微信隐私授权，再触发登录、同步和取榜单。 */
  private async openLeaderboard() {
    if (this.isOpeningLeaderboard || this.isLoadingGameScene) {
      return
    }
    this.isOpeningLeaderboard = true
    try {
      await this.privacyAdapter.authorizeIfNeeded()
      if (this.playerSession.getSnapshot().status !== 'authenticated') {
        await this.playerSession.loginInteractively(this.syncOutbox.getInstallationId())
      }
      await this.cloudSync.sync(this.economy)
      this.refreshPlayerResources()
      await this.startPageController?.prepareRankModal()
      const leaderboard = await this.playerSession.getApiClient().getLeaderboard()
      if (!this.isValid || !this.node.isValid) {
        return
      }
      this.startPageController?.setLeaderboardData({
        tabs: leaderboard.boards.map(board => this.buildLeaderboardTab(board))
      })
      this.startPageController?.showRankModal()
    } catch (error) {
      if (!this.isValid || !this.node.isValid) {
        return
      }
      if (error instanceof WechatPrivacyAuthorizationError) {
        this.startPageController?.showMessage(error.message)
        return
      }
      if (error instanceof ApiError && error.statusCode === 401) {
        this.playerSession.markUnauthorized()
      }
      const status = this.ensureLoginStatus()
      status.showFailure(this.describeOnlineError(error), () => void this.retryLeaderboard())
    } finally {
      this.isOpeningLeaderboard = false
    }
  }

  private retryLeaderboard() {
    this.loginStatusController?.hide()
    void this.openLeaderboard()
  }

  private async openProfile() {
    if (this.isOpeningProfile || this.isLoadingGameScene) {
      return
    }
    this.isOpeningProfile = true
    try {
      await this.privacyAdapter.authorizeIfNeeded()
      if (this.playerSession.getSnapshot().status !== 'authenticated') {
        await this.playerSession.loginInteractively(this.syncOutbox.getInstallationId())
      }
      await this.cloudSync.sync(this.economy)
      const [controller, profile] = await Promise.all([
        this.ensureProfilePopup(),
        this.playerProfile.load(true)
      ])
      if (!this.isValid || !this.node.isValid) {
        return
      }
      this.refreshPlayerResources()
      controller.renderState(this.buildProfileViewState(profile))
      this.startPageController?.renderProfileAvatar(profile.avatarIndex)
      this.loginStatusController?.hide()
      controller.show()
    } catch (error) {
      if (!this.isValid || !this.node.isValid) {
        return
      }
      if (error instanceof WechatPrivacyAuthorizationError) {
        this.startPageController?.showMessage(error.message)
        return
      }
      const status = this.ensureLoginStatus()
      status.showFailure(this.describeOnlineError(error), () => this.retryProfile())
    } finally {
      this.isOpeningProfile = false
    }
  }

  private retryProfile() {
    this.loginStatusController?.hide()
    void this.openProfile()
  }

  private ensureProfilePopup(): Promise<ProfilePopupController> {
    if (this.profileController?.isValid && this.profileNode?.isValid) {
      this.profileController.syncLayout()
      return Promise.resolve(this.profileController)
    }
    if (this.profileLoadPromise) {
      return this.profileLoadPromise
    }
    this.profileLoadPromise = new Promise<ProfilePopupController>((resolve, reject) => {
      resources.load(PROFILE_PREFAB_PATH, Prefab, (error, prefab) => {
        this.profileLoadPromise = null
        if (error || !prefab || !this.isValid || !this.node.isValid) {
          reject(new Error('个人中心预制件加载失败'))
          return
        }
        const node = instantiate(prefab)
        node.setParent(this.node)
        node.setPosition(0, 0, 0)
        const controller = node.getComponent(ProfilePopupController)
          ?? node.addComponent(ProfilePopupController)
        controller.setup({
          hostNode: this.node,
          onClose: () => this.closeProfile(),
          onAvatarSelect: avatarIndex => this.saveProfileAvatar(avatarIndex),
          onDisplayNameSubmit: displayName => this.saveProfileDisplayName(displayName),
          onButtonClick: () => this.playButtonClickFeedback()
        })
        this.profileNode = node
        this.profileController = controller
        resolve(controller)
      })
    })
    return this.profileLoadPromise
  }

  private async saveProfileAvatar(avatarIndex: number) {
    try {
      const profile = await this.playerProfile.update({ avatarIndex })
      this.profileController?.renderState(this.buildProfileViewState(profile))
      this.startPageController?.renderProfileAvatar(profile.avatarIndex)
    } catch (error) {
      throw new Error(this.describeOnlineError(error))
    }
  }

  private async saveProfileDisplayName(displayName: string) {
    try {
      const profile = await this.playerProfile.update({ displayName })
      this.profileController?.renderState(this.buildProfileViewState(profile))
    } catch (error) {
      throw new Error(this.describeOnlineError(error))
    }
  }

  private buildProfileViewState(profile: ProfileViewState): ProfileViewState {
    return {
      displayName: profile.displayName,
      avatarIndex: profile.avatarIndex,
      highestScore: profile.highestScore
    }
  }

  private closeProfile() {
    this.profileController?.hide()
  }

  private ensureLoginStatus() {
    if (this.loginStatusNode?.isValid && this.loginStatusController?.isValid) {
      this.loginStatusController.syncLayout()
      return this.loginStatusController
    }
    const node = new Node('LoginStatus')
    node.setParent(this.node)
    node.setPosition(0, 0, 0)
    node.addComponent(UITransform)
    const controller = node.addComponent(LoginStatusController)
    controller.setup(() => controller.hide())
    this.loginStatusNode = node
    this.loginStatusController = controller
    return controller
  }

  private buildLeaderboardTab(board: LeaderboardBoardDto) {
    const isScore = board.metric === 'score'
    return {
      id: board.metric,
      label: isScore ? '最高分榜' : '最高合成',
      entries: board.entries.map(entry => this.buildLeaderboardEntry(entry, isScore)),
      self: this.buildLeaderboardEntry(board.self, isScore, true)
    }
  }

  private buildLeaderboardEntry(entry: LeaderboardEntryDto, isScore: boolean, isSelf = false) {
    return {
      rank: entry.rank,
      name: isSelf ? `我 · ${entry.displayName}` : entry.displayName,
      score: entry.value > 0
        ? isScore ? `${entry.value}分` : `合成 ${entry.value}`
        : '暂无成绩',
      avatar: getAvatarKey(entry.avatarIndex)
    }
  }

  private describeOnlineError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.statusCode === 429) {
        return '操作频繁，请稍后再试'
      }
      if (error.statusCode === 0) {
        return '网络异常，请稍后重试'
      }
      return error.message || '请求失败，请稍后重试'
    }
    return error instanceof Error ? error.message : '请求失败，请稍后重试'
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

  // 首页商店是独立入口，只负责展示和购买技能，不参与新开或续局流程。
  private openSkillShop() {
    if (this.isLoadingGameScene) {
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
    if (!this.isValid || !this.node.isValid) {
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
    if (!this.isValid || !this.node.isValid || result === 'opened') {
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
