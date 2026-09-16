import { EventTouch, Node, UITransform, Vec3 } from 'cc'

type BoardGeometryOptions = {
  boardWidth: number
  boardHeight: number
  pieceSize: number
  spacing: number
  spawnOffsetY: number
}

export type BoardGridSize = {
  width: number
  height: number
}

export type BoardCellPosition = {
  row: number
  column: number
}

// 棋盘尺寸、触摸换列与 UI 列占位必须共享同一个步长定义。
export function getBoardGridStep(pieceSize: number, spacing: number) {
  return pieceSize + spacing
}

// 棋盘有效内区只由行列数和单格步长决定，避免场景静态尺寸成为第二套数据源。
export function getBoardGridSize(
  boardWidth: number,
  boardHeight: number,
  pieceSize: number,
  spacing: number
): BoardGridSize {
  const step = getBoardGridStep(pieceSize, spacing)
  return {
    width: boardWidth * step,
    height: boardHeight * step
  }
}

/**
 * 返回某一轴上的格子中心偏移。
 *
 * @param index 从左到右或从下到上的格子索引。
 * @param count 当前轴的格子数量。
 * @param step 单格步长。
 */
export function getBoardCellCenterOffset(index: number, count: number, step: number) {
  return -count * step / 2 + step / 2 + index * step
}

// 返回相邻格子之间的分隔线偏移，供 UI 列装饰和触摸几何共用同一原点。
export function getBoardSeparatorOffset(index: number, count: number, step: number) {
  return -count * step / 2 + (index + 1) * step
}

// 棋盘几何计算集中在这里，避免玩法流程到处关心 BoardFill 尺寸和坐标换算细节。
export class BoardGeometry {
  private options: BoardGeometryOptions

  constructor(private readonly ownerNode: Node, options: BoardGeometryOptions) {
    this.options = options
  }

  // UI 布局可能在运行时同步，外部属性变化后通过这里刷新几何参数。
  updateOptions(options: BoardGeometryOptions) {
    this.options = options
  }

  // 单格步长 = 棋子尺寸 + 列间距，这是所有坐标换算的基础。
  getStepSize() {
    return getBoardGridStep(this.options.pieceSize, this.options.spacing)
  }

  isInsideBoard(row: number, column: number) {
    return row >= 0 && row < this.options.boardHeight && column >= 0 && column < this.options.boardWidth
  }

  /**
   * 把触摸点换算成列索引。
   *
   * 先用棋盘有效内区过滤棋盘外触摸，再转换到当前节点本地坐标，
   * 最后基于实时网格原点计算列，避免 BoardFill 尺寸变化后落列偏移。
   *
   * @param event Cocos 触摸事件。
   * @returns 有效列索引；触摸不在棋盘内时返回 -1。
   */
  getColumnFromTouch(event: EventTouch) {
    const uiLocation = event.getUILocation()
    // 棋盘外的触摸不参与列选择，避免底栏、状态栏等区域误触发加速下落。
    if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
      return -1
    }

    const local = this.getLocalPositionFromTouch(event)
    if (!local) {
      return -1
    }

    return this.getGridIndexFromLocalCoordinate(
      local.x,
      this.getBoardGridOriginX(),
      this.options.boardWidth
    )
  }

  /**
   * 把触摸点换算成棋盘格子坐标。
   *
   * 交换、锤子和炸弹技能都会依赖这个结果判断目标格子，所以这里会同时校验触摸区域、
   * 本地坐标转换结果和棋盘行列边界。
   *
   * @param event Cocos 触摸事件。
   * @returns 合法棋盘格子坐标；触摸无效时返回 null。
   */
  getCellFromTouch(event: EventTouch): BoardCellPosition | null {
    const uiLocation = event.getUILocation()
    if (!this.isTouchInsideBoard(uiLocation.x, uiLocation.y)) {
      return null
    }

    const local = this.getLocalPositionFromTouch(event)
    if (!local) {
      return null
    }

    const column = this.getGridIndexFromLocalCoordinate(
      local.x,
      this.getBoardGridOriginX(),
      this.options.boardWidth
    )
    const row = this.getGridIndexFromLocalCoordinate(
      local.y,
      this.getBoardGridOriginY(),
      this.options.boardHeight
    )
    if (!this.isInsideBoard(row, column)) {
      return null
    }

    return { row, column }
  }

  // Cocos 触摸坐标先从 UI 坐标转成本节点坐标，所有棋盘操作都基于同一坐标系。
  getLocalPositionFromTouch(event: EventTouch) {
    const uiTransform = this.ownerNode.getComponent(UITransform)
    if (!uiTransform) {
      return null
    }

    const uiLocation = event.getUILocation()
    return uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0))
  }

  // 使用棋盘有效内区判断触摸，避免外框宽度变化后触摸区域跟着漂移。
  isTouchInsideBoard(x: number, y: number) {
    const ownerTransform = this.ownerNode.getComponent(UITransform)
    const boardNode = this.ownerNode.getChildByName('board')
    if (!ownerTransform || !boardNode) {
      return false
    }

    const local = ownerTransform.convertToNodeSpaceAR(new Vec3(x, y, 0))
    const boardPosition = boardNode.position
    const halfWidth = this.getBoardInnerWidth() / 2
    const halfHeight = this.getBoardInnerHeight() / 2
    return (
      local.x >= boardPosition.x - halfWidth &&
      local.x < boardPosition.x + halfWidth &&
      local.y >= boardPosition.y - halfHeight &&
      local.y < boardPosition.y + halfHeight
    )
  }

  /**
   * 使用格子左边界和 floor 统一解析行列。
   *
   * 普通落子和三个技能都走这里，确保边界触摸不会一边吸附到末列、另一边却返回空目标。
   */
  private getGridIndexFromLocalCoordinate(coordinate: number, firstCenter: number, count: number) {
    const step = this.getStepSize()
    const firstEdge = firstCenter - step / 2
    const index = Math.floor((coordinate - firstEdge) / step)
    return index >= 0 && index < count ? index : -1
  }

  /**
   * 把棋盘中的行列坐标换成节点本地坐标。
   *
   * 所有落点、重力下落和合并动画都走同一套换算，保证逻辑坐标和 UI 表现对齐。
   *
   * @param row 棋盘行号，0 表示底行。
   * @param column 棋盘列号，0 表示最左列。
   * @returns 当前节点坐标系下的格子中心点。
   */
  getCellPosition(row: number, column: number) {
    const step = this.getStepSize()
    // 从棋盘当前内区实时计算原点，避免边框或尺寸变化后边缘列跑出外框。
    return new Vec3(this.getBoardGridOriginX() + column * step, this.getBoardGridOriginY() + row * step, 0)
  }

  /**
   * 获取新棋子的出生点。
   *
   * x 轴与目标列严格对齐，y 轴放在棋盘顶部之外，让棋子生成后可以垂直下落进入棋盘。
   *
   * @param column 目标出生列。
   * @returns 当前节点坐标系下的出生位置。
   */
  getSpawnPosition(column: number) {
    const step = this.getStepSize()
    // 出生点也复用同一套网格原点，保证生成后垂直落下时不会偏列。
    return new Vec3(
      this.getBoardGridOriginX() + column * step,
      this.getBoardGridOriginY() + this.options.boardHeight * step + this.options.spawnOffsetY,
      0
    )
  }

  /**
   * 读取棋盘有效内区宽度。
   *
   * 优先读取 BoardFill，缺失时使用行列数与格子步长计算。
   * 这样棋盘装饰样式变化时，逻辑层仍以真实可落子区域为准。
   *
   * @returns 棋盘有效内区宽度。
   */
  private getBoardInnerWidth() {
    const fillTransform = this.ownerNode.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform && fillTransform.width > 0) {
      return fillTransform.width
    }

    // BoardFill 缺失时不再从外框反推，直接复用 UI 的标准网格公式。
    return this.getExpectedBoardGridSize().width
  }

  /**
   * 读取棋盘有效内区高度。
   *
   * 优先读取 BoardFill，缺失时使用行列数与格子步长计算。
   * 这样棋盘装饰样式变化时，逻辑层仍以真实可落子区域为准。
   *
   * @returns 棋盘有效内区高度。
   */
  private getBoardInnerHeight() {
    const fillTransform = this.ownerNode.getChildByName('board')?.getChildByName('BoardFill')?.getComponent(UITransform)
    if (fillTransform && fillTransform.height > 0) {
      return fillTransform.height
    }

    // 与宽度使用完全相同的兜底来源，避免横纵轴出现不同的隐式边距。
    return this.getExpectedBoardGridSize().height
  }

  private getExpectedBoardGridSize() {
    return getBoardGridSize(
      this.options.boardWidth,
      this.options.boardHeight,
      this.options.pieceSize,
      this.options.spacing
    )
  }

  // 根据棋盘当前内区宽度计算左下角第一个格子的中心 x 坐标。
  private getBoardGridOriginX() {
    return this.getBoardLocalPosition().x + getBoardCellCenterOffset(0, this.options.boardWidth, this.getStepSize())
  }

  // 根据棋盘当前内区高度计算左下角第一个格子的中心 y 坐标。
  private getBoardGridOriginY() {
    return this.getBoardLocalPosition().y + getBoardCellCenterOffset(0, this.options.boardHeight, this.getStepSize())
  }

  // board 可以在 UI 重构时整体移动，棋子和触摸换算必须同步这个局部偏移。
  private getBoardLocalPosition() {
    return this.ownerNode.getChildByName('board')?.position ?? Vec3.ZERO
  }
}
