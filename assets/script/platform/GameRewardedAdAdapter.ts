export type RewardedAdResult = 'completed' | 'cancelled' | 'failed' | 'unsupported' | 'busy'

type AdCloseResult = { isEnded?: boolean }
type RewardedVideoAd = {
  load: () => Promise<unknown>
  show: () => Promise<unknown>
  onClose: (listener: (result?: AdCloseResult) => void) => void
  offClose: (listener: (result?: AdCloseResult) => void) => void
  onError: (listener: (error: unknown) => void) => void
  offError: (listener: (error: unknown) => void) => void
  destroy?: () => void
}

type AdRequest = {
  resolve: (result: RewardedAdResult) => void
  isShowing: boolean
}

const SKILL_REWARDED_AD_UNIT_ID = 'adunit-6853c3fa06cf4b9e'

/** 微信广告只返回观看结果，奖励和本局次数由玩法层决定。 */
export class GameRewardedAdAdapter {
  private videoAd: RewardedVideoAd | null = null
  private request: AdRequest | null = null
  private disposed = false

  private readonly handleClose = (result?: AdCloseResult) => {
    // show 成功仅代表打开广告，只有完整观看后的关闭回调才能发放奖励。
    this.finish(result?.isEnded === true ? 'completed' : 'cancelled')
  }

  private readonly handleError = (error: unknown) => {
    console.warn('[激励视频] 广告错误', error)
    // 首次 show 失败仍要允许 load → show 重试，由对应 Promise 收口。
    if (this.request?.isShowing) {
      this.finish('failed')
    }
  }

  initialize() {
    if (this.disposed || this.videoAd) {
      return
    }
    const wxApi = this.getWechatApi()
    if (typeof wxApi?.createRewardedVideoAd !== 'function') {
      return
    }

    try {
      // 独立实例随玩法场景销毁，避免续局时复用已销毁的全局单例。
      this.videoAd = wxApi.createRewardedVideoAd({ adUnitId: SKILL_REWARDED_AD_UNIT_ID, multiton: true })
      this.videoAd.onClose(this.handleClose)
      this.videoAd.onError(this.handleError)
      // 提前加载失败不消耗任何机会；用户点击时仍可重新加载。
      void this.videoAd.load().catch(error => console.warn('[激励视频] 预加载失败', error))
    } catch (error) {
      console.warn('[激励视频] 初始化失败', error)
      this.releaseVideoAd()
    }
  }

  show(): Promise<RewardedAdResult> {
    if (this.disposed) {
      return Promise.resolve('cancelled')
    }
    if (this.request) {
      return Promise.resolve('busy')
    }
    if (typeof this.getWechatApi()?.createRewardedVideoAd !== 'function') {
      console.info('[激励视频] 当前平台不支持微信广告')
      return Promise.resolve('unsupported')
    }
    this.initialize()
    const videoAd = this.videoAd
    if (!videoAd) {
      return Promise.resolve('failed')
    }

    return new Promise(resolve => {
      const request: AdRequest = { resolve, isShowing: false }
      this.request = request
      void this.showWithRetry(videoAd, request)
    })
  }

  /** 展示失败只重试一次；销毁后的异步返回不能再次打开广告。 */
  private async showWithRetry(videoAd: RewardedVideoAd, request: AdRequest) {
    try {
      try {
        await videoAd.show()
      } catch {
        if (this.request !== request) {
          return
        }
        await videoAd.load()
        if (this.request !== request) {
          return
        }
        await videoAd.show()
      }
      if (this.request === request) {
        request.isShowing = true
      }
    } catch (error) {
      if (this.request === request) {
        console.warn('[激励视频] 展示失败', error)
        this.finish('failed')
      }
    }
  }

  dispose() {
    this.disposed = true
    this.finish('cancelled')
    this.releaseVideoAd()
  }

  private finish(result: RewardedAdResult) {
    const request = this.request
    this.request = null
    request?.resolve(result)
  }

  private releaseVideoAd() {
    const videoAd = this.videoAd
    this.videoAd = null
    if (!videoAd) {
      return
    }
    for (const release of [
      () => videoAd.offClose(this.handleClose),
      () => videoAd.offError(this.handleError),
      () => videoAd.destroy?.()
    ]) {
      try {
        release()
      } catch (error) {
        console.warn('[激励视频] 清理实例失败', error)
      }
    }
  }

  private getWechatApi() {
    return (globalThis as {
      wx?: { createRewardedVideoAd?: (options: { adUnitId: string; multiton: boolean }) => RewardedVideoAd }
    }).wx
  }
}
