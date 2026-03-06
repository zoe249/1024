import { _decorator, Component, Node, Prefab, instantiate } from 'cc'
import { PieceController } from './PieceController'
const { ccclass, property } = _decorator

@ccclass('PlayController')
export class PlayController extends Component {
  @property({
    tooltip: '棋盘宽度，单位格子数'
  })
  boardwidth: number = 5
  @property({
    tooltip: '棋盘高度，单位格子数'
  })
  boardheight: number = 7

  @property({
    type: Prefab,
    tooltip: '基础棋子控制器'
  })
  basePieceController: Prefab = null

  @property({ type: Number, tooltip: '棋子间距' })
  public spacing: number = 96

  @property({ type: Number, tooltip: '棋子初始X坐标' })
  private x: number = -260

  @property({ type: Number, tooltip: '棋子初始Y坐标' })
  private y: number = -390

  @property({ type: Number, tooltip: '棋子大小' })
  private pieceSize: number = 120

  basePieceList: number[] = [2, 4, 8, 16, 32, 64, 128]
  startPosition: { x: number; y: number } = { x: 0, y: 0 }

  currentPiece: PieceController = null

  start() {
    this.generateBoard()
    this.generatePiece()
  }

  update(deltaTime: number) {
    // 判断当前棋子是否可以继续下落
    if (this.currentPiece) {
      if (this.checkCurrentFall()) {
        this.currentPiece.stopFalling()
        this.currentPiece = null
        // 生成新的棋子
        this.generatePiece()
      }
    }
  }

  //   const pieceNode = this.createPiece(Math.pow(2, row))
  // const pieceController = pieceNode.getComponent(PieceController)
  // pieceController.isFalling = false
  // let positionX = this.x + col * this.pieceSize + this.spacing * col
  // let positionY = this.y + row * this.pieceSize + this.spacing * row
  // pieceNode.setPosition(positionX, positionY)
  // this.node.addChild(pieceNode)
  /**
   * 生成棋盘空格子
   */
  generateBoard() {
    const boardNode = []
    for (let col = 0; col < this.boardwidth; col++) {
      const columnNode = []
      for (let row = 0; row < this.boardheight; row++) {
        const node = {
          val: 0,
          topLeft: null,
          topRight: null,
          bottomLeft: null,
          bottomRight: null
        }

        // 计算格子四个角的坐标
        // 是从棋盘的左下角开始计算的，所以x坐标是从左到右递增的，y坐标是从下到上递增的
        node.bottomLeft= [this.x + col * this.pieceSize + this.spacing * col, this.y + row * this.pieceSize + this.spacing * row]
        node.bottomRight= [this.x + (col + 1) * this.pieceSize + this.spacing * (col), this.y + row * this.pieceSize + this.spacing * row]
        node.topRight= [this.x + (col + 1) * this.pieceSize + this.spacing * (col), this.y + (row + 1) * this.pieceSize + this.spacing * (row)]
        node.topLeft= [this.x + col * this.pieceSize + this.spacing * col, this.y + (row + 1) * this.pieceSize + this.spacing * (row)]
        columnNode.push(node)


        let positionX = this.x + col * this.pieceSize + this.spacing * col
        let positionY = this.y + row * this.pieceSize + this.spacing * row
        // boardNode.push(rowNode)
      }
      boardNode.push(columnNode)
      // 生成空格子，将格子四个角的坐标保存到node对象中，方便后续判断棋子是否可以继续下落
    }

    console.log(boardNode)
  }

  /**
   * 判断当前棋子是否可以继续下落
   * 根据棋盘格子数量进行判断，如果下方的格子的值为1时，说明已经有棋子了，不能继续下落了
   * 如果下方的格子的值为0时，说明没有棋子了，可以继续下落了
   *
   * 如果是最后一行，说明已经到了底部，不能继续下落了
   * @returns
   */
  checkCurrentFall(): boolean {
    return this.currentPiece.node.position.y <= -600
  }

  generatePiece() {
    const index = Math.floor(Math.random() * this.basePieceList.length)
    const pieceNode = this.createPiece(this.basePieceList[index])
    pieceNode.setPosition(this.startPosition.x, this.startPosition.y)
    this.node.addChild(pieceNode)
    this.currentPiece = pieceNode.getComponent(PieceController)
  }

  createPiece(val: number) {
    const pieceNode = instantiate(this.basePieceController)
    const pieceController = pieceNode.getComponent(PieceController)
    pieceController.setValue(val)
    return pieceNode
  }
}
