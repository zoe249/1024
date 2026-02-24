import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { PieceController } from './PieceController';
const { ccclass, property } = _decorator;

@ccclass('PlayController')
export class PlayController extends Component {
    
    @property({
        type: Prefab,
        tooltip: '基础棋子控制器',
    })
    basePieceController: Prefab = null

    start() {
        for (let i = 0; i < 10; i++) {
            const pieceNode = this.createPiece(Math.pow(2, i + 1))
            pieceNode.setPosition(i * 100, i * 100)
            this.node.addChild(pieceNode)
        }
    }

    update(deltaTime: number) {
        
    }

    createPiece(val: number) {
        const pieceNode = instantiate(this.basePieceController)
        const pieceController = pieceNode.getComponent(PieceController)
        pieceController.setValue(val)
        return pieceNode
    }
}

