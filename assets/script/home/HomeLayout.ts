// 负责定稿首页的前景比例与顶部安全区；输入只包含本页已有节点。
import { Node, screen, sys, view } from 'cc'

const HOMEPAGE_DESIGN_WIDTH = 750
const HOMEPAGE_DESIGN_HEIGHT = 1625
const TOP_SAFE_AREA_GAP = 12

// 只读取首页胶囊避让所需字段，避免项目依赖额外的微信类型声明。
type WechatMenuButtonRect = {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

type WechatWindowInfo = {
  windowHeight?: number
  screenTop?: number
}

type HomeLayoutNodes = {
  homepageLayerNode: Node | null
  settingsButtonNode: Node | null
  coinResourceButtonNode: Node | null
  energyBarNode: Node | null
  profileButtonNode: Node | null
  dailyRewardButtonNode: Node | null
  rankButtonNode: Node | null
  shopButtonNode: Node | null
  shareButtonNode: Node | null
  startButtonNode: Node | null
}

export class HomeLayout {
  /**
   * 定稿坐标以 750 × 1625 为基准：横向按画布宽度等比缩放，短屏压缩纵向间距；
   * 背景独立使用 cover 铺满实际画布，前景素材本身始终保持比例、不做拉伸。
   */
  layout(cardWidth: number, cardHeight: number, nodes: HomeLayoutNodes) {
    if (!nodes.homepageLayerNode) {
      return
    }
    // 横向始终贴合设计宽度；短屏只压缩元素间的纵向距离，不把整套 UI 等比缩小到画面中央。
    // 这样 750 × 1335 预览里设置按钮仍贴近左上角，左右功能按钮也不会向中间收拢。
    const foregroundScale = cardWidth / HOMEPAGE_DESIGN_WIDTH
    const verticalScale = Math.min(1, cardHeight / Math.max(1, HOMEPAGE_DESIGN_HEIGHT * foregroundScale))
    nodes.homepageLayerNode.setPosition(0, 0, 0)
    nodes.homepageLayerNode.setScale(foregroundScale, foregroundScale, 1)

    const background = nodes.homepageLayerNode.getChildByName('HomepageBackground')
    const coverScale = Math.max(cardWidth / 750, cardHeight / 1625) / Math.max(0.001, foregroundScale)
    background?.setPosition(0, 0, 0)
    background?.setScale(coverScale, coverScale, 1)

    const topControlsY = this.getHomepageTopControlsY(cardHeight, foregroundScale, verticalScale)
    nodes.homepageLayerNode.getChildByName('HomepageLogo')?.setPosition(0, Math.min(455 * verticalScale, topControlsY - 72 - 18 - 161), 0)
    nodes.settingsButtonNode?.setPosition(-318, topControlsY, 0)
    nodes.coinResourceButtonNode?.setPosition(-164, topControlsY, 0)
    if (nodes.energyBarNode) {
      const energyPosition = nodes.energyBarNode.position
      nodes.energyBarNode.setPosition(energyPosition.x, topControlsY, energyPosition.z)
    }
    nodes.profileButtonNode?.setPosition(304, topControlsY - 104, 0)
    nodes.dailyRewardButtonNode?.setPosition(-294, -292 * verticalScale, 0)
    nodes.rankButtonNode?.setPosition(-294, -455 * verticalScale, 0)
    nodes.shopButtonNode?.setPosition(294, -292 * verticalScale, 0)
    nodes.shareButtonNode?.setPosition(294, -455 * verticalScale, 0)
    nodes.startButtonNode?.setPosition(0, -655 * verticalScale, 0)
  }

  /**
   * 顶部资源栏优先与微信胶囊共用水平中线；其他平台则避开系统安全区。
   * 返回 HomepageArtwork 的局部坐标，避免前景缩放后安全距离被重复放大。
   */
  private getHomepageTopControlsY(cardHeight: number, foregroundScale: number, verticalScale: number) {
    const safeScale = Math.max(0.001, foregroundScale)
    const visibleLocalHeight = cardHeight / safeScale
    const baseY = 705 * verticalScale
    const menuMetrics = this.getWechatMenuMetrics()
    if (menuMetrics) {
      const sourceWindowHeight = menuMetrics.windowHeight > 0
        ? menuMetrics.windowHeight
        : screen.windowSize.height
      const capsuleCenterFromTop = Math.max(
        0,
        (menuMetrics.menuRect.top + menuMetrics.menuRect.bottom) * 0.5 - menuMetrics.screenTop
      )
      const capsuleCenterLocal = capsuleCenterFromTop * cardHeight / Math.max(1, sourceWindowHeight) / safeScale
      return Math.min(baseY, visibleLocalHeight * 0.5 - capsuleCenterLocal)
    }

    const safeTopLocal = this.getSystemSafeTopInset(cardHeight) / safeScale
    const topControlHalfHeight = 79 * 0.5
    const safeAreaY = visibleLocalHeight * 0.5 - safeTopLocal - TOP_SAFE_AREA_GAP - topControlHalfHeight
    return Math.min(baseY, safeAreaY)
  }

  // 把 Cocos 返回的屏幕安全区换算为首页根节点坐标，Web/原生均可作为灵动岛兜底。
  private getSystemSafeTopInset(rootHeight: number) {
    const safeArea = sys.getSafeAreaRect(false)
    const visibleHeight = Math.max(1, view.getVisibleSize().height)
    if (!safeArea) {
      return 0
    }
    const unsafeTop = Math.max(0, visibleHeight - safeArea.y - safeArea.height)
    return unsafeTop / visibleHeight * rootHeight
  }

  // 微信小游戏的胶囊坐标需结合窗口高度和 screenTop，才能正确换算到 Creator 画布。
  getWechatMenuMetrics(): {
    menuRect: WechatMenuButtonRect
    windowHeight: number
    screenTop: number
  } | null {
    const wxApi = (globalThis as {
      wx?: {
        getMenuButtonBoundingClientRect?: () => WechatMenuButtonRect
        getWindowInfo?: () => WechatWindowInfo
        getSystemInfoSync?: () => WechatWindowInfo
      }
    }).wx
    if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') {
      return null
    }

    const menuRect = wxApi.getMenuButtonBoundingClientRect()
    if (!menuRect || menuRect.width <= 0 || menuRect.height <= 0) {
      return null
    }

    const windowInfo = typeof wxApi.getWindowInfo === 'function'
      ? wxApi.getWindowInfo()
      : typeof wxApi.getSystemInfoSync === 'function'
        ? wxApi.getSystemInfoSync()
        : null

    return {
      menuRect,
      windowHeight: windowInfo?.windowHeight ?? 0,
      screenTop: windowInfo?.screenTop ?? 0
    }
  }

}
