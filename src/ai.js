/**
 * DAMAS — AI opponent (pure, unit-tested). Negamax + alpha-beta over the engine
 * move generator, which already enforces the Brazilian mandatory maximum-capture
 * rule — so every move the AI considers (and plays) is legal, and it can never
 * duck a forced capture. Evaluation = material (men vs. flying kings) + men
 * advancement toward promotion + a little centre/back-row shaping. Difficulty =
 * search depth + a "blunder" chance. Framework-free; run off a timer.
 *
 * Encoding (engine.js): 0 empty · 1/2 P1 man/king · -1/-2 P2 man/king. P1 starts
 * at the bottom and promotes at row 0; P2 starts at the top and promotes at row 7.
 */
// Veio do `src/utils/checkers/ai.js` do RoqueOS em 25/09/2026; só o import
// ganhou a extensão, que o ESM de verdade exige.
import { legalMoves, nextState, ownerOf, isKing, P1, SIZE } from './engine.js'

const MATE = 100000
const MAN = 100
const KING = 175

/** Static score from P1's side (positive = P1 is better). */
export function evaluate(state) {
  const b = state.board
  let s = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = b[r][c]
      if (!v) continue
      const owner = ownerOf(v)
      let val = isKing(v) ? KING : MAN
      if (!isKing(v)) {
        // rows advanced toward the promotion rank (P1 → row 0, P2 → row 7)
        const adv = owner === P1 ? SIZE - 1 - r : r
        val += adv * 4
      }
      if (c >= 2 && c <= 5) val += 3 // central files are stronger
      if (r === 0 || r === SIZE - 1) val += 2 // back-row men anchor the promotion line
      s += owner === P1 ? val : -val
    }
  }
  return s
}

const evalRelative = (state) => (state.turn === P1 ? evaluate(state) : -evaluate(state))

/**
 * A derrota, vista de quem está para jogar e não tem lance nenhum.
 *
 * O `ply` entra SOMANDO: perder no lance 6 é menos ruim do que perder no lance
 * 2. É essa soma que faz a IA resistir em vez de aceitar a derrota mais curta,
 * e que faz ela fechar uma partida ganha em vez de ficar arrastando peça.
 * Fica exposta porque é a única regra deste arquivo que um teste não alcança
 * pelo tabuleiro: por dentro da busca as duas versões são o mesmo número enorme
 * e negativo.
 */
export const lossScoreAt = (ply) => -MATE + ply

function negamax(state, depth, alpha, beta, ply) {
  const moves = legalMoves(state)
  if (moves.length === 0) return lossScoreAt(ply) // stuck (no legal move) = loss
  if (depth <= 0) return evalRelative(state)
  // captures are already max-enforced; put the longest jumps first for pruning
  moves.sort((a, z) => z.captured.length - a.captured.length)
  let best = -Infinity
  for (const m of moves) {
    const sc = -negamax(nextState(state, m), depth - 1, -beta, -alpha, ply + 1)
    // Math.max, e não `if (sc > best) best = sc`: reatribuir um valor IGUAL não
    // muda nada, então `>` e `>=` decidem o mesmo aqui e a comparação solta
    // deixava um mutante que nenhum teste pode matar.
    best = Math.max(best, sc)
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

export const LEVELS = {
  easy: { depth: 2, blunder: 0.4, window: 24 },
  medium: { depth: 4, blunder: 0.1, window: 12 },
  hard: { depth: 6, blunder: 0, window: 0 },
}

/**
 * Best move for `state.turn` at the given level. `rng` is injectable for
 * deterministic tests. Always legal (drawn from legalMoves, which enforces
 * mandatory maximum capture); returns null if there are no moves.
 */
export function bestMove(state, level = 'medium', rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.medium
  const moves = legalMoves(state)
  if (!moves.length) return null
  if (moves.length === 1) return moves[0] // forced move — just play it
  if (cfg.blunder && rng() < cfg.blunder) return moves[Math.floor(rng() * moves.length)]

  let bestScore = -Infinity
  const scored = []
  for (const m of moves) {
    const sc = -negamax(nextState(state, m), cfg.depth - 1, -Infinity, Infinity, 1)
    scored.push({ m, sc })
    bestScore = Math.max(bestScore, sc)
  }
  const pool = scored.filter((x) => x.sc >= bestScore - cfg.window)
  return (pool.length ? pool[Math.floor(rng() * pool.length)] : scored[0]).m
}
