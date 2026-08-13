export type FeedbackResult = 'opened' | 'unsupported' | 'failed'

/**
 * 客服反馈平台适配器。
 *
 * 玩法和设置弹窗只关心反馈入口是否成功打开，不直接依赖微信 API。
 * Web 预览没有统一客服目标时保持显式降级，避免打开错误或未配置的外部地址。
 */
export class GameFeedbackAdapter {
  open(source: string): Promise<FeedbackResult> {
    const wxApi = (globalThis as {
      wx?: {
        openCustomerServiceConversation?: (options: {
          sessionFrom?: string
          success?: () => void
          fail?: () => void
        }) => void
      }
    }).wx

    if (typeof wxApi?.openCustomerServiceConversation !== 'function') {
      console.info('当前平台暂未接入客服反馈能力', source)
      return Promise.resolve('unsupported')
    }

    return new Promise(resolve => {
      try {
        wxApi.openCustomerServiceConversation?.({
          sessionFrom: source,
          success: () => resolve('opened'),
          fail: () => resolve('failed')
        })
      } catch {
        resolve('failed')
      }
    })
  }
}
