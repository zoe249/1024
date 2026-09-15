type WechatLoginApi = {
  login?: (options: {
    timeout?: number
    success?: (result: { code?: string }) => void
    fail?: (error: { errMsg?: string }) => void
  }) => void
}

/** 只封装微信临时登录凭证，不读取昵称、头像或其他用户资料。 */
export class WechatLoginAdapter {
  isSupported() {
    return typeof (globalThis as { wx?: WechatLoginApi }).wx?.login === 'function'
  }

  login(): Promise<string> {
    const wxApi = (globalThis as { wx?: WechatLoginApi }).wx
    if (typeof wxApi?.login !== 'function') {
      return Promise.reject(new Error('排行榜仅支持微信小游戏'))
    }

    return new Promise((resolve, reject) => {
      try {
        wxApi.login({
          timeout: 10_000,
          success: (result) => {
            const code = result.code?.trim() ?? ''
            if (code) {
              resolve(code)
            } else {
              reject(new Error('微信未返回有效登录凭证'))
            }
          },
          fail: () => reject(new Error('登录失败，请稍后重试'))
        })
      } catch {
        reject(new Error('登录失败，请稍后重试'))
      }
    })
  }
}
