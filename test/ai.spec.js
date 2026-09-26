import { describe, it, expect } from 'vitest'
import { createGame, startGame, legalMoves, P1 } from '../src/engine.js'
import { bestMove, evaluate, lossScoreAt, LEVELS } from '../src/ai.js'

const empty = () => Array.from({ length: 8 }, () => new Array(8).fill(0))
const st = (board, turn = P1) => ({ board, turn })
const sameMove = (a, b) =>
  a.from[0] === b.from[0] &&
  a.from[1] === b.from[1] &&
  a.to[0] === b.to[0] &&
  a.to[1] === b.to[1] &&
  a.captured.length === b.captured.length

describe('checkers/ai', () => {
  it('evaluates the symmetric start position as 0', () => {
    const g = startGame(createGame())
    expect(evaluate(g)).toBe(0)
  })

  it('returns a legal move from the opening', () => {
    const g = startGame(createGame())
    const m = bestMove(g, 'medium', () => 0.9) // dodge the blunder branch
    expect(m).toBeTruthy()
    expect(legalMoves(g).some((lm) => sameMove(lm, m))).toBe(true)
  })

  it('plays the forced (mandatory) capture', () => {
    const b = empty()
    b[5][2] = 1 // P1 man
    b[4][3] = -1 // P2 man, capturable
    const m = bestMove(st(b), 'hard')
    expect(m.to).toEqual([3, 4])
    expect(m.captured.length).toBe(1)
  })

  it('takes the longer double-jump (maximum capture)', () => {
    const b = empty()
    b[5][0] = 1 // P1 man
    b[4][1] = -1 // first victim
    b[2][3] = -1 // second victim (chain jump)
    const m = bestMove(st(b), 'hard')
    expect(m.captured.length).toBe(2)
  })

  it('easy blunders a random legal move when the RNG says so', () => {
    const g = startGame(createGame())
    const m = bestMove(g, 'easy', () => 0) // 0 < 0.4 → random pick = moves[0]
    expect(sameMove(m, legalMoves(g)[0])).toBe(true)
  })

  it('exposes monotonically deeper difficulty levels', () => {
    expect(LEVELS.easy.depth).toBeLessThan(LEVELS.medium.depth)
    expect(LEVELS.medium.depth).toBeLessThan(LEVELS.hard.depth)
    expect(LEVELS.hard.blunder).toBe(0)
  })
})

describe('checkers/ai: a conta da avaliação, parcela por parcela', () => {
  /**
   * `evaluate` é a única coisa neste arquivo que decide o que é uma boa posição,
   * e ela é a soma de quatro parcelas que se escondem umas nas outras num
   * tabuleiro cheio. Uma peça sozinha por vez separa as quatro, e é assim que
   * cada uma vira um número que alguém afirma.
   */
  const so = (r, c, v) => {
    const b = empty()
    b[r][c] = v
    return st(b)
  }

  it('homem P1 fora do centro, no meio do tabuleiro: 100 + 4 por fileira andada', () => {
    // (6,0): uma fileira andada rumo à coroação (fila 0), coluna de fora,
    // fileira de fundo nenhuma.
    expect(evaluate(so(6, 0, 1))).toBe(104)
  })

  it('as colunas centrais valem exatamente 3 a mais', () => {
    // O mesmo homem, só que na coluna 3. É esse `&&` que fecha a faixa 2..5;
    // virado `||` ele aceita o tabuleiro inteiro e o bônus deixa de distinguir
    // o centro da borda.
    expect(evaluate(so(6, 3, 1))).toBe(107)
    expect(evaluate(so(6, 6, 1))).toBe(104)
  })

  it('a fileira de fundo vale exatamente 2 a mais, nas duas pontas', () => {
    // Damas não ganham bônus de avanço, então a diferença aqui é só a fileira.
    expect(evaluate(so(3, 3, 2))).toBe(178)
    expect(evaluate(so(0, 3, 2))).toBe(180)
    expect(evaluate(so(7, 3, 2))).toBe(180)
  })

  it('o avanço conta na direção da coroação de CADA lado', () => {
    // P1 coroa na fila 0, então subir vale mais.
    expect(evaluate(so(1, 3, 1))).toBe(127)
    expect(evaluate(so(6, 3, 1))).toBe(107)
    // P2 coroa na fila 7, então o espelho exato vale o mesmo com o sinal
    // trocado. Se o sinal ou a direção escorregar, um dos dois números muda.
    expect(evaluate(so(6, 3, -1))).toBe(-127)
    expect(evaluate(so(1, 3, -1))).toBe(-107)
  })

  it('a dama vale 175 e não ganha bônus por onde está na coluna do avanço', () => {
    expect(evaluate(so(3, 3, 2))).toBe(178)
    expect(evaluate(so(3, 3, 1))).toBe(119)
  })
})

describe('checkers/ai: perder tarde é melhor do que perder cedo', () => {
  it('a derrota mais distante pontua mais alto, exatamente por lance', () => {
    // O sinal desta soma é a diferença entre uma IA que resiste e uma que
    // entrega a partida no lance seguinte. Por dentro da busca as duas versões
    // são o mesmo número enorme e negativo, e nenhum tabuleiro as separa.
    expect(lossScoreAt(0)).toBe(-100000)
    expect(lossScoreAt(6)).toBeGreaterThan(lossScoreAt(2))
    expect(lossScoreAt(6) - lossScoreAt(2)).toBe(4)
  })
})

describe('checkers/ai: de onde vem o erro e de onde vem o nível', () => {
  const dado = (...v) => {
    let i = 0
    return () => v[Math.min(i++, v.length - 1)]
  }

  it('o erro do fácil sai do dado, e o dado é lido duas vezes', () => {
    // `cfg.blunder && rng() < cfg.blunder`: o primeiro lado liga o erro no
    // nível, o segundo joga o dado. Virado `||`, o nível sozinho já erra
    // SEMPRE, e o número que deveria decidir vira o índice do lance sorteado.
    const g = startGame(createGame())
    const jogadas = legalMoves(g)
    const chutada = bestMove(g, 'easy', dado(0.1, 0.6))
    expect(sameMove(chutada, jogadas[Math.floor(0.6 * jogadas.length)])).toBe(true)
  })

  it('um nível desconhecido cai no médio em vez de quebrar a partida', () => {
    // O `||` aqui é o único fallback: com `&&` o nível conhecido passa a ser
    // sempre o médio e o desconhecido derruba a IA no meio do jogo.
    const g = startGame(createGame())
    const inventado = bestMove(g, 'nivel-que-nao-existe', dado(0.9, 0.3))
    const medio = bestMove(g, 'medium', dado(0.9, 0.3))
    expect(sameMove(inventado, medio)).toBe(true)
  })
})
