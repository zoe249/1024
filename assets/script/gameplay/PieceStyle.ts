export type PieceDecoration = 'none' | 'sparkle' | 'crown'

export type PieceStyle = {
  bodyColor: string
  textColor?: string
  outlineColor?: string
  decoration?: PieceDecoration
  textScale?: number
}

const DEFAULT_STYLE: PieceStyle = { bodyColor: '#cf586d' }

// 棋盘棋子与结算缩略图共用色阶，避免同一个数字显示成不同颜色。
const PIECE_STYLE: Record<number, PieceStyle> = {
  2: { bodyColor: '#f8ecdc' },
  4: { bodyColor: '#f7a536' },
  8: { bodyColor: '#ffc22e' },
  16: { bodyColor: '#9bc849' },
  32: { bodyColor: '#50ae61' },
  64: { bodyColor: '#35a1a5' },
  128: { bodyColor: '#3f88c7' },
  256: { bodyColor: '#5872c8' },
  512: { bodyColor: '#6e55b8' },
  1024: { bodyColor: '#8f54ad', textScale: 0.94 },
  2048: { bodyColor: '#cf586d', textScale: 0.9 },
  4096: { bodyColor: '#db5935', textScale: 0.9 },
  8192: {
    bodyColor: '#2f6c78',
    textColor: '#ffe4a0',
    outlineColor: '#e8ad2d',
    decoration: 'crown',
    textScale: 0.86
  }
}

export function getPieceStyle(value: number): PieceStyle {
  return PIECE_STYLE[value] ?? DEFAULT_STYLE
}
