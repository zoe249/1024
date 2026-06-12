import { PieceController } from './PieceController'
import { Tween, UIOpacity } from 'cc'

export type BoardCell = PieceController | null

export type BoardPosition = {
  row: number
  column: number
}

// 棋盘数据的基础查询集中在这里，合并流程仍保留在 PlayController 中逐步拆分。
export class BoardModel {
  createEmptyBoard(rowCount: number, columnCount: number): BoardCell[][] {
    return Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, () => null)
    )
  }

  // 返回某列第一个空行，row 仍按“从下往上增长”的规则扫描。
  getDropRow(board: BoardCell[][], rowCount: number, column: number) {
    for (let row = 0; row < rowCount; row++) {
      if (!board[row][column]) {
        return row
      }
    }
    return -1
  }

  isBoardFull(board: BoardCell[][], rowCount: number, columnCount: number) {
    for (let column = 0; column < columnCount; column++) {
      if (this.getDropRow(board, rowCount, column) >= 0) {
        return false
      }
    }
    return true
  }

  /**
   * 查找离目标列最近的可落子列。
   *
   * 优先返回玩家触摸的目标列；如果目标列已满，则按距离同时向左、向右扩散查找。
   * 这样玩家点到满列时，会尽量落到视觉上最接近的可用列。
   *
   * @param board 当前棋盘数组。
   * @param rowCount 棋盘行数。
   * @param columnCount 棋盘列数。
   * @param preferredColumn 玩家优先选择的列。
   * @returns 可落子列；所有列都不可用时返回 -1。
   */
  getNearestAvailableColumn(board: BoardCell[][], rowCount: number, columnCount: number, preferredColumn: number) {
    if (preferredColumn >= 0 && preferredColumn < columnCount && this.getDropRow(board, rowCount, preferredColumn) >= 0) {
      return preferredColumn
    }

    for (let distance = 1; distance < columnCount; distance++) {
      const left = preferredColumn - distance
      if (left >= 0 && this.getDropRow(board, rowCount, left) >= 0) {
        return left
      }

      const right = preferredColumn + distance
      if (right < columnCount && this.getDropRow(board, rowCount, right) >= 0) {
        return right
      }
    }

    return -1
  }

  /**
   * 在棋盘数组里查找某颗棋子当前所在的行列坐标。
   *
   * 棋子节点动画和棋盘数据可能在结算阶段短暂不同步，所以需要以 board 数组为准查找。
   *
   * @param board 当前棋盘数组。
   * @param rowCount 棋盘行数。
   * @param columnCount 棋盘列数。
   * @param target 要查找的棋子控制器。
   * @returns 棋子所在格子；未找到时返回 null。
   */
  findPiece(board: BoardCell[][], rowCount: number, columnCount: number, target: PieceController): BoardPosition | null {
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        if (board[row][column] === target) {
          return { row, column }
        }
      }
    }

    return null
  }

  // 清理棋盘内已经落地的棋子节点，返回首页和重新开始都复用这套收口逻辑。
  destroyBoardPieces(board: BoardCell[][], rowCount: number, columnCount: number) {
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        const piece = board[row][column]
        if (!piece) {
          continue
        }

        if (piece.node.isValid) {
          // 销毁棋子前先停掉节点动画，避免场景切换后 tween 回调继续访问已销毁节点。
          Tween.stopAllByTarget(piece.node)
          const opacity = piece.node.getComponent(UIOpacity)
          if (opacity) {
            Tween.stopAllByTarget(opacity)
          }
          piece.node.destroy()
        }
        board[row][column] = null
      }
    }
  }
}
