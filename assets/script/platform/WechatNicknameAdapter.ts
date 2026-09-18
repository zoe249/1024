export type NicknameButtonRegion = {
  canvasWidth: number
  canvasHeight: number
  centerX: number
  centerY: number
  width: number
  height: number
}

type WechatUserInfoTapResult = {
  errMsg?: string
  rawData?: string
  userInfo?: {
    nickName?: string
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

/** 使用微信小游戏原生授权按钮读取用户主动授权的昵称。 */
export class WechatNicknameAdapter {
  private button: WechatUserInfoButton | null = null
  private tapHandler: ((result: WechatUserInfoTapResult) => void) | null = null
  private generation = 0

  isSupported() {
    return typeof this.getApi()?.createUserInfoButton === 'function'
  }

  attach(
    region: NicknameButtonRegion,
    onNickname: (nickname: string) => void,
    onFailure: (message: string) => void
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
        console.log('用户信息', result)
        if (generation !== this.generation) {
          return
        }
        const nickname = this.readNickname(result)
        if (nickname) {
          onNickname(nickname)
          return
        }
        console.warn('[个人中心] 微信昵称授权未返回昵称', result)
        onFailure(this.describeFailure(result.errMsg, systemInfo.platform))
      }
      button.onTap(handler)
      button.show?.()
      this.button = button
      this.tapHandler = handler
      this.readAuthorizedNickname(wxApi, generation, onNickname)
      return true
    } catch {
      this.detach()
      onFailure('微信昵称能力调用失败')
      return false
    }
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

  /** 已授权时直接同步昵称，避免每次进入个人中心都再次要求用户确认。 */
  private readAuthorizedNickname(
    wxApi: WechatNicknameApi,
    generation: number,
    onNickname: (nickname: string) => void
  ) {
    if (typeof wxApi.getSetting !== 'function' || typeof wxApi.getUserInfo !== 'function') {
      return
    }
    wxApi.getSetting({
      success: setting => {
        if (generation !== this.generation || !setting.authSetting?.['scope.userInfo']) {
          return
        }
        wxApi.getUserInfo?.({
          lang: 'zh_CN',
          withCredentials: true,
          success: result => {
            if (generation !== this.generation) {
              return
            }
            const nickname = this.readNickname(result)
            if (nickname) {
              onNickname(nickname)
            }
          }
        })
      }
    })
  }

  private readNickname(result: WechatUserInfoTapResult) {
    const directName = result.userInfo?.nickName?.trim() ?? ''
    if (directName) {
      return directName
    }
    if (!result.rawData) {
      return ''
    }
    try {
      const rawData = JSON.parse(result.rawData) as { nickName?: string }
      return rawData.nickName?.trim() ?? ''
    } catch {
      return ''
    }
  }

  private describeFailure(errMsg = '', platform = '') {
    const reason = errMsg.toLowerCase()
    if (reason.includes('cancel') || reason.includes('deny')) {
      return '已取消微信昵称授权'
    }
    if (reason.includes('privacy')) {
      return '请先同意微信隐私保护指引'
    }
    if (platform === 'devtools') {
      return '开发者工具未提供模拟昵称，请使用真机调试'
    }
    return '微信未返回昵称，请使用真机重试'
  }
}
