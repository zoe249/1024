import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3
} from 'cc'
import {
  getAvatarSpritePath,
  normalizeAvatarIndex,
  PLAYER_AVATAR_COUNT
} from './AvatarCatalog'
import { WechatNicknameAdapter } from '../platform/WechatNicknameAdapter'

const { ccclass } = _decorator

export type ProfileViewState = {
  displayName: string
  avatarIndex: number
  highestScore: number
}

type ProfilePopupOptions = {
  hostNode: Node
  onClose: () => void
  onAvatarSelect: (avatarIndex: number) => Promise<void> | void
  onDisplayNameSubmit: (displayName: string) => Promise<void> | void
  onButtonClick?: () => void
}

const PANEL_WIDTH = 680
const PANEL_HEIGHT = 960
const PANEL_MAX_SCALE = 0.9
const PANEL_SIDE_MARGIN = 32
const TEXT_COLOR = new Color(104, 49, 21, 255)
const MUTED_TEXT_COLOR = new Color(153, 111, 73, 255)
const CREAM = new Color(255, 249, 226, 255)
const ORANGE = new Color(243, 92, 32, 255)
const GREEN = new Color(75, 181, 71, 255)
const SOFT_GREEN = new Color(125, 189, 67, 255)
const PALE_HONEY = new Color(255, 232, 181, 255)

/**
 * 个人中心 Prefab 的渲染控制器。
 * 组件只接收纯数据和回调，不直接访问登录状态或数据库接口。
 */
@ccclass('ProfilePopupController')
export class ProfilePopupController extends Component {
  private hostNode: Node | null = null
  private closeHandler: (() => void) | null = null
  private avatarSelectHandler: ((avatarIndex: number) => Promise<void> | void) | null = null
  private displayNameSubmitHandler: ((displayName: string) => Promise<void> | void) | null = null
  private buttonClickHandler: (() => void) | null = null
  private maskNode: Node | null = null
  private panelNode: Node | null = null
  private currentAvatarSprite: Sprite | null = null
  private displayNameLabel: Label | null = null
  private displayNameValueNode: Node | null = null
  private editPencilSprite: Sprite | null = null
  private highestScoreLabel: Label | null = null
  private messageLabel: Label | null = null
  private avatarSprites: Sprite[] = []
  private selectedOverlays: Node[] = []
  private avatarTouchHandlers: Array<(event: EventTouch) => void> = []
  private avatarFrames: Array<SpriteFrame | null> = Array.from({ length: PLAYER_AVATAR_COUNT }, () => null)
  private selectedOverlayFrame: SpriteFrame | null = null
  private artworkPromise: Promise<void> | null = null
  private state: ProfileViewState = { displayName: '花园玩家', avatarIndex: 0, highestScore: 0 }
  private readonly nicknameAdapter = new WechatNicknameAdapter()
  private isBusy = false
  private built = false
  private wantsVisible = false
  private visibilityRevision = 0
  private panelLayoutScale = 1

  setup(options: ProfilePopupOptions) {
    this.hostNode = options.hostNode
    this.closeHandler = options.onClose
    this.avatarSelectHandler = options.onAvatarSelect
    this.displayNameSubmitHandler = options.onDisplayNameSubmit
    this.buttonClickHandler = options.onButtonClick ?? null
    this.ensureBuilt()
    this.syncLayout()
  }

  renderState(state: ProfileViewState) {
    this.state = {
      displayName: state.displayName.trim() || '花园玩家',
      avatarIndex: normalizeAvatarIndex(state.avatarIndex),
      highestScore: Math.max(0, Math.floor(state.highestScore))
    }
    if (this.displayNameLabel) {
      this.displayNameLabel.string = this.state.displayName
    }
    if (this.highestScoreLabel) {
      this.highestScoreLabel.string = this.state.highestScore.toLocaleString('zh-CN')
    }
    this.refreshAvatarSelection()
  }

  show() {
    this.ensureBuilt()
    this.syncLayout()
    this.wantsVisible = true
    const revision = ++this.visibilityRevision
    void this.revealWhenArtworkReady(revision)
  }

  hide() {
    this.wantsVisible = false
    this.visibilityRevision += 1
    this.unschedule(this.refreshWechatNicknameButton)
    this.nicknameAdapter.detach()
    if (!this.panelNode || !this.node.active) {
      this.node.active = false
      return
    }
    Tween.stopAllByTarget(this.panelNode)
    tween(this.panelNode)
      .to(
        0.14,
        { scale: new Vec3(this.panelLayoutScale * 0.96, this.panelLayoutScale * 0.96, 1) },
        { easing: 'quadIn' }
      )
      .call(() => {
        if (this.node.isValid) {
          this.node.active = false
        }
      })
      .start()
  }

  /** 等全部贴图就绪后再统一激活面板，避免底框和头像分帧出现。 */
  private async revealWhenArtworkReady(revision: number) {
    await (this.artworkPromise ?? Promise.resolve())
    if (
      !this.node.isValid
      || !this.panelNode
      || !this.wantsVisible
      || revision !== this.visibilityRevision
    ) {
      return
    }

    this.node.active = true
    this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1)
    Tween.stopAllByTarget(this.panelNode)
    const startScale = this.panelLayoutScale * 0.94
    this.panelNode.setScale(startScale, startScale, 1)
    tween(this.panelNode)
      .to(
        0.2,
        { scale: new Vec3(this.panelLayoutScale, this.panelLayoutScale, 1) },
        { easing: 'backOut' }
      )
      .start()
    this.unschedule(this.refreshWechatNicknameButton)
    this.scheduleOnce(this.refreshWechatNicknameButton, 0.22)
  }

  showMessage(message: string, success = false) {
    if (!this.messageLabel) {
      return
    }
    this.messageLabel.string = message
    this.messageLabel.color = success ? GREEN : ORANGE
    const opacity = this.messageLabel.node.getComponent(UIOpacity)
      ?? this.messageLabel.node.addComponent(UIOpacity)
    Tween.stopAllByTarget(opacity)
    opacity.opacity = 255
    tween(opacity)
      .delay(1.5)
      .to(0.18, { opacity: 0 })
      .start()
  }

  syncLayout() {
    const hostTransform = this.hostNode?.getComponent(UITransform)
      ?? this.node.parent?.getComponent(UITransform)
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    const width = hostTransform?.width ?? 750
    const height = hostTransform?.height ?? 1334
    transform.setContentSize(width, height)
    this.maskNode?.getComponent(UITransform)?.setContentSize(width, height)
    const maskGraphics = this.maskNode?.getComponent(Graphics)
    if (maskGraphics) {
      maskGraphics.clear()
      maskGraphics.fillColor = new Color(31, 39, 31, 178)
      maskGraphics.rect(-width / 2, -height / 2, width, height)
      maskGraphics.fill()
    }
    this.panelLayoutScale = Math.min(
      PANEL_MAX_SCALE,
      (width - PANEL_SIDE_MARGIN) / PANEL_WIDTH,
      (height - 42) / PANEL_HEIGHT
    )
    this.panelNode?.setScale(this.panelLayoutScale, this.panelLayoutScale, 1)
  }

  onDestroy() {
    // 节点销毁时引擎会自动释放事件，避免再次访问已进入销毁流程的子节点。
    this.nicknameAdapter.detach()
    if (this.panelNode) {
      Tween.stopAllByTarget(this.panelNode)
    }
    this.wantsVisible = false
    this.visibilityRevision += 1
  }

  private ensureBuilt() {
    if (this.built) {
      return
    }
    this.built = true
    this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    this.node.on(Node.EventType.TOUCH_END, this.consumeTouch, this)

    this.maskNode = this.createNode(this.node, 'Mask', 750, 1334, 0, 0)
    this.maskNode.addComponent(Graphics)
    this.maskNode.on(Node.EventType.TOUCH_END, this.handleMaskTap, this)

    this.panelNode = this.createNode(this.node, 'Panel', PANEL_WIDTH, PANEL_HEIGHT, 0, -10)
    const panelSprite = this.panelNode.addComponent(Sprite)
    panelSprite.type = Sprite.Type.SIMPLE
    panelSprite.sizeMode = Sprite.SizeMode.CUSTOM
    panelSprite.trim = false
    this.panelNode.on(Node.EventType.TOUCH_END, this.consumeTouch, this)

    this.createLabel(this.panelNode, 'Title', '个人中心', 46, TEXT_COLOR, 0, 390, 300, 82)
    const closeButton = this.createSpriteNode(this.panelNode, 'CloseButton', 88, 90, 278, 382)
    closeButton.on(Node.EventType.TOUCH_END, this.handleCloseTap, this)

    const summaryCard = this.createNode(this.panelNode, 'ProfileSummary', 570, 220, 0, 236)
    this.drawRoundedCard(summaryCard, 570, 220, new Color(255, 224, 157, 255), CREAM, 32, 6)

    const currentAvatarRoot = this.createNode(summaryCard, 'CurrentAvatar', 168, 168, -202, 0)
    this.drawCircle(currentAvatarRoot, 72, PALE_HONEY)
    this.currentAvatarSprite = this.createSpriteNode(currentAvatarRoot, 'Avatar', 122, 122, 0, 0)
      .getComponent(Sprite)
    const currentSelection = this.createSpriteNode(currentAvatarRoot, 'SelectedOverlay', 154, 154, 0, 0)
    this.selectedOverlays.push(currentSelection)

    this.createNicknameCard(summaryCard, 96, 42)
    this.createScoreCard(summaryCard, 96, -54)

    const separator = this.createNode(this.panelNode, 'Separator', 570, 6, 0, 82)
    const separatorGraphics = separator.addComponent(Graphics)
    separatorGraphics.strokeColor = SOFT_GREEN
    separatorGraphics.lineWidth = 2.5
    separatorGraphics.moveTo(-275, 0)
    separatorGraphics.lineTo(-112, 0)
    separatorGraphics.moveTo(112, 0)
    separatorGraphics.lineTo(275, 0)
    separatorGraphics.stroke()

    this.createLabel(this.panelNode, 'AvatarTitle', '选择头像', 36, TEXT_COLOR, 0, 82, 220, 58)
    this.buildAvatarGrid()
    this.messageLabel = this.createLabel(
      this.panelNode,
      'Message',
      '',
      24,
      ORANGE,
      0,
      -438,
      500,
      40
    )
    this.messageLabel.node.addComponent(UIOpacity).opacity = 0

    this.artworkPromise = this.loadArtwork(panelSprite, closeButton.getComponent(Sprite))
    this.renderState(this.state)
    this.node.active = false
  }

  private createNicknameCard(parent: Node, x: number, y: number) {
    const row = this.createNode(parent, '昵称Row', 348, 90, x, y)
    this.drawRoundedCard(row, 348, 90, PALE_HONEY, new Color(255, 242, 207, 255), 22, 0)
    this.createLabel(row, 'Title', '昵称', 26, TEXT_COLOR, -120, 17, 76, 42)

    const value = this.createNode(row, 'Value', 214, 52, 53, 16)
    this.drawRoundedCard(value, 214, 52, CREAM, CREAM, 18, 0)
    this.displayNameLabel = this.createLabel(
      value,
      'DisplayName',
      this.state.displayName,
      26,
      TEXT_COLOR,
      -14,
      0,
      152,
      46
    )
    this.editPencilSprite = this.createSpriteNode(value, 'EditPencil', 40, 40, 84, 0)
      .getComponent(Sprite)
    this.createLabel(row, 'Hint', '点击同步微信昵称', 17, MUTED_TEXT_COLOR, 48, -27, 230, 26)
    this.displayNameValueNode = row
    row.on(Node.EventType.TOUCH_END, this.handleNameValueTap, this)
  }

  private createScoreCard(parent: Node, x: number, y: number) {
    const row = this.createNode(parent, '最高分Row', 348, 68, x, y)
    this.drawRoundedCard(row, 348, 68, PALE_HONEY, PALE_HONEY, 21, 0)
    this.createLabel(row, 'Title', '最高分', 26, TEXT_COLOR, -112, 0, 96, 52)

    const value = this.createNode(row, 'Value', 214, 52, 53, 0)
    this.drawRoundedCard(value, 214, 52, CREAM, CREAM, 18, 0)
    this.highestScoreLabel = this.createLabel(value, 'Score', '0', 33, TEXT_COLOR, 0, 0, 196, 48)
    this.highestScoreLabel.isBold = true
  }

  private buildAvatarGrid() {
    if (!this.panelNode) {
      return
    }
    const xPositions = [-210, -70, 70, 210]
    for (let index = 0; index < PLAYER_AVATAR_COUNT; index += 1) {
      const row = Math.floor(index / 4)
      const column = index % 4
      const item = this.createNode(
        this.panelNode,
        `AvatarOption${index}`,
        118,
        118,
        xPositions[column],
        -34 - row * 132
      )
      this.drawCircle(item, 54, PALE_HONEY)
      const sprite = this.createSpriteNode(item, 'Avatar', 86, 86, 0, 0).getComponent(Sprite)
      if (sprite) {
        this.avatarSprites.push(sprite)
      }
      const overlay = this.createSpriteNode(item, 'SelectedOverlay', 114, 114, 0, 0)
      this.selectedOverlays.push(overlay)
      const handler = (event: EventTouch) => {
        event.propagationStopped = true
        void this.selectAvatar(index)
      }
      this.avatarTouchHandlers.push(handler)
      item.on(Node.EventType.TOUCH_END, handler, this)
    }
  }

  private async loadArtwork(
    panelSprite: Sprite | null,
    closeSprite: Sprite | null
  ) {
    const [panelFrame, closeFrame, editPencilFrame, selectedFrame, ...avatarFrames] = await Promise.all([
      this.loadSpriteFrame('Profile/profile-panel-background/spriteFrame'),
      this.loadSpriteFrame('Settings/button-close/spriteFrame'),
      this.loadSpriteFrame('Profile/icon-edit-pencil/spriteFrame'),
      this.loadSpriteFrame('Profile/avatar-selected-overlay/spriteFrame'),
      ...Array.from({ length: PLAYER_AVATAR_COUNT }, (_, index) => this.loadSpriteFrame(getAvatarSpritePath(index)))
    ])
    if (!this.node.isValid) {
      return
    }
    if (panelSprite) {
      panelSprite.spriteFrame = panelFrame
    }
    if (closeSprite) {
      closeSprite.spriteFrame = closeFrame
    }
    if (this.editPencilSprite) {
      this.editPencilSprite.spriteFrame = editPencilFrame
    }
    this.selectedOverlayFrame = selectedFrame
    this.avatarFrames = avatarFrames
    this.avatarSprites.forEach((sprite, index) => {
      sprite.spriteFrame = avatarFrames[index] ?? null
    })
    this.selectedOverlays.forEach(node => {
      node.getComponent(Sprite)!.spriteFrame = selectedFrame
    })
    this.refreshAvatarSelection()
  }

  private loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
    return new Promise(resolve => {
      resources.load(path, SpriteFrame, (error, spriteFrame) => {
        if (error || !spriteFrame) {
          console.warn(`[个人中心] 素材加载失败: ${path}`, error)
          resolve(null)
          return
        }
        resolve(spriteFrame)
      })
    })
  }

  private refreshAvatarSelection() {
    const selected = normalizeAvatarIndex(this.state.avatarIndex)
    if (this.currentAvatarSprite) {
      this.currentAvatarSprite.spriteFrame = this.avatarFrames[selected] ?? null
    }
    this.selectedOverlays.forEach((overlay, index) => {
      overlay.active = index === 0 || index - 1 === selected
      const sprite = overlay.getComponent(Sprite)
      if (sprite) {
        sprite.spriteFrame = this.selectedOverlayFrame
      }
    })
  }

  private async selectAvatar(index: number) {
    if (this.isBusy || index === this.state.avatarIndex) {
      return
    }
    const previous = this.state.avatarIndex
    this.isBusy = true
    this.buttonClickHandler?.()
    this.state.avatarIndex = normalizeAvatarIndex(index)
    this.refreshAvatarSelection()
    try {
      await this.avatarSelectHandler?.(this.state.avatarIndex)
      this.showMessage('头像已保存', true)
    } catch (error) {
      this.state.avatarIndex = previous
      this.refreshAvatarSelection()
      this.showMessage(error instanceof Error ? error.message : '头像保存失败')
    } finally {
      this.isBusy = false
    }
  }

  private handleNameValueTap(event: EventTouch) {
    event.propagationStopped = true
    if (!this.nicknameAdapter.isSupported()) {
      this.showMessage('请在微信小游戏中使用微信昵称')
    }
  }

  private readonly refreshWechatNicknameButton = () => {
    const hostTransform = this.hostNode?.getComponent(UITransform)
      ?? this.node.parent?.getComponent(UITransform)
    const valueTransform = this.displayNameValueNode?.getComponent(UITransform)
    if (!hostTransform || !valueTransform || !this.panelNode || !this.displayNameValueNode) {
      return
    }

    let centerX = 0
    let centerY = 0
    let current: Node | null = this.displayNameValueNode
    while (current && current !== this.panelNode) {
      centerX += current.position.x
      centerY += current.position.y
      current = current.parent
    }
    if (current !== this.panelNode) {
      return
    }

    const panelScale = this.panelNode.scale.x
    centerX = this.panelNode.position.x + centerX * panelScale
    centerY = this.panelNode.position.y + centerY * panelScale
    this.nicknameAdapter.attach(
      {
        canvasWidth: hostTransform.width,
        canvasHeight: hostTransform.height,
        centerX,
        centerY,
        width: valueTransform.width * panelScale,
        height: valueTransform.height * panelScale
      },
      nickname => void this.applyWechatNickname(nickname),
      message => this.showMessage(message)
    )
  }

  private async applyWechatNickname(nickname: string) {
    const nextName = nickname.trim()
    if (this.isBusy || nextName === this.state.displayName) {
      return
    }
    if (!nextName || Array.from(nextName).length > 16) {
      this.showMessage('微信昵称需为 1～16 个字符')
      return
    }

    const previous = this.state.displayName
    this.isBusy = true
    this.buttonClickHandler?.()
    try {
      await this.displayNameSubmitHandler?.(nextName)
      this.state.displayName = nextName
      if (this.displayNameLabel) {
        this.displayNameLabel.string = nextName
      }
      this.showMessage('微信昵称已保存', true)
    } catch (error) {
      this.state.displayName = previous
      this.showMessage(error instanceof Error ? error.message : '微信昵称保存失败')
    } finally {
      this.isBusy = false
    }
  }

  private handleCloseTap(event: EventTouch) {
    event.propagationStopped = true
    this.buttonClickHandler?.()
    this.closeHandler?.()
  }

  private handleMaskTap(event: EventTouch) {
    event.propagationStopped = true
    this.closeHandler?.()
  }

  private consumeTouch(event: EventTouch) {
    event.propagationStopped = true
  }

  private createNode(parent: Node, name: string, width: number, height: number, x: number, y: number) {
    const node = new Node(name)
    node.setParent(parent)
    node.setPosition(x, y, 0)
    node.addComponent(UITransform).setContentSize(width, height)
    return node
  }

  private createSpriteNode(parent: Node, name: string, width: number, height: number, x: number, y: number) {
    const node = this.createNode(parent, name, width, height, x, y)
    const sprite = node.addComponent(Sprite)
    sprite.type = Sprite.Type.SIMPLE
    sprite.sizeMode = Sprite.SizeMode.CUSTOM
    sprite.trim = false
    return node
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    color: Color,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const node = this.createNode(parent, name, width, height, x, y)
    const label = node.addComponent(Label)
    label.string = text
    label.fontSize = fontSize
    label.lineHeight = Math.max(fontSize + 6, height)
    label.color = color
    label.isBold = true
    label.overflow = Label.Overflow.SHRINK
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    return label
  }

  private drawRoundedCard(
    node: Node,
    width: number,
    height: number,
    borderColor: Color,
    fillColor: Color,
    radius: number,
    borderWidth: number
  ) {
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = borderColor
    graphics.roundRect(-width * 0.5, -height * 0.5, width, height, radius)
    graphics.fill()
    if (borderWidth <= 0) {
      return
    }
    graphics.fillColor = fillColor
    graphics.roundRect(
      -width * 0.5 + borderWidth,
      -height * 0.5 + borderWidth,
      width - borderWidth * 2,
      height - borderWidth * 2,
      Math.max(1, radius - borderWidth)
    )
    graphics.fill()
  }

  private drawCircle(node: Node, radius: number, color: Color) {
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = color
    graphics.circle(0, 0, radius)
    graphics.fill()
  }

}
