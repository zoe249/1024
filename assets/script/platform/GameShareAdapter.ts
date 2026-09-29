import { ImageAsset, resources } from 'cc'

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

const WECHAT_SHARE_CARDS = [
  { resourcePath: 'Share/share-card-rabbit', title: '摸鱼呢，来合一局？' },
  { resourcePath: 'Share/share-card-fox', title: '摸个鱼，还得算数。' },
  // 沿用旧文件名，图片内容已更新为数字进阶卡。
  { resourcePath: 'Share/share-card-bear', title: '说好只玩一局的……' },
] as const

type LoadedShareCard = {
  title: string
  imageUrl: string
}

type WechatShareOptions = {
  title: string
  query?: string
  imageUrl?: string
  success?: () => void
  fail?: (error: unknown) => void
}

type WechatShareApi = {
  shareAppMessage?: (options: WechatShareOptions) => void
  showShareMenu?: (options: {
    withShareTicket: boolean
    menus: string[]
    fail?: (error: unknown) => void
  }) => void
  onShareAppMessage?: (callback: () => WechatShareOptions) => void
  offShareAppMessage?: (callback: () => WechatShareOptions) => void
  onShareTimeline?: (callback: () => WechatShareOptions) => void
  offShareTimeline?: (callback: () => WechatShareOptions) => void
  onShow?: (callback: () => void) => void
  offShow?: (callback: () => void) => void
}

// 分享适配和玩法状态无关，单独放在这里方便后续替换微信或 Web 分享实现。
export class GameShareAdapter {
  private menuShareApi: WechatShareApi | null = null
  private shareCards: LoadedShareCard[] = []
  private shareCardsPromise: Promise<void> | null = null
  private readonly handleMenuShare = (): WechatShareOptions => {
    const card = this.pickWechatShareCard()
    return {
      title: card?.title ?? this.pickShareTitle(),
      query: 'from=menu_share',
      ...(card ? { imageUrl: card.imageUrl } : {})
    }
  }
  private readonly handleTimelineShare = (): WechatShareOptions => {
    const card = this.pickWechatShareCard()
    return {
      title: card?.title ?? this.pickShareTitle(),
      query: 'from=timeline_share',
      ...(card ? { imageUrl: card.imageUrl } : {})
    }
  }

  // 微信小游戏的好友转发和朋友圈分享需要分别声明菜单入口与回调。
  enableWechatShareMenu() {
    const wxApi = (globalThis as { wx?: WechatShareApi }).wx
    if (!wxApi || this.menuShareApi) {
      return
    }
    if (typeof wxApi.onShareAppMessage === 'function') {
      wxApi.onShareAppMessage(this.handleMenuShare)
      this.menuShareApi = wxApi
    }
    if (typeof wxApi.onShareTimeline === 'function') {
      wxApi.onShareTimeline(this.handleTimelineShare)
      this.menuShareApi = wxApi
    }
    wxApi.showShareMenu?.({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline'],
      fail: error => console.warn('微信分享菜单启用失败', error)
    })
    void this.loadWechatShareCards()
  }

  disableWechatShareMenu() {
    this.menuShareApi?.offShareAppMessage?.(this.handleMenuShare)
    this.menuShareApi?.offShareTimeline?.(this.handleTimelineShare)
    this.menuShareApi = null
  }

  shareScore(score: number, source: string) {
    return this.shareMessage(`摸鱼摸出 ${score} 分，谁来超我？`, source)
  }

  // 首页分享同时选择图片和对应文案，避免分别随机后错配。
  shareStartPage(source: string) {
    return this.shareMessage(undefined, source)
  }

  // 资源奖励分享使用独立文案和来源标识，便于后续统计两种奖励入口。
  shareReward(kind: 'coins' | 'energy') {
    const message = kind === 'coins'
      ? '摸个鱼，顺手攒点金币。'
      : '摸个鱼，顺手补点体力。'
    return this.shareMessage(message, `reward_${kind}`)
  }

  private shareMessage(message: string | undefined, source: string): Promise<ShareResult> {
    const wxApi = (globalThis as { wx?: WechatShareApi }).wx

    if (typeof wxApi?.shareAppMessage === 'function') {
      const shareAppMessage = wxApi.shareAppMessage
      return this.loadWechatShareCards().then(() => {
        const card = this.pickWechatShareCard()
        return this.shareWechatMessage(
          {
            shareAppMessage,
            onShow: wxApi.onShow,
            offShow: wxApi.offShow
          },
          message ?? card?.title ?? this.pickShareTitle(),
          source,
          card?.imageUrl
        )
      })
    }

    const shareText = message ?? this.pickShareTitle()
    const webNavigator = (globalThis as {
      navigator?: {
        share?: (data: { title: string; text: string }) => Promise<void>
      }
    }).navigator
    if (typeof webNavigator?.share === 'function') {
      return webNavigator
        .share({ title: '1024 数字花园', text: shareText })
        .then(() => 'shared' as const)
        .catch(() => 'cancelled' as const)
    }

    console.info('当前平台暂未接入分享能力', shareText)
    return Promise.resolve('unsupported')
  }

  private pickShareTitle(): string {
    return WECHAT_SHARE_CARDS[Math.floor(Math.random() * WECHAT_SHARE_CARDS.length)].title
  }

  private pickWechatShareCard(): LoadedShareCard | undefined {
    const cards = this.shareCards
    return cards.length > 0 ? cards[Math.floor(Math.random() * cards.length)] : undefined
  }

  /**
   * 从 resources 取得三张分享图的原生路径，并保留各自对应的文案。
   * 单张加载失败时跳过，全部失败时由微信使用平台默认分享图。
   */
  private loadWechatShareCards(): Promise<void> {
    if (this.shareCardsPromise) {
      return this.shareCardsPromise
    }
    this.shareCardsPromise = Promise.all(WECHAT_SHARE_CARDS.map(card =>
      new Promise<LoadedShareCard | undefined>(resolve => {
        resources.load(card.resourcePath, ImageAsset, (error, imageAsset) => {
          if (error || !imageAsset?.nativeUrl) {
            console.warn('分享卡片加载失败，已跳过该图片', card.resourcePath, error)
            resolve(undefined)
            return
          }
          resolve({ title: card.title, imageUrl: imageAsset.nativeUrl })
        })
      })
    )).then(cards => {
      this.shareCards = cards.filter((card): card is LoadedShareCard => !!card)
    })
    return this.shareCardsPromise
  }

  /**
   * 微信端通过分享面板关闭后触发的 onShow 作为“完成分享流程”的回流信号。
   *
   * 微信不再可靠返回真实发送结果，因此这里不声称验证了具体收件人；
   * 奖励是否发放仍由调用方根据本次分享流程结果决定。
   */
  private shareWechatMessage(
    wxApi: {
      shareAppMessage: (options: WechatShareOptions) => void
      onShow?: (callback: () => void) => void
      offShow?: (callback: () => void) => void
    },
    message: string,
    source: string,
    imageUrl?: string
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
          ...(imageUrl ? { imageUrl } : {}),
          // 旧基础库仍可能回调 success/fail；有回调时优先收口，没有时使用 onShow 回流。
          success: () => finish('shared'),
          fail: error => {
            console.warn('微信分享失败', error)
            finish('cancelled')
          }
        })
      } catch (error) {
        console.warn('微信分享调用异常', error)
        finish('cancelled')
      }
    })
  }
}
