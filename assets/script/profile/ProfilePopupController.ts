import {
  _decorator,
  Color,
  Component,
  EditBox,
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

const PANEL_WIDTH = 620
const PANEL_HEIGHT = 960
const TEXT_COLOR = new Color(104, 49, 21, 255)
const MUTED_TEXT_COLOR = new Color(139, 91, 48, 255)
const CREAM = new Color(255, 249, 226, 255)
const ORANGE = new Color(243, 92, 32, 255)
const GREEN = new Color(75, 181, 71, 255)

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
  private contentOpacity: UIOpacity | null = null
  private currentAvatarSprite: Sprite | null = null
  private displayNameEditBox: EditBox | null = null
  private highestScoreLabel: Label | null = null
  private messageLabel: Label | null = null
  private avatarSprites: Sprite[] = []
  private selectedOverlays: Node[] = []
  private avatarTouchHandlers: Array<(event: EventTouch) => void> = []
  private avatarFrames: Array<SpriteFrame | null> = Array.from({ length: PLAYER_AVATAR_COUNT }, () => null)
  private selectedOverlayFrame: SpriteFrame | null = null
  private state: ProfileViewState = { displayName: '花园玩家', avatarIndex: 0, highestScore: 0 }
  private isBusy = false
  private built = false

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
    if (this.displayNameEditBox && this.displayNameEditBox.string !== this.state.displayName) {
      this.displayNameEditBox.string = this.state.displayName
    }
    if (this.highestScoreLabel) {
      this.highestScoreLabel.string = this.state.highestScore.toLocaleString('zh-CN')
    }
    this.refreshAvatarSelection()
  }

  show() {
    this.ensureBuilt()
    this.syncLayout()
    this.node.active = true
    this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1)
    if (!this.panelNode || !this.contentOpacity) {
      return
    }
    Tween.stopAllByTarget(this.panelNode)
    Tween.stopAllByTarget(this.contentOpacity)
    this.contentOpacity.opacity = 0
    this.panelNode.setScale(0.94, 0.94, 1)
    tween(this.contentOpacity).to(0.16, { opacity: 255 }).start()
    tween(this.panelNode).to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' }).start()
  }

  hide() {
    if (!this.panelNode || !this.contentOpacity) {
      this.node.active = false
      return
    }
    Tween.stopAllByTarget(this.panelNode)
    Tween.stopAllByTarget(this.contentOpacity)
    tween(this.contentOpacity)
      .to(0.14, { opacity: 0 })
      .call(() => {
        if (this.node.isValid) {
          this.node.active = false
        }
      })
      .start()
    tween(this.panelNode).to(0.14, { scale: new Vec3(0.96, 0.96, 1) }).start()
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
    const scale = Math.min(1, (width - 28) / PANEL_WIDTH, (height - 42) / PANEL_HEIGHT)
    this.panelNode?.setScale(scale, scale, 1)
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_END, this.consumeTouch, this)
    this.maskNode?.off(Node.EventType.TOUCH_END, this.handleMaskTap, this)
    this.displayNameEditBox?.node.off(EditBox.EventType.EDITING_DID_ENDED, this.handleNameEditingEnded, this)
    this.avatarSprites.forEach((sprite, index) => {
      const handler = this.avatarTouchHandlers[index]
      if (handler) {
        sprite.node.parent?.off(Node.EventType.TOUCH_END, handler, this)
      }
    })
    if (this.panelNode) {
      Tween.stopAllByTarget(this.panelNode)
    }
    if (this.contentOpacity) {
      Tween.stopAllByTarget(this.contentOpacity)
    }
  }

  private ensureBuilt() {
    if (this.built) {
      return
    }
    this.built = true
    this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)
    this.contentOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity)
    this.node.on(Node.EventType.TOUCH_END, this.consumeTouch, this)

    this.maskNode = this.createNode(this.node, 'Mask', 750, 1334, 0, 0)
    this.maskNode.addComponent(Graphics)
    this.maskNode.on(Node.EventType.TOUCH_END, this.handleMaskTap, this)

    this.panelNode = this.createNode(this.node, 'Panel', PANEL_WIDTH, PANEL_HEIGHT, 0, -10)
    this.panelNode.addComponent(UIOpacity)
    const panelFallback = this.panelNode.addComponent(Graphics)
    panelFallback.fillColor = CREAM
    panelFallback.roundRect(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 46)
    panelFallback.fill()
    const panelSprite = this.panelNode.addComponent(Sprite)
    panelSprite.type = Sprite.Type.SLICED
    panelSprite.sizeMode = Sprite.SizeMode.CUSTOM
    this.panelNode.on(Node.EventType.TOUCH_END, this.consumeTouch, this)

    const header = this.createSpriteNode(this.panelNode, 'Header', 390, 145, 0, 440)
    const closeButton = this.createRoundButton(this.panelNode, 'CloseButton', 72, 274, 412)
    this.createLabel(closeButton, 'Label', '×', 60, TEXT_COLOR, 0, 4, 70, 70)
    closeButton.on(Node.EventType.TOUCH_END, this.handleCloseTap, this)

    const currentAvatarRoot = this.createNode(this.panelNode, 'CurrentAvatar', 190, 190, -188, 276)
    this.drawCircle(currentAvatarRoot, 92, new Color(255, 222, 154, 255))
    this.currentAvatarSprite = this.createSpriteNode(currentAvatarRoot, 'Avatar', 170, 170, 0, 0)
      .getComponent(Sprite)
    const currentSelection = this.createSpriteNode(currentAvatarRoot, 'SelectedOverlay', 194, 194, 0, 0)
    this.selectedOverlays.push(currentSelection)

    this.createInfoRow(this.panelNode, '昵称', 78, 306, true)
    this.createInfoRow(this.panelNode, '最高分', 78, 205, false)

    const separator = this.createNode(this.panelNode, 'Separator', 520, 6, 0, 127)
    const separatorGraphics = separator.addComponent(Graphics)
    separatorGraphics.strokeColor = new Color(238, 193, 103, 210)
    separatorGraphics.lineWidth = 3
    for (let x = -250; x < 250; x += 22) {
      separatorGraphics.moveTo(x, 0)
      separatorGraphics.lineTo(Math.min(x + 11, 250), 0)
    }
    separatorGraphics.stroke()

    this.createLabel(this.panelNode, 'AvatarTitle', '🍃  切换头像  🍃', 35, TEXT_COLOR, 0, 81, 420, 58)
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

    void this.loadArtwork(panelSprite, header.getComponent(Sprite))
    this.renderState(this.state)
    this.node.active = false
  }

  private createInfoRow(parent: Node, title: string, x: number, y: number, editable: boolean) {
    const row = this.createNode(parent, `${title}Row`, 360, 82, x, y)
    const graphics = row.addComponent(Graphics)
    graphics.fillColor = new Color(255, 232, 181, 218)
    graphics.roundRect(-180, -41, 360, 82, 24)
    graphics.fill()
    this.createLabel(row, 'Title', title, 29, TEXT_COLOR, -105, 0, 115, 60)

    const value = this.createNode(row, 'Value', 215, 62, 58, 0)
    const valueGraphics = value.addComponent(Graphics)
    valueGraphics.fillColor = new Color(255, 250, 231, 245)
    valueGraphics.roundRect(-107.5, -31, 215, 62, 22)
    valueGraphics.fill()
    if (editable) {
      this.displayNameEditBox = this.createEditBox(value)
      return
    }
    this.highestScoreLabel = this.createLabel(value, 'Score', '0', 35, TEXT_COLOR, 0, 0, 205, 60)
    this.highestScoreLabel.isBold = true
  }

  private createEditBox(parent: Node) {
    const editBox = parent.addComponent(EditBox)
    editBox.maxLength = 16
    editBox.inputMode = EditBox.InputMode.SINGLE_LINE
    editBox.returnType = EditBox.KeyboardReturnType.DONE
    const textLabel = this.createLabel(parent, 'Text', this.state.displayName, 29, TEXT_COLOR, 0, 0, 195, 58)
    textLabel.horizontalAlign = Label.HorizontalAlign.CENTER
    const placeholder = this.createLabel(parent, 'Placeholder', '输入昵称', 27, MUTED_TEXT_COLOR, 0, 0, 195, 58)
    editBox.textLabel = textLabel
    editBox.placeholderLabel = placeholder
    editBox.string = this.state.displayName
    editBox.node.on(EditBox.EventType.EDITING_DID_ENDED, this.handleNameEditingEnded, this)
    return editBox
  }

  private buildAvatarGrid() {
    if (!this.panelNode) {
      return
    }
    const xPositions = [-222, -74, 74, 222]
    for (let index = 0; index < PLAYER_AVATAR_COUNT; index += 1) {
      const row = Math.floor(index / 4)
      const column = index % 4
      const item = this.createNode(
        this.panelNode,
        `AvatarOption${index}`,
        126,
        126,
        xPositions[column],
        -20 - row * 142
      )
      this.drawCircle(item, 61, new Color(255, 232, 179, 255))
      const sprite = this.createSpriteNode(item, 'Avatar', 112, 112, 0, 0).getComponent(Sprite)
      if (sprite) {
        this.avatarSprites.push(sprite)
      }
      const overlay = this.createSpriteNode(item, 'SelectedOverlay', 130, 130, 0, 0)
      this.selectedOverlays.push(overlay)
      const handler = (event: EventTouch) => {
        event.propagationStopped = true
        void this.selectAvatar(index)
      }
      this.avatarTouchHandlers.push(handler)
      item.on(Node.EventType.TOUCH_END, handler, this)
    }
  }

  private async loadArtwork(panelSprite: Sprite | null, headerSprite: Sprite | null) {
    const [panelFrame, headerFrame, selectedFrame, ...avatarFrames] = await Promise.all([
      this.loadSpriteFrame('Profile/profile-panel-background/spriteFrame'),
      this.loadSpriteFrame('Profile/header-profile/spriteFrame'),
      this.loadSpriteFrame('Profile/avatar-selected-overlay/spriteFrame'),
      ...Array.from({ length: PLAYER_AVATAR_COUNT }, (_, index) => this.loadSpriteFrame(getAvatarSpritePath(index)))
    ])
    if (!this.node.isValid) {
      return
    }
    if (panelSprite) {
      panelSprite.spriteFrame = panelFrame
    }
    if (headerSprite) {
      headerSprite.spriteFrame = headerFrame
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

  private handleNameEditingEnded() {
    void this.submitDisplayName()
  }

  private async submitDisplayName() {
    if (this.isBusy || !this.displayNameEditBox) {
      return
    }
    const nextName = this.displayNameEditBox.string.trim()
    if (!nextName || Array.from(nextName).length > 16) {
      this.displayNameEditBox.string = this.state.displayName
      this.showMessage('昵称需为 1～16 个字符')
      return
    }
    if (nextName === this.state.displayName) {
      return
    }
    const previous = this.state.displayName
    this.isBusy = true
    try {
      await this.displayNameSubmitHandler?.(nextName)
      this.state.displayName = nextName
      this.showMessage('昵称已保存', true)
    } catch (error) {
      this.displayNameEditBox.string = previous
      this.showMessage(error instanceof Error ? error.message : '昵称保存失败')
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

  private createRoundButton(parent: Node, name: string, size: number, x: number, y: number) {
    const node = this.createNode(parent, name, size, size, x, y)
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = CREAM
    graphics.circle(0, 0, size / 2)
    graphics.fill()
    graphics.lineWidth = 5
    graphics.strokeColor = ORANGE
    graphics.circle(0, 0, size / 2 - 2.5)
    graphics.stroke()
    return node
  }

  private drawCircle(node: Node, radius: number, color: Color) {
    const graphics = node.addComponent(Graphics)
    graphics.fillColor = color
    graphics.circle(0, 0, radius)
    graphics.fill()
  }
}
