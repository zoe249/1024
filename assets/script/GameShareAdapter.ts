// 分享适配和玩法状态无关，单独放在这里方便后续替换微信或 Web 分享实现。
export class GameShareAdapter {
  shareScore(score: number, source: string) {
    this.shareMessage(`我在 1024 数字花园合成了 ${score} 分，来挑战一下吧`, source)
  }

  // 首页分享没有分数上下文，使用邀请挑战文案避免出现“0 分”。
  shareStartPage(source: string) {
    this.shareMessage('来 1024 数字花园挑战连续合成吧', source)
  }

  private shareMessage(message: string, source: string) {
    const wxApi = (globalThis as {
      wx?: {
        shareAppMessage?: (options: { title: string; query?: string }) => void
      }
    }).wx

    if (typeof wxApi?.shareAppMessage === 'function') {
      wxApi.shareAppMessage({
        title: message,
        query: `from=${source}`
      })
      return
    }

    const webNavigator = (globalThis as {
      navigator?: {
        share?: (data: { title: string; text: string }) => Promise<void>
      }
    }).navigator
    if (typeof webNavigator?.share === 'function') {
      void webNavigator.share({ title: '1024 数字花园', text: message }).catch(() => undefined)
      return
    }

    console.info('当前平台暂未接入分享能力', message)
  }
}
