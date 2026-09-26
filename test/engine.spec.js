import { describe, it, expect } from 'vitest'
import {
  SIZE,
  P1,
  P2,
  ownerOf,
  isKing,
  createGame,
  startGame,
  legalMoves,
  applyMove,
  winnerOf,
  countPieces,
  serialize,
  deserialize,
  nextState,
} from '../src/engine.js'

const empty = () => {
  const s = startGame(createGame())
  s.board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0))
  return s
}

describe('checkers/engine — setup', () => {
  it('deals 12 men per side on the dark squares', () => {
    const s = startGame(createGame())
    expect(countPieces(s, P1)).toBe(12)
    expect(countPieces(s, P2)).toBe(12)
    // p1 at the bottom, p2 at the top; all on dark squares
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (s.board[r][c] !== 0) expect((r + c) % 2).toBe(1)
    expect(s.turn).toBe(P1)
  })
})

describe('checkers/engine — moving', () => {
  it('a man steps one square diagonally forward', () => {
    const s = empty()
    s.board[5][2] = 1
    s.turn = P1
    const moves = legalMoves(s)
    // p1 moves up (row −): to [4,1] and [4,3]
    const tos = moves.map((m) => m.to.join(','))
    expect(tos).toContain('4,1')
    expect(tos).toContain('4,3')
    expect(moves.every((m) => m.captured.length === 0)).toBe(true)
  })

  it('promotes a man reaching the last rank to a king', () => {
    const s = empty()
    s.board[1][2] = 1 // p1 man one step from the top rank
    s.turn = P1
    applyMove(s, { from: [1, 2], to: [0, 1], captured: [] })
    expect(isKing(s.board[0][1])).toBe(true)
    expect(ownerOf(s.board[0][1])).toBe(P1)
  })
})

describe('checkers/engine — captures are mandatory + maximal', () => {
  it('forces a capture when one is available (no quiet moves offered)', () => {
    const s = empty()
    s.board[5][2] = 1
    s.board[4][3] = -1 // enemy adjacent, [3,4] empty beyond
    s.turn = P1
    const moves = legalMoves(s)
    expect(moves).toHaveLength(1)
    expect(moves[0].captured).toHaveLength(1)
    expect(moves[0].to).toEqual([3, 4])
  })

  it('requires the maximum capture (a double over a single)', () => {
    const s = empty()
    // p1 man at [6,3] can double-capture: over [5,2]→[4,1], then over [3,2]→[2,3]
    s.board[6][3] = 1
    s.board[5][2] = -1
    s.board[3][2] = -1
    // a lone p1 man elsewhere that could only single-capture
    s.board[6][7] = 1
    s.board[5][6] = -1
    s.turn = P1
    const moves = legalMoves(s)
    expect(moves.every((m) => m.captured.length === 2)).toBe(true)
    expect(moves.some((m) => m.from.join(',') === '6,3')).toBe(true)
    expect(moves.some((m) => m.from.join(',') === '6,7')).toBe(false) // single is illegal
  })

  it('a man captures backward too', () => {
    const s = empty()
    s.board[3][2] = 1
    s.board[4][3] = -1 // behind the p1 man (p1 moves up, this is a backward capture)
    s.turn = P1
    const moves = legalMoves(s)
    expect(moves).toHaveLength(1)
    expect(moves[0].to).toEqual([5, 4])
  })
})

describe('checkers/engine — flying king', () => {
  it('moves any distance along an open diagonal', () => {
    const s = empty()
    s.board[7][0] = 2 // p1 king
    s.turn = P1
    const tos = legalMoves(s).map((m) => m.to.join(','))
    expect(tos).toEqual(expect.arrayContaining(['6,1', '5,2', '4,3', '3,4']))
  })

  it('captures at range and can land on any empty square beyond', () => {
    const s = empty()
    s.board[7][0] = 2
    s.board[4][3] = -1 // enemy along the up-right diagonal
    s.turn = P1
    const moves = legalMoves(s)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every((m) => m.captured.length === 1)).toBe(true)
    const tos = moves.map((m) => m.to.join(','))
    expect(tos).toEqual(expect.arrayContaining(['3,4', '2,5']))
  })
})

describe('checkers/engine — winning', () => {
  it('wins when the opponent has no pieces left', () => {
    const s = empty()
    s.board[5][2] = 1
    s.board[4][3] = -1 // p1 captures the last p2 piece
    s.turn = P1
    applyMove(s, { from: [5, 2], to: [3, 4], captured: [[4, 3]] })
    expect(s.status).toBe('won')
    expect(s.winner).toBe(P1)
  })

  it('wins when the side to move has no legal move', () => {
    const s = empty()
    // p2's only man is cornered at [0,7]: down-left is an enemy and the square
    // beyond it is blocked, so it can neither step nor capture.
    s.board[0][7] = -1
    s.board[1][6] = 1
    s.board[2][5] = 1
    s.turn = P2
    expect(legalMoves(s)).toHaveLength(0)
    expect(winnerOf(s)).toBe(P1)
  })
})

describe('checkers/engine — serialization', () => {
  it('round-trips the board + turn', () => {
    const s = startGame(createGame())
    applyMove(s, legalMoves(s)[0])
    const str = serialize(s)
    const back = deserialize(str)
    expect(back.board).toEqual(s.board)
    expect(back.turn).toBe(s.turn)
    expect(str).toContain('|')
  })
})

describe('checkers/engine — nextState (pure child generator for the AI search)', () => {
  it('applies a simple step without mutating the input', () => {
    const s = startGame(createGame())
    const before = serialize(s)
    const ns = nextState(s, { from: [5, 0], to: [4, 1], captured: [] })
    expect(serialize(s)).toBe(before) // original untouched
    expect(ns.board[4][1]).toBe(1)
    expect(ns.board[5][0]).toBe(0)
    expect(ns.turn).toBe(P2)
    expect(ns.moves).toBe(s.moves + 1)
  })

  it('removes captured men and promotes on the last rank', () => {
    const s = empty()
    s.board[2][2] = 1 // p1 man one step from promotion
    s.board[1][3] = -1 // enemy to jump
    s.turn = P1
    const ns = nextState(s, { from: [2, 2], to: [0, 4], captured: [[1, 3]] })
    expect(ns.board[1][3]).toBe(0) // victim gone
    expect(ns.board[0][4]).toBe(2) // promoted to a king on row 0
    expect(ns.promoted).toBe(true)
    expect(ns.turn).toBe(P2)
  })

  it('agrees with applyMove on the resulting board/turn', () => {
    const s = startGame(createGame())
    const move = { from: [5, 2], to: [4, 3], captured: [] }
    const ns = nextState(s, move)
    const clone = startGame(createGame())
    applyMove(clone, move)
    expect(ns.board).toEqual(clone.board)
    expect(ns.turn).toBe(clone.turn)
  })
})

describe('checkers/engine: o que applyMove RESPONDE, e não só o que ele move', () => {
  /**
   * A tela liga som, animação de captura e o aviso de dama a partir DESTE
   * retorno. Ele era executado por metade da suíte e conferido por nenhum
   * teste: um `ok` que virasse `false` deixaria a partida jogando normalmente e
   * a tela muda.
   */
  it('confirma o lance, conta as capturas e avisa a coroação', () => {
    const s = empty()
    s.board[1][2] = 1 // homem de P1 a um passo da coroação
    s.turn = P1
    const r = applyMove(s, { from: [1, 2], to: [0, 1], captured: [] })
    expect(r.ok).toBe(true)
    expect(r.captured).toBe(0)
    expect(r.promoted).toBe(true)
  })

  it('conta as duas peças de um lance duplo', () => {
    const s = empty()
    s.board[5][0] = 1
    s.board[4][1] = -1
    s.board[2][3] = -1
    s.turn = P1
    const r = applyMove(s, legalMoves(s)[0])
    expect(r.ok).toBe(true)
    expect(r.captured).toBe(2)
    expect(r.promoted).toBe(false)
  })

  it('recusa um lance ilegal sem mexer no tabuleiro', () => {
    const s = empty()
    s.board[5][2] = 1
    s.turn = P1
    const antes = serialize(s)
    const r = applyMove(s, { from: [5, 2], to: [0, 0], captured: [] })
    expect(r.ok).toBe(false)
    expect(r.captured).toBeUndefined()
    expect(serialize(s)).toBe(antes)
  })
})

describe('checkers/engine: a serialização aguenta o que chega da rede', () => {
  it('lê um caractere que não existe no alfabeto como casa vazia', () => {
    // O texto vem do sync online, então pode chegar truncado ou sujo. O
    // fallback é o que impede um `undefined` de entrar no tabuleiro e derrubar
    // a partida dos dois lados.
    const sujo = `${'?'.repeat(SIZE * SIZE)}|1`
    const back = deserialize(sujo)
    expect(back.board.flat().every((v) => v === 0)).toBe(true)
    expect(back.turn).toBe(P1)
  })

  it('lê uma string curta sem deixar buraco no tabuleiro', () => {
    const back = deserialize('ww|2')
    expect(back.board[0][0]).toBe(1)
    expect(back.board[0][1]).toBe(1)
    expect(back.board.flat()).toHaveLength(SIZE * SIZE)
    expect(back.board.flat().filter((v) => v === 1)).toHaveLength(2)
    expect(back.turn).toBe(P2)
  })
})
