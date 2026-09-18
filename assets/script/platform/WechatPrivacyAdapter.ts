type WechatPrivacyFailResult = {
  errMsg?: string
}

type WechatPrivacyApi = {
  requirePrivacyAuthorize?: (options: {
    success?: () => void
    fail?: (result: WechatPrivacyFailResult) => void
  }) => void
}

export type WechatPrivacyErrorReason = 'denied' | 'unsupported' | 'failed'

export class WechatPrivacyAuthorizationError extends Error {
  constructor(
    message: string,
    readonly reason: WechatPrivacyErrorReason
  ) {
    super(message)
    this.name = 'WechatPrivacyAuthorizationError'
  }
}

/** 在需要使用在线个人功能前，统一触发微信隐私协议授权。 */
export class WechatPrivacyAdapter {
  private pendingAuthorization: Promise<void> | null = null

  authorizeIfNeeded(): Promise<void> {
    const wxApi = (globalThis as { wx?: WechatPrivacyApi }).wx
    // Web 预览没有微信隐私接口，保持原有预览流程可用。
    if (!wxApi) {
      return Promise.resolve()
    }
    if (typeof wxApi.requirePrivacyAuthorize !== 'function') {
      return Promise.reject(new WechatPrivacyAuthorizationError(
        '当前微信版本过低，请更新微信后重试',
        'unsupported'
      ))
    }
    if (this.pendingAuthorization) {
      return this.pendingAuthorization
    }

    const authorization = new Promise<void>((resolve, reject) => {
      try {
        wxApi.requirePrivacyAuthorize?.({
          success: () => resolve(),
          fail: result => reject(this.buildAuthorizationError(result?.errMsg))
        })
      } catch {
        reject(new WechatPrivacyAuthorizationError('隐私授权调用失败，请稍后重试', 'failed'))
      }
    })
    this.pendingAuthorization = authorization
    authorization.then(
      () => this.clearPendingAuthorization(authorization),
      () => this.clearPendingAuthorization(authorization)
    )
    return authorization
  }

  private clearPendingAuthorization(authorization: Promise<void>) {
    if (this.pendingAuthorization === authorization) {
      this.pendingAuthorization = null
    }
  }

  private buildAuthorizationError(errMsg = '') {
    const reason = errMsg.toLowerCase()
    if (reason.includes('deny') || reason.includes('disagree') || reason.includes('cancel')) {
      return new WechatPrivacyAuthorizationError('同意隐私保护指引后才能使用该功能', 'denied')
    }
    console.warn('[隐私授权] 微信隐私协议授权失败', errMsg)
    return new WechatPrivacyAuthorizationError('隐私授权失败，请稍后重试', 'failed')
  }
}
