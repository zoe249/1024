import { normalizeWechatAvatarUrl } from '../profile/AvatarCatalog'

export type NicknameButtonRegion = {
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
  width: number
  height: number
}

export type WechatProfileReadState = 'loading' | 'unauthorized' | 'authorized' | 'unavailable'
export type WechatUserProfile = { nickname: string; avatarUrl: string }

type WechatUserInfoTapResult = {
  errMsg?: string
  rawData?: string
  userInfo?: {
    nickName?: string
    avatarUrl?: string
  }
}

type WechatSettingResult = {
  authSetting?: {
    'scope.userInfo'?: boolean
  }
}

type WechatUserInfoButton = {
  onTap: (handler: (result: WechatUserInfoTapResult) => void) => void
  offTap?: (handler: (result: WechatUserInfoTapResult) => void) => void
  show?: () => void
  hide?: () => void
  destroy: () => void
}

type WechatNicknameApi = {
  createUserInfoButton?: (options: {
    type: 'text'
    text: string
    lang: 'zh_CN'
    withCredentials: boolean
    style: {
      left: number
      top: number
      width: number
      height: number
      lineHeight: number
      backgroundColor: string
      color: string
      textAlign: 'center'
      fontSize: number
      borderRadius: number
    }
  }) => WechatUserInfoButton
  getSetting?: (options: {
    success?: (result: WechatSettingResult) => void
    fail?: () => void
  }) => void
  getUserInfo?: (options: {
    lang: 'zh_CN'
    withCredentials: boolean
    success?: (result: WechatUserInfoTapResult) => void
    fail?: () => void
  }) => void
  getWindowInfo?: () => {
    windowWidth?: number
    windowHeight?: number
  }
  getSystemInfoSync?: () => {
    windowWidth?: number
    windowHeight?: number
    platform?: string
  }
}

/** 只读取平台资料；主动点击与静默读取分开，业务保存由调用方决定。 */
export class WechatNicknameAdapter {
  private button: WechatUserInfoButton | null = null
  private tapHandler: ((result: WechatUserInfoTapResult) => void) | null = null
  private generation = 0
  private readRevision = 0

  isSupported() {
    return typeof this.getApi()?.createUserInfoButton === 'function'
  }

  attach(
    region: NicknameButtonRegion,
    onProfile: (profile: WechatUserProfile, interactive: boolean) => void,
    onFailure: (message: string) => void,
    onState?: (state: WechatProfileReadState) => void
  ) {
    this.detach()
    const generation = ++this.generation
    const wxApi = this.getApi()
    if (typeof wxApi?.createUserInfoButton !== 'function') {
      return false
    }

    const systemInfo = wxApi.getSystemInfoSync?.() ?? {}
    const windowInfo = wxApi.getWindowInfo?.() ?? systemInfo
    const windowWidth = Math.max(1, windowInfo.windowWidth ?? region.canvasWidth)
    const windowHeight = Math.max(1, windowInfo.windowHeight ?? region.canvasHeight)
    const scaleX = windowWidth / Math.max(1, region.canvasWidth)
    const scaleY = windowHeight / Math.max(1, region.canvasHeight)
    const width = Math.max(1, region.width * scaleX)
    const height = Math.max(1, region.height * scaleY)
    const left = (region.canvasWidth * 0.5 + region.centerX) * scaleX - width * 0.5
    const top = (region.canvasHeight * 0.5 - region.centerY) * scaleY - height * 0.5

    try {
      const button = wxApi.createUserInfoButton({
        type: 'text',
        text: '',
        lang: 'zh_CN',
        withCredentials: true,
        style: {
          left,
          top,
          width,
          height,
          lineHeight: height,
          backgroundColor: 'rgba(0,0,0,0)',
          color: 'rgba(0,0,0,0)',
          textAlign: 'center',
          fontSize: 1,
          borderRadius: height * 0.35
        }
      })

      const handler = (result: WechatUserInfoTapResult) => {
        if (generation !== this.generation) return
        if (result.errMsg && !result.errMsg.endsWith(':ok')) {
          onFailure(this.describeFailure(result.errMsg, systemInfo.platform))
          return
        }
        this.readRevision += 1
        const profile = this.readProfile(result)
        if (profile.nickname || profile.avatarUrl) {
          onState?.('authorized')
          onProfile(profile, true)
        } else {
          onFailure(this.describeFailure(result.errMsg, systemInfo.platform))
        }
      }
      button.onTap(handler)
      button.show?.()
      this.button = button
      this.tapHandler = handler
      if (onState) this.readAuthorizedProfile(wxApi, generation, onProfile, onState)
      return true
    } catch {
      this.detach()
      onFailure('微信资料能力调用失败')
      return false
    }
  }

  setEnabled(enabled: boolean) {
    if (enabled) this.button?.show?.()
    else this.button?.hide?.()
  }

  detach() {
    this.generation += 1
    if (this.button && this.tapHandler) {
      this.button.offTap?.(this.tapHandler)
    }
    this.button?.hide?.()
    this.button?.destroy()
    this.button = null
    this.tapHandler = null
  }

  private getApi() {
    return (globalThis as { wx?: WechatNicknameApi }).wx
  }

  /** 打开面板只查询和读取，interactive=false 不代表用户提交资料。 */
  private readAuthorizedProfile(
    wxApi: WechatNicknameApi,
    generation: number,
    onProfile: (profile: WechatUserProfile, interactive: boolean) => void,
    onState: (state: WechatProfileReadState) => void
  ) {
    const readRevision = ++this.readRevision
    const isCurrent = () => generation === this.generation && readRevision === this.readRevision
    onState('loading')
    if (!wxApi.getSetting || !wxApi.getUserInfo) { onState('unavailable'); return }
    wxApi.getSetting({
      success: setting => {
        if (!isCurrent()) return
        if (!setting.authSetting?.['scope.userInfo']) { onState('unauthorized'); return }
        wxApi.getUserInfo?.({
          lang: 'zh_CN', withCredentials: true,
          success: result => {
            if (!isCurrent()) return
            onState('authorized')
            onProfile(this.readProfile(result), false)
          },
          fail: () => { if (isCurrent()) onState('unavailable') }
        })
      },
      fail: () => { if (isCurrent()) onState('unavailable') }
    })
  }

  private readProfile(result: WechatUserInfoTapResult): WechatUserProfile {
    let raw: { nickName?: string; avatarUrl?: string } = {}
    try { raw = JSON.parse(result.rawData ?? '{}') ?? {} } catch { /* 结构化资料仍可使用。 */ }
    const name = result.userInfo?.nickName ?? raw.nickName
    return {
      nickname: typeof name === 'string' ? name.trim() : '',
      avatarUrl: normalizeWechatAvatarUrl(result.userInfo?.avatarUrl ?? raw.avatarUrl)
    }
  }

  private describeFailure(errMsg = '', platform = '') {
    const reason = errMsg.toLowerCase()
    if (reason.includes('cancel') || reason.includes('deny')) {
      return '已取消授权'
    }
    if (reason.includes('privacy')) {
      return '请先同意微信隐私保护指引'
    }
    if (platform === 'devtools') {
      return '请使用微信真机获取用户资料'
    }
    return '微信未返回用户资料，请使用真机重试'
  }
}
