import { _decorator, Color, Component, EventTouch, game, Game, Graphics, instantiate, Label, Node, Prefab, resources, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { LeaderboardEntryDto, SettlementRank } from '../online/api/GameApiClient'
import { PlayerAvatarRenderer } from '../profile/PlayerAvatarRenderer'
import { getPieceStyle } from '../gameplay/PieceStyle'
import { buildSettlementTrack, formatSettlementScore, makeCelebration, particleFrame, settlementFrame, SETTLEMENT_LIST_HEIGHT, type CelebrationParticle, type SettlementTrack } from './SettlementPresentation'

const { ccclass } = _decorator
const CREAM = new Color(255, 249, 237, 255)
const PAPER = [new Color(255, 214, 121), new Color(245, 138, 101), new Color(168, 198, 101), new Color(139, 206, 213), new Color(255, 240, 189)]
const WIDTH = 750
const HEIGHT = 1360
const ENTRANCE_DURATION = 320
const MASK_FADE_DURATION = 180

type Options = {
  hostNode: Node
  replayHandler: (() => void) | null
  homeHandler: (() => void) | null
  shareHandler: (() => void) | null
  onButtonClick?: () => void
  getSafeInsets?: () => { top: number; bottom: number }
  popupSpriteFrame?: SpriteFrame | null
  replayButtonSpriteFrame?: SpriteFrame | null
  homeButtonSpriteFrame?: SpriteFrame | null
  shareButtonSpriteFrame?: SpriteFrame | null
}
type Row = { node: Node; rank: Label; medal: Sprite; name: Label; score: Label; avatar: PlayerAvatarRenderer; opacity: UIOpacity; key: string }

/** 固定层级由 Prefab 维护；单局数据、压缩冲榜和短时彩纸由此处渲染。 */
@ccclass('GameOverOverlayController')
export class GameOverOverlayController extends Component {
  private options: Options | null = null
  private mask: Node | null = null
  private panel: Node | null = null
  private panelOpacity: UIOpacity | null = null
  private maskOpacity: UIOpacity | null = null
  private list: Node | null = null
  private particles: Graphics | null = null
  private rows: Row[] = []
  private selfRow: Row | null = null
  private medals: Array<SpriteFrame | null> = []
  private buttons: Node[] = []
  private scoreLabel: Label | null = null
  private highestLabel: Label | null = null
  private highestIcon: Sprite | null = null
  private highestIconOutline: Sprite | null = null
  private highestIconLabel: Label | null = null
  private highestIconValue = -1
  private coinsLabel: Label | null = null
  private rankLabel: Label | null = null
  private rankNumber: Label | null = null
  private deltaLabel: Label | null = null
  private statusLabel: Label | null = null
  private track: SettlementTrack | null = null
  private paper: CelebrationParticle[] = []
  private protectedAreas: Array<{ x: number; y: number; width: number; height: number }> = []
  private elapsed = 0
  private playing = false
  private loading = false
  private disposed = false
  private visible = false
  private foreground = true
  private actionPending = false
  private layoutScale = 1
  private layoutY = 0
  private entering = false
  private entranceElapsed = 0
  private panelEntranceStart: number | null = null
  private latestRank: SettlementRank | null = null
  private latestPending = false
  private rankKey = ''
  private values = { score: 0, highest: 0, coins: 0 }
  private readonly reducedMotion = (globalThis as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  private readonly hideEvent = () => { this.foreground = false; this.finishEntrance(); this.finishImmediately() }
  private readonly showEvent = () => { this.foreground = true }
  private readonly homeTap = (event: EventTouch) => this.act(event, 0)
  private readonly replayTap = (event: EventTouch) => this.act(event, 1)
  private readonly shareTap = (event: EventTouch) => this.act(event, 2)

  setup(options: Options) {
    this.options = options
    if (!this.mask) {
      // 保留场景挂点与 UUID，关闭旧版子节点，避免两套弹窗重叠。
      for (const child of this.node.children) child.active = false
      this.mask = new Node('SettlementMask')
      this.mask.layer = this.node.layer
      this.mask.setParent(this.node)
      this.mask.addComponent(UITransform)
      this.mask.addComponent(Graphics)
      this.maskOpacity = this.mask.addComponent(UIOpacity)
      this.bindSwallow(this.mask, true)
    }
    this.syncLayout()
    if (this.panel || this.loading) return
    this.loading = true
    resources.load('Settlement/SettlementPopup', Prefab, (error, prefab) => {
      this.loading = false
      if (this.disposed || !this.node.isValid) return
      if (error || !prefab) {
        console.warn('[结算弹窗] Prefab 加载失败，显示基础结算', error)
        this.createFallback()
      } else {
        this.panel = instantiate(prefab)
        this.panel.setParent(this.node)
        this.bindPanel()
      }
      this.panelOpacity = this.panel!.getComponent(UIOpacity) ?? this.panel!.addComponent(UIOpacity)
      if (this.visible && this.foreground && !this.reducedMotion) {
        this.panelEntranceStart = this.entranceElapsed
        this.entering = true
      }
      this.syncLayout()
      this.refreshValues()
      this.applyRank()
      this.panel!.active = this.visible
    })
  }

  onEnable() {
    this.foreground = true
    game.on(Game.EVENT_HIDE, this.hideEvent, this)
    game.on(Game.EVENT_SHOW, this.showEvent, this)
  }

  onDisable() {
    this.foreground = false
    game.off(Game.EVENT_HIDE, this.hideEvent, this)
    game.off(Game.EVENT_SHOW, this.showEvent, this)
    this.finishEntrance()
    this.finishImmediately()
    this.stopButtons()
    for (const row of [...this.rows, ...(this.selfRow ? [this.selfRow] : [])]) { row.avatar.clear(); row.key = '' }
    this.rankKey = ''
  }

  onDestroy() {
    this.disposed = true
    this.entering = false
    game.off(Game.EVENT_HIDE, this.hideEvent, this)
    game.off(Game.EVENT_SHOW, this.showEvent, this)
    this.playing = false
    this.paper = []
    this.particles?.clear()
    this.stopButtons()
    this.bindSwallow(this.mask, false)
    this.bindSwallow(this.panel, false)
    this.bindButtons(false)
    for (const row of [...this.rows, ...(this.selfRow ? [this.selfRow] : [])]) row.avatar.dispose()
    this.rows = []
    this.selfRow = null
  }

  syncLayout() {
    const host = this.options?.hostNode.getComponent(UITransform)
    const width = host?.width ?? WIDTH
    const height = host?.height ?? 1334
    ;(this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(width, height)
    const mask = this.mask?.getComponent(Graphics)
    if (mask) {
      this.mask!.getComponent(UITransform)!.setContentSize(width, height)
      mask.clear()
      mask.fillColor = new Color(41, 71, 47, 92)
      mask.rect(-width / 2, -height / 2, width, height)
      mask.fill()
    }
    const insets = this.options?.getSafeInsets?.() ?? { top: 0, bottom: 0 }
    this.layoutScale = Math.min(1, Math.max(0.1, (width - 40) / WIDTH), Math.max(0.1, (height - insets.top - insets.bottom - 64) / HEIGHT))
    this.layoutY = (insets.bottom - insets.top) / 2
    this.drawEntrance()
    this.protectedAreas = []
    // 静态标题已烘入底图，TitleBounds 只提供彩纸避让范围。
    for (const path of ['TitleBounds', 'ScoreLabel', 'Score', 'Statistics', 'Board/Rank', 'Board/RankValue', 'Board/Delta', 'Board/Heading', 'Board/Status', 'Board/List', 'Actions']) {
      const node = this.panel?.getChildByPath(path)
      const size = node?.getComponent(UITransform)
      if (!node || !size) continue
      let x = node.position.x, y = node.position.y
      for (let parent = node.parent; parent && parent !== this.panel; parent = parent.parent) { x += parent.position.x; y += parent.position.y }
      this.protectedAreas.push({ x, y, width: size.width, height: size.height })
    }
  }

  renderState(isGameOver: boolean, score: number, highestValue: number, coinReward: number) {
    const opening = isGameOver && !this.visible
    this.values = { score: Math.max(0, Math.floor(score)), highest: Math.max(0, Math.floor(highestValue)), coins: Math.max(0, Math.floor(coinReward)) }
    this.refreshValues()
    if (this.visible !== isGameOver) {
      this.visible = isGameOver
      this.rankKey = ''
      this.actionPending = false
      if (!isGameOver) { this.latestRank = null; this.latestPending = false; this.track = null; this.finishEntrance(); this.finishImmediately() }
      if (this.panel) this.panel.active = isGameOver
    }
    this.node.active = isGameOver
    if (opening) this.startEntrance()
    if (isGameOver && this.node.parent) this.node.setSiblingIndex(this.node.parent.children.length - 1)
  }

  renderRank(rank: SettlementRank | null, pending: boolean) {
    this.latestRank = rank
    this.latestPending = pending
    this.applyRank()
  }

  update(dt: number) {
    if (!this.foreground) return
    let milliseconds = dt * 1000
    if (this.entering) {
      this.entranceElapsed += milliseconds
      this.drawEntrance()
      if (this.panelEntranceStart === null || this.entranceElapsed < this.panelEntranceStart + ENTRANCE_DURATION) return
      milliseconds = this.entranceElapsed - this.panelEntranceStart - ENTRANCE_DURATION
      this.finishEntrance()
    }
    if (!this.playing || !this.track) return
    this.elapsed += milliseconds
    this.drawFrame()
  }

  private startEntrance() {
    this.entranceElapsed = 0
    this.panelEntranceStart = this.panel ? 0 : null
    this.entering = !this.reducedMotion && this.foreground
    this.drawEntrance()
  }

  /** 遮罩先渐入；异步底图就绪后卡片再上浮落定，冲榜时钟等待卡片稳定。 */
  private drawEntrance() {
    const t = this.entering ? Math.min(1, Math.max(0, (this.entranceElapsed - (this.panelEntranceStart ?? this.entranceElapsed)) / ENTRANCE_DURATION)) : 1
    const scale = t < 0.72 ? 0.94 + 0.07 * (1 - Math.pow(1 - t / 0.72, 3)) : 1 + 0.01 * Math.pow((1 - t) / 0.28, 2)
    if (this.maskOpacity) this.maskOpacity.opacity = this.entering ? Math.round(255 * Math.min(1, this.entranceElapsed / MASK_FADE_DURATION)) : 255
    if (this.panelOpacity) this.panelOpacity.opacity = Math.round(255 * Math.min(1, t * 2))
    if (this.panel?.isValid) {
      this.panel.setScale(this.layoutScale * scale, this.layoutScale * scale, 1)
      this.panel.setPosition(0, this.layoutY - 22 * Math.pow(1 - t, 3) * this.layoutScale, 0)
    }
  }

  private finishEntrance() {
    this.entering = false
    this.drawEntrance()
  }

  private bindPanel() {
    const panel = this.panel!
    const label = (path: string) => panel.getChildByPath(path)?.getComponent(Label) ?? null
    this.scoreLabel = label('Score')
    this.highestLabel = label('Statistics/Highest/Label')
    this.highestIcon = panel.getChildByPath('Statistics/Highest/Icon')?.getComponent(Sprite) ?? null
    this.highestIconOutline = panel.getChildByPath('Statistics/Highest/Icon/Outline')?.getComponent(Sprite) ?? null
    this.highestIconLabel = label('Statistics/Highest/Icon/Value')
    this.coinsLabel = label('Statistics/Coins/Label')
    this.rankLabel = label('Board/Rank')
    this.rankNumber = label('Board/RankValue/Number')
    this.deltaLabel = label('Board/Delta')
    this.statusLabel = label('Board/Status')
    this.medals = ['Gold', 'Silver', 'Bronze'].map(name => panel.getChildByPath(`MedalAssets/${name}`)?.getComponent(Sprite)?.spriteFrame ?? null)
    this.list = panel.getChildByPath('Board/List')
    const template = this.list?.getChildByName('PeerTemplate')
    const self = this.list?.getChildByName('Self')
    if (this.list && template && self) {
      this.selfRow = this.bindRow(self, true)
      for (let index = 0; index < 8; index += 1) {
        const peer = instantiate(template)
        peer.name = `Peer${index}`
        peer.setParent(this.list)
        this.rows.push(this.bindRow(peer, false))
      }
      template.active = false
      self.setSiblingIndex(this.list.children.length - 1)
    }
    this.particles = panel.getChildByName('Confetti')?.getComponent(Graphics) ?? null
    this.buttons = ['Home', 'Replay', 'Share'].map(name => panel.getChildByPath(`Actions/${name}`)!).filter(Boolean)
    this.buttons.forEach((node, index) => this.restoreButtonArtwork(node, index))
    this.paintSummaryDividers()
    this.bindSwallow(panel, true)
    this.bindButtons(true)
  }

  private bindRow(node: Node, self: boolean): Row {
    const sprite = node.getChildByName('Avatar')!.getComponent(Sprite)!
    const row = { node, rank: node.getChildByName('Rank')!.getComponent(Label)!, medal: node.getChildByName('Medal')!.getComponent(Sprite)!, name: node.getChildByName('Name')!.getComponent(Label)!, score: node.getChildByName('Score')!.getComponent(Label)!, avatar: new PlayerAvatarRenderer(sprite), opacity: node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity), key: '' }
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics)
    if (self) {
      const size = node.getComponent(UITransform)!
      graphics.clear()
      graphics.fillColor = new Color(181, 110, 57, 53)
      graphics.roundRect(-size.width / 2, -size.height / 2 - 4, size.width, size.height, 24)
      graphics.fill()
      graphics.fillColor = new Color(245, 129, 85)
      graphics.strokeColor = new Color(116, 68, 38, 170)
      graphics.lineWidth = 1.2
      graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 24)
      graphics.fill(); graphics.stroke()
      let seed = 301
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
      graphics.lineWidth = 1.3
      for (let index = 0; index < 70; index += 1) {
        const x = -size.width / 2 + 12 + random() * (size.width - 64), y = -size.height / 2 + 16 + random() * (size.height - 32)
        graphics.strokeColor = index % 3 === 0 ? new Color(113, 67, 30, 18) : new Color(255, 240, 204, 40)
        graphics.moveTo(x, y); graphics.lineTo(x + 10 + random() * 30, y - 8 + random() * 12); graphics.stroke()
      }
    } else {
      graphics.strokeColor = new Color(192, 161, 109, 28)
      graphics.lineWidth = 1
      const size = node.getComponent(UITransform)!
      graphics.moveTo(-size.width / 2 + 10, -size.height / 2 - 3); graphics.lineTo(size.width / 2 - 10, -size.height / 2 - 3); graphics.stroke()
    }
    node.active = false
    return row
  }

  private refreshValues() {
    const compact = !!this.panel?.getChildByName('Statistics')
    if (this.scoreLabel) this.scoreLabel.string = formatSettlementScore(this.values.score)
    if (this.highestLabel) this.highestLabel.string = `${compact ? '' : '最高合成  '}${this.values.highest}`
    if (this.coinsLabel) this.coinsLabel.string = `${compact ? '' : '金币  '}+${formatSettlementScore(this.values.coins)}`
    this.refreshHighestIcon()
  }

  private refreshHighestIcon() {
    if (!this.highestIcon || this.highestIconValue === this.values.highest) return
    const value = this.values.highest
    this.highestIconValue = value
    this.highestIcon.node.active = value > 0
    const style = getPieceStyle(value)
    const color = (hex: string) => Color.fromHEX(new Color(), hex)
    this.highestIcon.color = color(style.bodyColor)
    if (this.highestIconOutline) this.highestIconOutline.color = color(style.outlineColor ?? '#4b3528')
    if (this.highestIconLabel) {
      this.highestIconLabel.string = `${value}`
      this.highestIconLabel.color = color(style.textColor ?? '#fff9ea')
      this.highestIconLabel.outlineColor = color('#4a3125')
    }
  }

  private applyRank() {
    if (!this.visible || !this.panel || !this.rankLabel) return
    const result = this.latestRank
    const key = this.latestPending ? 'pending' : result?.current ? `${result.operationId ?? ''}:${result.previous}:${result.current}:${result.celebrate}` : 'empty'
    if (key === this.rankKey) return
    this.rankKey = key
    this.playing = false
    this.track = null
    this.paper = []
    this.particles?.clear()
    for (const row of this.rows) { row.node.active = false; row.avatar.clear(); row.key = '' }
    if (this.selfRow) { this.selfRow.node.active = false; this.selfRow.avatar.clear(); this.selfRow.key = '' }
    if (this.deltaLabel) this.deltaLabel.string = ''
    if (!result?.current || this.latestPending) {
      if (this.rankNumber?.node.parent) this.rankNumber.node.parent.active = false
      this.rankLabel.node.active = true
      this.rankLabel.string = this.latestPending ? '名次计算中' : '本局已完成'
      if (this.statusLabel) this.statusLabel.string = this.latestPending ? '正在同步本局成绩' : '分数排行暂未更新'
      return
    }
    this.track = buildSettlementTrack(result)
    if (this.track.celebrationDuration) this.paper = makeCelebration(result.current === 1, result.previous === null)
    this.elapsed = 0
    this.playing = !this.reducedMotion && this.foreground
    if (!this.playing) this.elapsed = this.track.landing + Math.max(340, this.track.celebrationDuration)
    this.drawFrame()
  }

  private fillRow(row: Row, entry: LeaderboardEntryDto, rank: number, key: string) {
    row.node.active = true
    row.rank.string = `${rank}`
    const medal = rank <= 3 ? this.medals[rank - 1] : null
    row.rank.node.active = !medal
    row.medal.node.active = !!medal
    row.medal.spriteFrame = medal
    if (row.key === key) return
    row.key = key
    const name = entry.isSelf ? '我' : entry.displayName
    const chars = Array.from(name)
    let units = 0
    let shown = ''
    for (const char of chars) {
      units += /[\u0000-\u00ff]/.test(char) ? 0.55 : 1
      if (units > 7.5) { shown += '…'; break }
      shown += char
    }
    row.name.string = shown
    row.score.string = formatSettlementScore(entry.value)
    void row.avatar.render(entry)
  }

  private drawFrame() {
    const track = this.track
    if (!track || !this.rankLabel) return
    const frame = settlementFrame(track, this.elapsed)
    const final = this.elapsed >= track.landing
    this.rankLabel.string = `第 ${frame.rank} 名`
    if (this.rankNumber?.node.parent) {
      this.rankNumber.string = `${frame.rank}`
      this.rankNumber.node.parent.active = true
      this.rankLabel.node.active = false
    }
    if (this.deltaLabel) {
      const delta = (track.result.previous ?? frame.rank!) - frame.rank!
      this.deltaLabel.string = track.result.previous === null ? '新上榜' : delta > 0 ? `↑${delta}` : ''
      this.deltaLabel.color = track.result.previous === null ? new Color(199, 122, 36) : new Color(113, 155, 65)
    }
    this.layoutRankSummary()
    const rise = (track.result.previous ?? track.result.current!) - track.result.current!
    if (this.statusLabel) this.statusLabel.string = final ? track.result.current === 1 ? '已登顶' : track.result.previous === null ? '新上榜' : rise > 0 ? `超越 ${rise} 位玩家` : '保持当前名次' : this.elapsed < 450 ? '准备冲榜' : '正在超越'
    const visible = frame.rows.filter(row => row.y > -SETTLEMENT_LIST_HEIGHT / 2 - 56 && row.y < SETTLEMENT_LIST_HEIGHT / 2 + 56)
    this.rows.forEach((view, index) => {
      const row = visible[index]
      if (!row) {
        view.node.active = false
        if (view.key) { view.avatar.clear(); view.key = '' }
        return
      }
      this.fillRow(view, row.entry, row.rank, `${row.entry.rank}:${row.entry.displayName}:${row.entry.value}`)
      view.node.setPosition(row.crossing * 16, row.y, 0)
      view.opacity.opacity = Math.round(255 * (1 - row.crossing * 0.25))
    })
    if (this.selfRow && track.result.self) {
      this.fillRow(this.selfRow, track.result.self, frame.rank!, `self:${track.result.operationId ?? ''}`)
      this.selfRow.node.setPosition(0, frame.selfY, 0)
      this.selfRow.node.setScale(frame.selfScale, frame.selfScale, 1)
    }
    this.drawPaper(frame.celebrationElapsed)
    if (frame.done) { this.playing = false; this.paper = []; this.particles?.clear() }
  }

  private finishImmediately() {
    if (this.track) {
      this.elapsed = this.track.landing + Math.max(340, this.track.celebrationDuration)
      this.drawFrame()
    }
    this.playing = false
    this.paper = []
    this.particles?.clear()
  }

  /** 按数字长度收紧「第 N 名」和增量，登顶仍保留名次，状态仅在右侧小字显示。 */
  private layoutRankSummary() {
    const number = this.rankNumber
    const group = number?.node.parent
    if (!number || !group) return
    const width = Math.min(240, Math.max(48, number.string.length * number.fontSize * 0.625))
    const height = number.node.getComponent(UITransform)!.height
    const y = group.position.y
    number.node.getComponent(UITransform)!.setContentSize(width, height)
    group.getChildByName('Prefix')?.setPosition(-width / 2 - 20, 0, 0)
    group.getChildByName('Suffix')?.setPosition(width / 2 + 20, 0, 0)
    group.getComponent(UITransform)!.setContentSize(width + 80, height)
    const hasDelta = !!this.deltaLabel?.string
    const deltaWidth = hasDelta ? Math.min(190, Math.max(80, this.deltaLabel!.string.length * 28)) : 0
    group.setPosition(hasDelta ? -(deltaWidth + 24) / 2 : 0, y, 0)
    if (this.deltaLabel) {
      this.deltaLabel.node.active = hasDelta
      this.deltaLabel.node.getComponent(UITransform)!.setContentSize(Math.max(1, deltaWidth), height)
      this.deltaLabel.node.setPosition((width + 80 + 24) / 2, y, 0)
    }
  }

  private drawPaper(elapsed: number) {
    const graphics = this.particles
    if (!graphics) return
    graphics.clear()
    if (elapsed < 0 || !this.paper.length) return
    for (const particle of this.paper) {
      const frame = particleFrame(particle, elapsed)
      if (!frame || Math.abs(frame.x) > WIDTH / 2 || Math.abs(frame.y) > HEIGHT / 2) continue
      // 彩纸只经过信息区两侧与留白，不盖住头像、成绩和操作按钮。
      if (this.protectedAreas.some(area => Math.abs(frame.x - area.x) < area.width / 2 + 14 && Math.abs(frame.y - area.y) < area.height / 2 + 14)) continue
      const color = PAPER[particle.color]
      graphics.fillColor = new Color(color.r, color.g, color.b, Math.round(frame.alpha * 255))
      graphics.strokeColor = new Color(98, 57, 31, Math.round(frame.alpha * 150))
      graphics.lineWidth = 1.3
      const c = Math.cos(frame.angle), s = Math.sin(frame.angle)
      const point = (x: number, y: number) => ({ x: frame.x + x * c - y * s, y: frame.y + x * s + y * c })
      const w = particle.width, h = particle.height * frame.flip
      if (particle.kind > 0.86) {
        graphics.strokeColor = graphics.fillColor
        graphics.lineWidth = 5
        const a = point(-w, -h * 2), b = point(w, h * 2), c1 = point(w, -h), c2 = point(-w, h)
        graphics.moveTo(a.x, a.y); graphics.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y); graphics.stroke()
      } else {
        const vertices = particle.kind > 0.74 ? Array.from({ length: 10 }, (_, index) => {
          const radius = index % 2 ? w * 0.43 : w
          return point(Math.cos(index * Math.PI / 5) * radius, Math.sin(index * Math.PI / 5) * radius * frame.flip)
        }) : [point(-w / 2, -h / 2), point(w / 2, -h / 2), point(w / 2, h / 2), point(-w / 2, h / 2)]
        graphics.moveTo(vertices[0].x, vertices[0].y)
        for (const vertex of vertices.slice(1)) graphics.lineTo(vertex.x, vertex.y)
        graphics.close(); graphics.fill(); graphics.stroke()
      }
    }
  }

  private paintSummaryDividers() {
    const divider = this.panel?.getChildByPath('Board/SummaryDivider')?.getComponent(Graphics)
    if (divider) {
      divider.clear(); divider.strokeColor = new Color(239, 186, 92); divider.lineWidth = 1.2
      divider.moveTo(-292, 0); divider.lineTo(-18, 0)
      divider.moveTo(18, 0); divider.lineTo(292, 0); divider.stroke()
      divider.fillColor = new Color(246, 180, 58)
      divider.moveTo(0, 7); divider.lineTo(6, 0); divider.lineTo(0, -7); divider.lineTo(-6, 0); divider.close(); divider.fill()
    }
    const separator = this.panel?.getChildByPath('Statistics/Separator')?.getComponent(Graphics)
    if (separator) {
      separator.clear(); separator.strokeColor = new Color(218, 180, 121, 160); separator.lineWidth = 1.2
      separator.moveTo(0, -22); separator.lineTo(0, 22); separator.stroke()
    }
  }

  private restoreButtonArtwork(node: Node, index: number) {
    const background = node.getComponent(Graphics)
    if (background) { background.clear(); background.enabled = false }
    const frame = [this.options?.homeButtonSpriteFrame, this.options?.replayButtonSpriteFrame, this.options?.shareButtonSpriteFrame][index]
    const sprite = node.getChildByName('Artwork')?.getComponent(Sprite)
    if (sprite) {
      if (frame) sprite.spriteFrame = frame
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.trim = false
      const size = node.getComponent(UITransform)!
      sprite.node.getComponent(UITransform)!.setContentSize(size.width, size.height)
    }
  }

  private bindSwallow(node: Node | null, bind: boolean) {
    if (!node?.isValid) return
    for (const event of [Node.EventType.TOUCH_START, Node.EventType.TOUCH_MOVE, Node.EventType.TOUCH_END, Node.EventType.TOUCH_CANCEL]) {
      node.off(event, this.swallow, this)
      if (bind) node.on(event, this.swallow, this)
    }
  }

  private swallow(event: EventTouch) { event.propagationStopped = true }

  private bindButtons(bind: boolean) {
    const callbacks = [this.homeTap, this.replayTap, this.shareTap]
    this.buttons.forEach((node, index) => {
      node.off(Node.EventType.TOUCH_END, callbacks[index], this)
      if (bind) node.on(Node.EventType.TOUCH_END, callbacks[index], this)
    })
  }

  private act(event: EventTouch, index: number) {
    event.propagationStopped = true
    if (this.actionPending) return
    this.options?.onButtonClick?.()
    const handler = index === 0 ? this.options?.homeHandler : index === 1 ? this.options?.replayHandler : this.options?.shareHandler
    const node = this.buttons[index]
    if (!node) { handler?.(); return }
    this.actionPending = true
    Tween.stopAllByTarget(node)
    tween(node).to(0.06, { scale: new Vec3(0.94, 0.94, 1) }).call(() => {
      this.actionPending = false
      handler?.()
    }).to(0.1, { scale: Vec3.ONE }).start()
  }

  private stopButtons() {
    this.actionPending = false
    for (const node of this.buttons) if (node.isValid) { Tween.stopAllByTarget(node); node.setScale(Vec3.ONE) }
  }

  private createFallback() {
    this.panel = new Node('SettlementFallback')
    this.panel.layer = this.node.layer
    this.panel.setParent(this.node)
    this.panel.addComponent(UITransform).setContentSize(WIDTH, HEIGHT)
    const makeLabel = (name: string, value: string, y: number, size: number) => {
      const node = new Node(name); node.layer = this.node.layer; node.setParent(this.panel!); node.setPosition(0, y)
      node.addComponent(UITransform).setContentSize(660, 100)
      const label = node.addComponent(Label); label.string = value; label.fontSize = size; label.color = CREAM
      label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER
      label.enableWrapText = false; label.overflow = Label.Overflow.SHRINK
      return label
    }
    makeLabel('Title', '本局结算', 430, 60)
    this.scoreLabel = makeLabel('Score', '', 300, 90)
    this.highestLabel = makeLabel('Highest', '', 190, 32)
    this.coinsLabel = makeLabel('Coins', '', 110, 32)
    this.rankLabel = makeLabel('Rank', '', -30, 40)
    this.buttons = ['首页', '再来一局', '分享'].map((name, index) => {
      const button = new Node(name)
      button.layer = this.node.layer; button.setParent(this.panel!); button.setPosition((index - 1) * 230, -250)
      button.addComponent(UITransform).setContentSize(210, 100)
      const label = makeLabel(`${name}Label`, name, 0, 32)
      label.node.setParent(button); label.node.setPosition(0, 0, 0); label.node.getComponent(UITransform)!.setContentSize(200, 90)
      const frame = [this.options?.homeButtonSpriteFrame, this.options?.replayButtonSpriteFrame, this.options?.shareButtonSpriteFrame][index]
      if (frame) {
        label.node.active = false
        const artwork = new Node('Artwork'); artwork.layer = this.node.layer; artwork.setParent(button)
        const width = index === 2 ? 210 : 100
        artwork.addComponent(UITransform).setContentSize(width, index === 2 ? 84 : 100)
        const sprite = artwork.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = frame
        artwork.getComponent(UITransform)!.setContentSize(width, index === 2 ? 84 : 100)
      }
      return button
    })
    this.bindSwallow(this.panel, true)
    this.bindButtons(true)
  }
}
