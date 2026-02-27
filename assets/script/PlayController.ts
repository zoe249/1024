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

  basePieceList: number[] = [2, 4, 8, 16, 32, 64, 128]
  startPosition: { x: number; y: number } = { x: 0, y: 0 }

  currentPiece: PieceController = null

  start() {
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

  /**
   * 判断当前棋子是否可以继续下落
   * 根据棋盘格子数量进行判断，如果下方的格子为1时，说明已经有棋子了，不能继续下落了
   * 如果下方的格子为0时，说明没有棋子了，可以继续下落了
   * 
   * 如果是最后一行，说明已经到了底部，不能继续下落了
   * @returns 
   */
  checkCurrentFall(): boolean {
    return this.currentPiece.node.position.y <= -300
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
