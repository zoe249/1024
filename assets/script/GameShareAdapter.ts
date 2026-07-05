export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

// 分享适配和玩法状态无关，单独放在这里方便后续替换微信或 Web 分享实现。
export class GameShareAdapter {
  shareScore(score: number, source: string) {
    return this.shareMessage(`我在 1024 数字花园合成了 ${score} 分，来挑战一下吧`, source)
  }

  // 首页分享没有分数上下文，使用邀请挑战文案避免出现“0 分”。
  shareStartPage(source: string) {
    return this.shareMessage('来 1024 数字花园挑战连续合成吧', source)
  }

  // 资源奖励分享使用独立文案和来源标识，便于后续统计两种奖励入口。
  shareReward(kind: 'coins' | 'energy') {
    const message = kind === 'coins'
      ? '分享 1024 数字花园，一起领取金币奖励吧'
      : '分享 1024 数字花园，一起补充闯关体力吧'
    return this.shareMessage(message, `reward_${kind}`)
  }

  private shareMessage(message: string, source: string): Promise<ShareResult> {
    const wxApi = (globalThis as {
      wx?: {
        shareAppMessage?: (options: {
          title: string
          query?: string
          success?: () => void
          fail?: () => void
        }) => void
        onShow?: (callback: () => void) => void
        offShow?: (callback: () => void) => void
      }
    }).wx

    if (typeof wxApi?.shareAppMessage === 'function') {
      return this.shareWechatMessage(
        {
          shareAppMessage: wxApi.shareAppMessage,
          onShow: wxApi.onShow,
          offShow: wxApi.offShow
        },
        message,
        source
      )
    }

    const webNavigator = (globalThis as {
      navigator?: {
        share?: (data: { title: string; text: string }) => Promise<void>
      }
    }).navigator
    if (typeof webNavigator?.share === 'function') {
      return webNavigator
        .share({ title: '1024 数字花园', text: message })
        .then(() => 'shared' as const)
        .catch(() => 'cancelled' as const)
    }

    console.info('当前平台暂未接入分享能力', message)
    return Promise.resolve('unsupported')
  }

  /**
   * 微信端通过分享面板关闭后触发的 onShow 作为“完成分享流程”的回流信号。
   *
   * 微信不再可靠返回真实发送结果，因此这里不声称验证了具体收件人；
   * 奖励是否发放仍由调用方根据本次分享流程结果决定。
   */
  private shareWechatMessage(
    wxApi: {
      shareAppMessage: (options: {
        title: string
        query?: string
        success?: () => void
        fail?: () => void
      }) => void
      onShow?: (callback: () => void) => void
      offShow?: (callback: () => void) => void
    },
    message: string,
    source: string
  ): Promise<ShareResult> {
    return new Promise(resolve => {
      let settled = false
      const startedAt = Date.now()
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const finish = (result: ShareResult) => {
        if (settled) {
          return
        }
        settled = true
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        wxApi.offShow?.(handleShow)
        resolve(result)
      }
      const handleShow = () => {
        // 忽略分享 API 调用同一帧内可能出现的生命周期噪声。
        if (Date.now() - startedAt < 250) {
          return
        }
        finish('shared')
      }

      wxApi.onShow?.(handleShow)
      timeoutId = setTimeout(() => finish('cancelled'), 120000)
      try {
        wxApi.shareAppMessage({
          title: message,
          query: `from=${source}`,
          // 旧基础库仍可能回调 success/fail；有回调时优先收口，没有时使用 onShow 回流。
          success: () => finish('shared'),
          fail: () => finish('cancelled')
        })
      } catch {
        finish('cancelled')
      }
    })
  }
}
