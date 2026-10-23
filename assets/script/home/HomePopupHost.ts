// 拥有首页弹窗实例及资料 Prefab 在途加载；业务回调由首页流程提供。
import { instantiate, Node, Prefab, resources, UITransform } from 'cc'
import { SkillShopPopupController } from '../skill-shop/SkillShopPopupController'
import { DailyRewardPopupController } from '../daily-reward/DailyRewardPopupController'
import { PauseOverlayController } from '../settings/PauseOverlayController'
import { LoginStatusController } from '../online/auth/LoginStatusController'
import { ProfilePopupController } from '../profile/ProfilePopupController'

export class HomePopupHost {
  private disposed = false
  private skillShopNode: Node | null = null
  private skillShopController: SkillShopPopupController | null = null
  private dailyRewardNode: Node | null = null
  private dailyRewardController: DailyRewardPopupController | null = null
  private homeSettingsNode: Node | null = null
  private homeSettingsController: PauseOverlayController | null = null
  private loginStatusNode: Node | null = null
  private loginStatusController: LoginStatusController | null = null
  private profileNode: Node | null = null
  private profileController: ProfilePopupController | null = null
  private profileLoadPromise: Promise<ProfilePopupController> | null = null
  private rejectProfileLoad: ((error: Error) => void) | null = null

  constructor(private readonly node: Node, private readonly isHostValid: () => boolean) {}

  get skillShop(): SkillShopPopupController | null { return this.skillShopController?.isValid && this.skillShopNode?.isValid ? this.skillShopController : null }
  get skillShopVisible() { return !!this.skillShopNode?.isValid && this.skillShopNode.active }
  get dailyReward(): DailyRewardPopupController | null { return this.dailyRewardController?.isValid && this.dailyRewardNode?.isValid ? this.dailyRewardController : null }
  get dailyRewardVisible() { return !!this.dailyRewardNode?.isValid && this.dailyRewardNode.active }
  get homeSettings(): PauseOverlayController | null { return this.homeSettingsController?.isValid && this.homeSettingsNode?.isValid ? this.homeSettingsController : null }
  get homeSettingsVisible() { return !!this.homeSettingsNode?.isValid && this.homeSettingsNode.active }
  get loginStatus(): LoginStatusController | null { return this.loginStatusController?.isValid && this.loginStatusNode?.isValid ? this.loginStatusController : null }
  get loginStatusVisible() { return !!this.loginStatusNode?.isValid && this.loginStatusNode.active }
  get profile(): ProfilePopupController | null { return this.profileController?.isValid && this.profileNode?.isValid ? this.profileController : null }
  get profileVisible() { return !!this.profileNode?.isValid && this.profileNode.active }

  ensureSkillShop(prefab: Prefab, options: Parameters<SkillShopPopupController['setup']>[0]) {
    this.assertAvailable()
    if (this.skillShop) return this.skillShop!
    const node = instantiate(prefab)
    node.setParent(this.node)
    node.setPosition(0, 0, 0)
    const controller = node.getComponent(SkillShopPopupController) ?? node.addComponent(SkillShopPopupController)
    controller.setup(options)
    this.skillShopNode = node
    this.skillShopController = controller
    return controller
  }

  ensureDailyReward(prefab: Prefab, options: Parameters<DailyRewardPopupController['setup']>[0]) {
    this.assertAvailable()
    if (this.dailyReward) return this.dailyReward!
    const node = instantiate(prefab)
    node.setParent(this.node)
    node.setPosition(0, 0, 0)
    const controller = node.getComponent(DailyRewardPopupController) ?? node.addComponent(DailyRewardPopupController)
    controller.setup(options)
    this.dailyRewardNode = node
    this.dailyRewardController = controller
    return controller
  }

  ensureProfile(options: Parameters<ProfilePopupController['setup']>[0]): Promise<ProfilePopupController> {
    this.assertAvailable()
    if (this.profile && this.profileNode?.isValid) {
      this.profile.syncLayout()
      return Promise.resolve(this.profile)
    }
    if (this.profileLoadPromise) return this.profileLoadPromise
    this.profileLoadPromise = new Promise((resolve, reject) => {
      this.rejectProfileLoad = reject
      resources.load('Profile/ProfilePopup', Prefab, (error, prefab) => {
        if (this.disposed || !this.isHostValid()) {
          reject(new Error('个人中心预制件加载失败'))
          return
        }
        this.profileLoadPromise = null
        this.rejectProfileLoad = null
        if (error || !prefab) {
          reject(new Error('个人中心预制件加载失败'))
          return
        }
        const node = instantiate(prefab)
        node.setParent(this.node)
        node.setPosition(0, 0, 0)
        const controller = node.getComponent(ProfilePopupController) ?? node.addComponent(ProfilePopupController)
        controller.setup(options)
        this.profileNode = node
        this.profileController = controller
        resolve(controller)
      })
    })
    return this.profileLoadPromise
  }

  ensureLoginStatus() {
    this.assertAvailable()
    if (this.loginStatus && this.loginStatusNode?.isValid) {
      this.loginStatus.syncLayout()
      return this.loginStatus
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

  ensureSettings(options: Parameters<PauseOverlayController['setup']>[0]) {
    this.assertAvailable()
    if (this.homeSettings && this.homeSettingsNode?.isValid) return this.homeSettings
    const node = new Node('HomeSettingsOverlay')
    node.setParent(this.node)
    const transform = this.node.getComponent(UITransform)
    node.addComponent(UITransform).setContentSize(transform?.width ?? 750, transform?.height ?? 1334)
    const controller = node.addComponent(PauseOverlayController)
    controller.setup(options)
    this.homeSettingsNode = node
    this.homeSettingsController = controller
    return controller
  }

  private assertAvailable() {
    if (this.disposed || !this.isHostValid()) throw new Error('首页弹窗宿主已释放')
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.rejectProfileLoad?.(new Error('个人中心预制件加载失败'))
    this.rejectProfileLoad = null
    this.profileLoadPromise = null
    if (this.skillShopNode?.isValid) this.skillShopNode.destroy()
    this.skillShopNode = null
    this.skillShopController = null
    if (this.dailyRewardNode?.isValid) this.dailyRewardNode.destroy()
    this.dailyRewardNode = null
    this.dailyRewardController = null
    if (this.homeSettingsNode?.isValid) this.homeSettingsNode.destroy()
    this.homeSettingsNode = null
    this.homeSettingsController = null
    if (this.loginStatusNode?.isValid) this.loginStatusNode.destroy()
    this.loginStatusNode = null
    this.loginStatusController = null
    if (this.profileNode?.isValid) this.profileNode.destroy()
    this.profileNode = null
    this.profileController = null
  }
}
