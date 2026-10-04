type WechatUpdateManager = {
  onUpdateReady: (listener: () => void) => void
  onUpdateFailed: (listener: () => void) => void
  applyUpdate: () => void
}

type WechatUpdateApi = {
  getUpdateManager?: () => WechatUpdateManager
  showModal?: (options: {
    title: string
    content: string
    confirmText: string
    cancelText: string
    success: (result: { confirm: boolean }) => void
    fail: () => void
    complete: () => void
  }) => void
}

type UpdatePromptHost = { canPrompt: () => boolean }

/** 微信更新监听跨场景保留，首页仅在可安全重启时提供提示窗口。 */
export class WechatUpdateAdapter {
  private static instance: WechatUpdateAdapter | null = null
  private manager: WechatUpdateManager | null = null
  private wxApi: WechatUpdateApi | null = null
  private host: UpdatePromptHost | null = null
  private initialized = false
  private updateReady = false
  private promptedThisRun = false
  private prompting = false
  private restarting = false

  static getInstance() {
    if (!this.instance) {
      this.instance = new WechatUpdateAdapter()
    }
    return this.instance
  }

  private constructor() {}

  initialize() {
    if (this.initialized) {
      return
    }
    this.initialized = true
    const wxApi = (globalThis as { wx?: WechatUpdateApi }).wx
    // Web 和旧版微信保持原有启动流程，不因缺少更新接口阻塞游戏。
    if (typeof wxApi?.getUpdateManager !== 'function' || typeof wxApi.showModal !== 'function') {
      return
    }
    try {
      this.wxApi = wxApi
      this.manager = wxApi.getUpdateManager()
      // UpdateManager 没有对应的 off 接口，由进程级单例持有监听，避免切场景重复注册。
      this.manager.onUpdateReady(() => {
        this.updateReady = true
        this.promptIfReady()
      })
      this.manager.onUpdateFailed(() => {
        console.warn('[版本更新] 新版本下载失败，继续使用当前版本')
      })
    } catch (error) {
      this.manager = null
      this.wxApi = null
      console.warn('[版本更新] 更新监听初始化失败', error)
    }
  }

  /** 首页退出时释放其回调，更新就绪状态仍由单例保留到下一次进入首页。 */
  enterHome(canPrompt: () => boolean): () => void {
    const host = { canPrompt }
    this.host = host
    this.initialize()
    this.promptIfReady()
    return () => {
      if (this.host === host) {
        this.host = null
      }
    }
  }

  isBlockingNavigation() {
    return this.prompting || this.restarting
  }

  promptIfReady() {
    const host = this.host
    const manager = this.manager
    if (!this.updateReady || this.promptedThisRun || !host?.canPrompt() || !manager || !this.wxApi?.showModal) {
      return
    }
    this.promptedThisRun = true
    this.prompting = true
    try {
      this.wxApi.showModal({
        title: '更新提示',
        content: '新版本已准备好，重启即可体验。是否立即更新？',
        confirmText: '立即更新',
        cancelText: '稍后',
        success: result => {
          // 弹窗回调到达时再次检查首页和续局状态，禁止在已切入的对局中重启。
          if (!result.confirm || this.host !== host || !host.canPrompt()) {
            return
          }
          this.restarting = true
          try {
            manager.applyUpdate()
          } catch (error) {
            this.restarting = false
            console.warn('[版本更新] 应用新版本失败，继续使用当前版本', error)
          }
        },
        fail: () => { this.prompting = false },
        complete: () => { this.prompting = false }
      })
    } catch (error) {
      this.prompting = false
      console.warn('[版本更新] 更新提示显示失败', error)
    }
  }
}
