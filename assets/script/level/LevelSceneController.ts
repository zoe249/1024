import { _decorator, AudioClip, AudioSource, Button, Color, Component, director, EventTouch, instantiate, Label, Node, Prefab, screen, Sprite, sys, UIOpacity, UITransform, Vec3, view } from 'cc'
import { LEVEL_DROP_SPEED, LEVEL_GRAVITY_DURATION, LEVEL_MERGE_DURATION, quadOut, sampleLevelClear, sampleLevelUpgrade } from './LevelAnimation'
import { LevelComboFeedback } from './LevelComboFeedback'
import { LevelEffects } from './LevelEffects'
import { LevelTransientFx } from './LevelTransientFx'
import { getLevel, LEVELS } from './LevelCatalog'
import { LevelIceView } from './LevelIceView'
import { LevelPieceController, levelPieceColor } from './LevelPieceController'
import { LevelProgressStore } from './LevelProgressStore'
import { createLevelState, dropInColumn, landingRow, LEVEL_COLUMNS, LEVEL_ROWS, type Cell, type LevelDefinition, type LevelEvent, type LevelState } from './LevelRules'
import { PauseOverlayController } from '../settings/PauseOverlayController'
import { GameShareAdapter } from '../platform/GameShareAdapter'

const { ccclass, property } = _decorator
const STEP = 122
const DROP_HINT = '按住选列，松手下落'
type Motion = { node: Node; from: Vec3; to: Vec3 }
type MergeEvent = Extract<LevelEvent, { kind: 'merge' }>
type MergeVisual = {
  event: MergeEvent; anchor: LevelPieceController; upgraded: boolean
  consumed: { piece: LevelPieceController; origin: Vec3; opacity: UIOpacity; shattered: boolean }[]
}

@ccclass('LevelSceneController')
export class LevelSceneController extends Component {
  @property({ type: Node }) designRoot: Node = null!
  @property({ type: Node }) background: Node = null!
  @property({ type: Node }) boardRoot: Node = null!
  @property({ type: Node }) columnHighlight: Node = null!
  @property({ type: Node }) pieceLayer: Node = null!
  @property({ type: Node }) iceLayer: Node = null!
  @property({ type: Node }) fxLayer: Node = null!
  @property({ type: AudioSource }) effectAudio: AudioSource = null!
  @property({ type: AudioClip }) collisionAudioClip: AudioClip = null!
  @property({ type: AudioClip }) mergeAudioClip: AudioClip = null!
  @property({ type: AudioClip }) buttonClickAudioClip: AudioClip = null!
  @property({ type: [AudioClip] }) comboAudioClips: AudioClip[] = []
  @property({ type: Prefab }) piecePrefab: Prefab = null!
  @property({ type: Prefab }) icePrefab: Prefab = null!
  @property({ type: LevelPieceController }) currentView: LevelPieceController = null!
  @property({ type: LevelPieceController }) nextView: LevelPieceController = null!
  @property({ type: Label }) titleLabel: Label = null!
  @property({ type: Label }) hintLabel: Label = null!
  @property({ type: Label }) messageLabel: Label = null!
  @property({ type: [Node] }) goalCards: Node[] = []
  @property({ type: [Label] }) goalValues: Label[] = []
  @property({ type: [Label] }) goalCounts: Label[] = []
  @property({ type: [Label] }) goalSlots: Label[] = []
  @property({ type: [Node] }) goalIcons: Node[] = []
  @property({ type: Node }) settingsOverlay: Node = null!
  @property({ type: Node }) resultPanel: Node = null!
  @property({ type: Label }) resultTitle: Label = null!
  @property({ type: Label }) resultSummary: Label = null!
  @property({ type: Label }) resultActionLabel: Label = null!
  @property({ type: Button }) pauseButton: Button = null!
  @property({ type: Button }) homeButton: Button = null!
  @property({ type: Button }) resultActionButton: Button = null!
  @property({ type: Button }) resultHomeButton: Button = null!

  private level!: LevelDefinition
  private state!: LevelState
  private board: (LevelPieceController | null)[][] = []
  private iceViews: (LevelIceView | null)[][] = []
  private bindings: { node: Node; callback: () => void }[] = []
  private plan: { state: LevelState; events: LevelEvent[] } | null = null
  private eventIndex = 0
  private elapsed = 0
  private duration = 0
  private motions: Motion[] = []
  private mergeVisuals: MergeVisual[] = []
  private transientFx: LevelTransientFx | null = null
  private effects: LevelEffects | null = null
  private combo: LevelComboFeedback | null = null
  private paused = false
  private disposed = false
  private leaving = false
  private layoutKey = ''
  private toastTime = 0
  private pendingResult = false
  private activeTouchId: number | null = null
  private selectedColumn = -1
  private pauseOverlay: PauseOverlayController = null!
  private readonly shareAdapter = new GameShareAdapter()

  onLoad() {
    this.pauseOverlay = this.settingsOverlay.getComponent(PauseOverlayController)!
    this.transientFx = new LevelTransientFx(18)
    this.effects = new LevelEffects(this.transientFx, 112, () => this.fxLayer)
    this.combo = new LevelComboFeedback(this.transientFx)
    this.pauseOverlay.setup({
      hostNode: this.node,
      pauseHandler: () => { if (!this.disposed && !this.leaving) this.setPaused(false) },
      replayHandler: () => { if (!this.disposed && !this.leaving) this.startLevel(this.level.id, false) },
      homeHandler: () => { if (!this.disposed) this.goHome() },
      shareHandler: () => { if (!this.disposed) void this.shareFromSettings() },
      feedbackHandler: null,
      onButtonClick: () => { if (!this.disposed) this.playSound(this.buttonClickAudioClip) }
    })
    this.bind(this.pauseButton, () => this.setPaused(true))
    this.bind(this.homeButton, () => this.goHome())
    this.bind(this.resultHomeButton, () => this.goHome())
    this.bind(this.resultActionButton, () => {
      const next = this.state.status === 'won' ? getLevel(this.level.id + 1) : null
      this.startLevel(next?.id ?? this.level.id, false)
    })
    this.boardRoot.on(Node.EventType.TOUCH_START, this.onBoardTouchStart, this)
    this.boardRoot.on(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this)
    this.boardRoot.on(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this)
    this.boardRoot.on(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this)
    view.on('canvas-resize', this.syncLayout, this)
    this.startLevel(LevelProgressStore.currentLevelId(), true)
  }

  start() { this.syncLayout(); director.preloadScene('home') }

  private bind(button: Button, callback: () => void) {
    button.node.on(Button.EventType.CLICK, callback, this)
    this.bindings.push({ node: button.node, callback })
  }

  private startLevel(id: number, resume: boolean) {
    this.cancelSelection()
    this.level = getLevel(id)!
    this.clearEffects()
    this.plan = null; this.motions = []; this.mergeVisuals = []; this.paused = false; this.pendingResult = false
    this.pauseOverlay.renderState(false); this.resultPanel.active = false
    this.state = resume ? LevelProgressStore.restore(id) : createLevelState(this.level)
    this.pieceLayer.destroyAllChildren(); this.iceLayer.destroyAllChildren()
    this.board = Array.from({ length: LEVEL_ROWS }, () => Array(LEVEL_COLUMNS).fill(null))
    this.iceViews = Array.from({ length: LEVEL_ROWS }, () => Array(LEVEL_COLUMNS).fill(null))
    for (let row = 0; row < LEVEL_ROWS; row++) for (let column = 0; column < LEVEL_COLUMNS; column++) {
      const cell = { row, column }, value = this.state.board[row][column]
      if (value) this.board[row][column] = this.createPiece(value, this.cellPosition(cell))
      if (this.state.ice[row][column]) {
        const node = instantiate(this.icePrefab)
        node.setParent(this.iceLayer); node.setPosition(this.cellPosition(cell))
        this.iceViews[row][column] = node.getComponent(LevelIceView)!
      }
    }
    this.titleLabel.string = `第 ${this.level.id} 关 · ${this.level.title}`
    this.hintLabel.string = this.level.hint
    this.messageLabel.string = DROP_HINT
    this.renderGoals(this.state.collected, this.countIce(this.state.ice))
    this.renderQueue()
    LevelProgressStore.save(this.state)
    if (this.state.status !== 'playing') this.showResult()
  }

  private cellPosition(cell: Cell) { return new Vec3((cell.column - 2) * STEP, (cell.row - 3) * STEP, 0) }

  private createPiece(value: number, position: Vec3) {
    const node = instantiate(this.piecePrefab)
    node.setParent(this.pieceLayer); node.setPosition(position)
    const piece = node.getComponent(LevelPieceController)!
    piece.setValue(value)
    return piece
  }

  private renderQueue() {
    this.currentView.setValue(this.state.current); this.nextView.setValue(this.state.next)
    this.currentView.node.active = this.state.status === 'playing' && !this.plan
    this.nextView.node.active = this.state.status === 'playing'
  }

  private renderGoals(collected: number[], remainingIce: number) {
    this.goalCards.forEach((node, i) => { node.active = i < Math.max(1, this.level.goals.length) })
    this.goalCards[0].setPosition(this.level.goals.length > 1 ? -152 : 0, 0, 0)
    const initialIce = this.countIce(this.level.ice)
    const goals = this.level.goals.length ? this.level.goals : [{ value: 0, count: initialIce }]
    goals.forEach((goal, i) => {
      const count = this.level.goals.length ? collected[i] : initialIce - remainingIce
      this.goalValues[i].string = goal.value ? `${goal.value}` : '冰'
      this.goalCounts[i].string = count >= goal.count ? '已完成' : `还差 ${goal.count - count} ${goal.value ? '个' : '块'}`
      this.goalSlots[i].string = Array.from({ length: goal.count }, (_, n) => n < count ? '●' : '○').join(' ')
      const body = this.goalIcons[i].getComponent(Sprite)!
      body.color = new Color(goal.value ? levelPieceColor(goal.value) : '#88D5EA')
    })
  }

  private canSelectColumn() {
    return this.enabledInHierarchy && !this.disposed && !this.paused && !this.plan && !this.leaving && this.state.status === 'playing'
  }

  private columnFromTouch(event: EventTouch) {
    const point = event.getUILocation()
    const local = this.boardRoot.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0))
    const halfWidth = LEVEL_COLUMNS * STEP / 2, halfHeight = LEVEL_ROWS * STEP / 2
    if (local.y < -halfHeight || local.y >= halfHeight || local.x < -halfWidth || local.x >= halfWidth) return -1
    return Math.floor((local.x + halfWidth) / STEP)
  }

  private onBoardTouchStart(event: EventTouch) {
    if (!this.canSelectColumn() || this.activeTouchId !== null) return
    const column = this.columnFromTouch(event)
    if (column < 0) return
    this.activeTouchId = event.getID()
    this.toastTime = 0
    this.showColumnSelection(column)
  }

  private onBoardTouchMove(event: EventTouch) {
    if (this.activeTouchId === null || event.getID() !== this.activeTouchId) return
    if (!this.canSelectColumn()) { this.cancelSelection(); return }
    this.showColumnSelection(this.columnFromTouch(event))
  }

  /** 只接受本次按下的手指在棋盘内松手，避免拖出、取消或第二根手指误落子。 */
  private onBoardTouchEnd(event: EventTouch) {
    if (this.activeTouchId === null || event.getID() !== this.activeTouchId) return
    const column = this.canSelectColumn() ? this.columnFromTouch(event) : -1
    this.cancelSelection()
    if (column >= 0) this.dropSelectedColumn(column)
  }

  private onBoardTouchCancel(event: EventTouch) {
    if (this.activeTouchId !== null && event.getID() === this.activeTouchId) this.cancelSelection()
  }

  private showColumnSelection(column: number) {
    if (column === this.selectedColumn) return
    this.selectedColumn = column
    this.columnHighlight.active = column >= 0
    if (column < 0) { this.messageLabel.string = '移回棋盘继续选列，松手取消'; return }
    this.columnHighlight.setPosition((column - 2) * STEP, 0, 0)
    const row = landingRow(this.state.board, column)
    this.messageLabel.string = row >= 0 ? '松手落下，拖动可换列' : '这一列满了，请拖动换一列'
  }

  private cancelSelection() {
    const selecting = this.activeTouchId !== null
    this.activeTouchId = null; this.selectedColumn = -1
    if (this.columnHighlight?.isValid) this.columnHighlight.active = false
    if (selecting && !this.plan && !this.leaving && this.state?.status === 'playing' && this.messageLabel?.isValid) this.messageLabel.string = DROP_HINT
  }

  private dropSelectedColumn(column: number) {
    const plan = dropInColumn(this.level, this.state, column)
    if (!plan) { this.messageLabel.string = '这一列满了，试试其他位置'; this.toastTime = 1.5; return }
    this.plan = plan; this.eventIndex = 0; this.toastTime = 0
    this.currentView.node.active = false
    this.messageLabel.string = '连锁中…'
    this.beginEvent()
  }

  /** 事件驱动节点动画，暂停只冻结时间；没有可能在离场后继续写棋盘的异步动画回调。 */
  private beginEvent() {
    const event = this.plan!.events[this.eventIndex]
    this.elapsed = 0; this.motions = []; this.mergeVisuals = []
    if (event.kind === 'drop') {
      const to = this.cellPosition(event.cell)
      const hover = this.boardRoot.getComponent(UITransform)!.convertToNodeSpaceAR(this.currentView.node.worldPosition)
      const from = new Vec3(to.x, hover.y, 0)
      const piece = this.createPiece(event.value, from)
      this.board[event.cell.row][event.cell.column] = piece
      this.motions = [{ node: piece.node, from, to }]
      this.duration = Math.max(.001, (from.y - to.y) / LEVEL_DROP_SPEED)
    } else if (event.kind === 'gravity') {
      const moving = event.moves.map(move => ({ ...move, piece: this.board[move.from.row][move.from.column]! }))
      moving.forEach(move => { this.board[move.from.row][move.from.column] = null })
      moving.forEach(move => {
        this.board[move.to.row][move.to.column] = move.piece
        this.motions.push({ node: move.piece.node, from: move.piece.node.position.clone(), to: this.cellPosition(move.to) })
      })
      this.duration = LEVEL_GRAVITY_DURATION
    } else {
      // 全盘同批合并一起播放，只由第一组发声和显示连击，避免多组串行变慢。
      for (let i = this.eventIndex; i < this.plan!.events.length; i++) {
        const group = this.plan!.events[i]
        if (group.kind !== 'merge' || group.batch !== event.batch) break
        this.mergeVisuals.push({ event: group, anchor: this.board[group.anchor.row][group.anchor.column]!, upgraded: false,
          consumed: group.members.filter(cell => cell.row !== group.anchor.row || cell.column !== group.anchor.column).map(cell => {
            const piece = this.board[cell.row][cell.column]!
            const opacity = piece.node.getComponent(UIOpacity) ?? piece.node.addComponent(UIOpacity)
            opacity.opacity = 255
            return { piece, origin: piece.node.position.clone(), opacity, shattered: false }
          }) })
        for (const cell of group.broken) {
          const ice = this.iceViews[cell.row][cell.column]
          if (ice?.isValid) ice.playBreak(-427 - this.cellPosition(cell).y)
          this.iceViews[cell.row][cell.column] = null
        }
      }
      const index = Math.min(event.chainDepth - 2, this.comboAudioClips.length - 1)
      this.playSound((index >= 0 ? this.comboAudioClips[index] : null) ?? this.mergeAudioClip)
      this.duration = LEVEL_MERGE_DURATION
    }
  }

  private finishEvent() {
    const plan = this.plan!, event = plan.events[this.eventIndex]
    if (event.kind === 'merge') {
      for (const group of this.mergeVisuals) {
        for (const cell of group.event.members) {
          if (cell.row === group.event.anchor.row && cell.column === group.event.anchor.column) continue
          const piece = this.board[cell.row][cell.column]
          if (piece?.isValid && piece.node?.isValid) piece.node.destroy()
          this.board[cell.row][cell.column] = null
        }
        group.anchor.node.setScale(1, 1, 1)
      }
    } else if (event.kind === 'drop') {
      this.clearEffects()
      if (plan.events[this.eventIndex + 1]?.kind !== 'merge') this.playSound(this.collisionAudioClip)
    }
    this.eventIndex += event.kind === 'merge' ? this.mergeVisuals.length : 1
    if (this.eventIndex < plan.events.length) { this.beginEvent(); return }
    this.state = plan.state; this.plan = null; this.motions = []; this.mergeVisuals = []
    LevelProgressStore.save(this.state)
    this.renderQueue()
    this.messageLabel.string = DROP_HINT
    if (this.state.status !== 'playing') {
      this.pendingResult = true
      this.tryShowResult()
    }
  }

  update(dt: number) {
    if (this.paused || this.disposed || this.leaving) return
    if (this.pendingResult) this.tryShowResult()
    if (this.toastTime > 0) { this.toastTime -= dt; if (this.toastTime <= 0) this.messageLabel.string = DROP_HINT }
    let remaining = dt
    while (this.plan && remaining > 0) {
      const step = Math.min(remaining, this.duration - this.elapsed)
      this.elapsed += step; remaining -= step
      const event = this.plan.events[this.eventIndex]
      if (event.kind === 'merge') this.updateMergeVisuals()
      else {
        const t = Math.min(1, this.elapsed / this.duration)
        const eased = event.kind === 'gravity' ? quadOut(t) : t
        this.motions.forEach(motion => {
          if (motion.node.isValid) motion.node.setPosition(Vec3.lerp(new Vec3(), motion.from, motion.to, eased))
        })
      }
      if (this.elapsed >= this.duration) this.finishEvent()
      else break
    }
  }

  /** 周围原地碎裂与锚点升级重叠播放，参数逐项对应无尽版，不重新结算玩法。 */
  private updateMergeVisuals() {
    this.mergeVisuals.forEach((group, groupIndex) => {
      group.consumed.forEach((item, index) => {
        const frame = sampleLevelClear(this.elapsed, index, 112)
        item.piece.node.setPosition(item.origin.x, item.origin.y + frame.rise, item.origin.z)
        item.piece.node.setScale(frame.scale, frame.scale, 1)
        item.opacity.opacity = frame.opacity
        if (frame.shattered && !item.shattered) {
          item.shattered = true
          this.effects?.spawnSkillShatterParticles(item.piece, item.origin, 3, .24)
        }
      })
      const frame = sampleLevelUpgrade(this.elapsed)
      if (frame.upgraded && !group.upgraded) {
        group.upgraded = true
        group.anchor.setValue(group.event.value)
        const position = this.cellPosition(group.event.anchor), strength = group.consumed.length
        this.effects?.spawnUpgradeImpact(group.anchor, position, strength)
        this.effects?.spawnMergeFlash(group.anchor, position, strength)
        this.effects?.spawnMergeBurst(group.anchor, position, strength)
        if (groupIndex === 0) this.combo?.play({ parent: this.fxLayer, anchorPosition: position,
          chainDepth: group.event.chainDepth, pieceSize: 112, bounds: { left: -300, right: 300, top: 422, bottom: -422 } })
        this.renderGoals(group.event.collected, this.iceViews.reduce((total, row) => total + row.filter(Boolean).length, 0))
      }
      group.anchor.node.setScale(frame.scale, frame.scale, 1)
    })
  }

  private playSound(clip: AudioClip | null) {
    if (clip && this.effectAudio?.isValid) this.effectAudio.playOneShot(clip)
  }

  private clearEffects() { this.combo?.clear(); this.transientFx?.clear() }

  private setPaused(paused: boolean) {
    this.cancelSelection()
    this.paused = paused; this.pauseOverlay.renderState(paused)
    this.transientFx?.setPaused(paused)
    this.iceLayer.getComponentsInChildren(LevelIceView).forEach(ice => { ice.paused = paused })
  }

  private async shareFromSettings() {
    const result = await this.shareAdapter.shareStartPage('level_pause_share')
    if (this.disposed || !this.isValid || !this.node?.isValid || this.leaving) return
    if (result === 'unsupported') { this.messageLabel.string = '当前平台暂不支持分享'; this.toastTime = 2 }
  }

  private countIce(ice: number[][]) { return ice.reduce((total, row) => total + row.filter(Boolean).length, 0) }

  private tryShowResult() {
    // 最后一块冰也要完整落地，再展示结算，避免弹窗遮住破冰收尾。
    if (this.iceLayer.getComponentsInChildren(LevelIceView).some(ice => ice.isValid && ice.breaking)) return
    this.pendingResult = false
    this.showResult()
  }

  private showResult() {
    this.cancelSelection()
    const won = this.state.status === 'won', last = this.level.id === LEVELS.length
    this.resultTitle.string = won ? '闯关成功' : '花园满了'
    this.resultSummary.string = won ? last ? '当前关卡全部完成！' : '目标达成，新的挑战已开启' : '换个落点，再布置一轮连锁'
    this.resultActionLabel.string = won && !last ? '下一关' : '重新挑战'
    this.resultPanel.active = true
  }

  private goHome() {
    if (this.leaving) return
    this.leaving = true
    this.cancelSelection()
    // 动画中保留上一稳定检查点，重进会从整次落子之前恢复，不保存半场合并。
    LevelProgressStore.save(this.state)
    const accepted = director.loadScene('home', error => {
      if (!error || !this.isValid || !this.node?.isValid) return
      this.leaving = false; this.messageLabel.string = '返回失败，请重试'
    })
    if (accepted === false) { this.leaving = false; this.messageLabel.string = '返回失败，请重试' }
  }

  private syncLayout() {
    if (!this.designRoot?.isValid || !this.background?.isValid) return
    const visible = view.getVisibleSize(), safe = sys.getSafeAreaRect(), win = screen.windowSize
    const key = `${visible.width}:${visible.height}:${safe.y}:${safe.height}:${win.height}`
    if (this.layoutKey === key) return
    this.cancelSelection()
    this.layoutKey = key
    const pixelToUi = visible.height / Math.max(1, win.height)
    let top = Math.max(0, win.height - safe.y - safe.height) * pixelToUi
    const wxApi = (globalThis as unknown as { wx?: { getMenuButtonBoundingClientRect?: () => { bottom: number } } }).wx
    const menu = wxApi?.getMenuButtonBoundingClientRect?.()
    if (menu && menu.bottom > 0) top = Math.max(top, (menu.bottom + 12) * pixelToUi)
    const bottom = Math.max(0, safe.y) * pixelToUi
    const scale = Math.min(visible.width / 750, (visible.height - top - bottom - 24) / 1334)
    this.designRoot.setScale(scale, scale, 1); this.designRoot.setPosition(0, (bottom - top) / 2, 0)
    const cover = Math.max(visible.width / 750, visible.height / 1625)
    this.background.setScale(cover, cover, 1)
    // 设置层独立于安全区缩放容器，面板沿用设计比例，遮罩覆盖整个可见屏幕。
    this.pauseOverlay.node.setScale(scale, scale, 1)
    this.pauseOverlay.node.getComponent(UITransform)!.setContentSize(visible.width / scale, visible.height / scale)
    this.pauseOverlay.syncLayout()
  }

  onDisable() { this.cancelSelection() }

  onDestroy() {
    if (this.disposed) return
    this.disposed = true
    this.cancelSelection()
    this.clearEffects()
    if (this.pauseOverlay?.isValid) this.pauseOverlay.dispose()
    view.off('canvas-resize', this.syncLayout, this)
    if (this.boardRoot?.isValid) {
      this.boardRoot.off(Node.EventType.TOUCH_START, this.onBoardTouchStart, this)
      this.boardRoot.off(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this)
      this.boardRoot.off(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this)
      this.boardRoot.off(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this)
    }
    for (const binding of this.bindings || []) if (binding.node?.isValid) binding.node.off(Button.EventType.CLICK, binding.callback, this)
    this.bindings = []; this.motions = []; this.mergeVisuals = []; this.plan = null
  }
}
