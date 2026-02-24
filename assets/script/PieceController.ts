import { _decorator, Component, Node, Sprite, Color, Label } from 'cc';
const { ccclass, property } = _decorator;

type PieceInfo = {
    value: number
    bColor: string
}

@ccclass('PieceController')
export class PieceController extends Component {

    pieceInfoList: PieceInfo[] = [
        {
            value: 2,
            bColor: '#ff89d1'
        },
        {
            value: 4,
            bColor: '#7c55fa'
        },
        {
            value: 8,
            bColor: '#a55fd4'
        },
        {
            value: 16,
            bColor: '#14e2de'
        },
        {
            value: 32,
            bColor: '#62ccfe'
        },
        {
            value: 64,
            bColor: '#89e66c'
        },
        {
            value: 128,
            bColor: '#f87275'
        },
        {
            value: 256,
            bColor: '#a46f62'
        },
        {
            value: 512,
            bColor: '#8d949c'
        },
        {
            value: 1024,
            bColor: '#ffb659'
        },
    ]
    start() {

    }

    update(deltaTime: number) {
        
    }

    setValue(value: number) {
        const pieceInfo = this.pieceInfoList.find(item => item.value === value)
        if (!pieceInfo) {
            return
        }
        const _sprite = this.node.getComponent(Sprite)
        const _value = this.node.getChildByName('Value')
        const color = new Color()
        Color.fromHEX(color, pieceInfo.bColor); 
        _sprite.color = color

        const _valueLabel = _value.getComponent(Label)
        _valueLabel.string = value.toString()
        console.log('__', _valueLabel)
    }
}

