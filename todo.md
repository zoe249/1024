## 棋盘结构

```typescript
// 七行五列
const ROW = 7
const COL = 5

let board: number[][] = Array.from({ length: ROW }, () => Array(COL).fill(0))
```

## 下落快

在屏幕外生成新快，随后在中间单列掉落，如果没有手动控制，则匀速在中间掉落，否则随着用户的指定列掉落

```ts
// 数据结构
Tile (Node)
 ├─ Bg (Sprite)   ← 纯色 / 渐变背景
 └─ Label (Label) ← 数字

```

## 合成逻辑

```typescript
// 竖向合成
checkMerge(row: number, col: number) {
  let r = row;

  while (r > 0 && board[r][col] === board[r - 1][col]) {
    board[r - 1][col] *= 2;
    board[r][col] = 0;

    r--;

    this.applyGravity(col);
  }
}

// 碰撞监测
update(dt: number) {
  if (!this.falling) return;

  this.timer += dt;
  if (this.timer < this.fallInterval) return;
  this.timer = 0;

  const { row, col } = this.falling;

  if (row === 0 || board[row - 1][col] !== 0) {
    this.land();
  } else {
    this.falling.row--;
    this.updateFallingView();
  }
}


// 重力模拟
applyGravity(col: number) {
  const stack = [];

  for (let r = 0; r < ROW; r++) {
    if (board[r][col] !== 0) stack.push(board[r][col]);
  }

  for (let r = 0; r < ROW; r++) {
    board[r][col] = stack[r] || 0;
  }

  this.refreshColumnView(col);
}

```

## 棋子预设

```ts
const TILE_STYLE: Record<number, { bg: Color; text: Color }> = {
  2: { bg: new Color(238, 228, 218), text: new Color(119, 110, 101) },
  4: { bg: new Color(237, 224, 200), text: new Color(119, 110, 101) },
  8: { bg: new Color(242, 177, 121), text: Color.WHITE },
  16: { bg: new Color(245, 149, 99), text: Color.WHITE },
  32: { bg: new Color(246, 124, 95), text: Color.WHITE },
  64: { bg: new Color(246, 94, 59), text: Color.WHITE },
  128: { bg: new Color(237, 207, 114), text: Color.WHITE },
  256: { bg: new Color(237, 204, 97), text: Color.WHITE },
  512: { bg: new Color(237, 200, 80), text: Color.WHITE },
  1024: { bg: new Color(237, 197, 63), text: Color.WHITE },
  2048: { bg: new Color(237, 194, 46), text: Color.WHITE },
  4096: { bg: new Color(237, 190, 30), text: Color.WHITE }
}
```
