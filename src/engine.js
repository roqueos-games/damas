// Veio do `src/utils/checkers/engine.js` do RoqueOS em 25/09/2026, sem mudança.
// O formato do `serialize` é o que atravessa a sala online: não muda, porque a
// outra ponta pode ser um RoqueOS antigo ainda aberto.

/**
 * DAMAS — pure Brazilian-draughts engine for the RoqueOS Games gallery.
 *
 * 8×8 board, play on the dark squares. Men step one square diagonally forward
 * and capture (forward or backward) by jumping an adjacent enemy to the empty
 * square beyond; kings "fly" any distance along a diagonal and capture at range.
 * Captures are **mandatory** and you must take the sequence that captures the
 * **most** pieces (Brazilian maximum-capture rule); a man promotes on the last
 * rank. Framework-free + fully testable; the component owns render, sound and —
 * for the online mode — relaying the serialized board over Realtime Database.
 *
 * Encoding: player 1 (light) starts at the bottom and moves up (row −); player 2
 * (dark) starts at the top and moves down (row +). Cell values:
 *   0 empty · 1 p1 man · 2 p1 king · -1 p2 man · -2 p2 king
 */

export const SIZE = 8
export const P1 = 1
export const P2 = 2

const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE
const isDark = (r, c) => (r + c) % 2 === 1
export const ownerOf = (v) => (v > 0 ? P1 : v < 0 ? P2 : 0)
export const isKing = (v) => Math.abs(v) === 2
const enemyOf = (p) => (p === P1 ? P2 : P1)
const clone = (b) => b.map((row) => row.slice())

export function createGame(opts = {}) {
  return {
    status: 'idle', // 'idle' | 'playing' | 'won'
    board: emptyBoard(),
    turn: P1,
    winner: 0,
    moves: 0,
    mode: opts.mode || 'local', // 'local' | 'online'
  }
}

function emptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0))
}

export function startGame(state) {
  const b = emptyBoard()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) continue
      if (r < 3)
        b[r][c] = -1 // p2 (top)
      else if (r > 4) b[r][c] = 1 // p1 (bottom)
    }
  }
  state.board = b
  state.turn = P1
  state.winner = 0
  state.moves = 0
  state.status = 'playing'
  return state
}

const MAN_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

// ── Capture generation (recursive, per piece) ────────────────────────────────
function pieceCaptureSeqs(board, r, c, player, king) {
  const results = []
  const startVal = board[r][c]

  const recurse = (b, cr, cc, capturedList) => {
    let extended = false
    if (king) {
      for (const [dr, dc] of MAN_DIRS) {
        // scan for the first non-empty square along the diagonal
        let er = cr + dr
        let ec = cc + dc
        while (inBounds(er, ec) && b[er][ec] === 0) {
          er += dr
          ec += dc
        }
        if (!inBounds(er, ec)) continue
        if (ownerOf(b[er][ec]) !== enemyOf(player)) continue
        if (capturedList.some(([x, y]) => x === er && y === ec)) continue
        // landing squares: any empty square beyond the enemy
        let lr = er + dr
        let lc = ec + dc
        while (inBounds(lr, lc) && b[lr][lc] === 0) {
          const nb = clone(b)
          nb[cr][cc] = 0
          nb[lr][lc] = startVal
          recurse(nb, lr, lc, [...capturedList, [er, ec]])
          extended = true
          lr += dr
          lc += dc
        }
      }
    } else {
      for (const [dr, dc] of MAN_DIRS) {
        const er = cr + dr
        const ec = cc + dc
        const lr = cr + 2 * dr
        const lc = cc + 2 * dc
        if (!inBounds(lr, lc)) continue
        if (ownerOf(b[er][ec]) !== enemyOf(player)) continue
        if (b[lr][lc] !== 0) continue
        if (capturedList.some(([x, y]) => x === er && y === ec)) continue
        const nb = clone(b)
        nb[cr][cc] = 0
        nb[lr][lc] = startVal
        recurse(nb, lr, lc, [...capturedList, [er, ec]])
        extended = true
      }
    }
    if (!extended && capturedList.length) {
      results.push({ from: [r, c], to: [cr, cc], captured: capturedList })
    }
  }

  recurse(board, r, c, [])
  return results
}

function simpleMoves(board, r, c, player, king) {
  const out = []
  if (king) {
    for (const [dr, dc] of MAN_DIRS) {
      let nr = r + dr
      let nc = c + dc
      while (inBounds(nr, nc) && board[nr][nc] === 0) {
        out.push({ from: [r, c], to: [nr, nc], captured: [] })
        nr += dr
        nc += dc
      }
    }
  } else {
    const fwd = player === P1 ? -1 : 1 // p1 moves up
    for (const dc of [-1, 1]) {
      const nr = r + fwd
      const nc = c + dc
      if (inBounds(nr, nc) && board[nr][nc] === 0) {
        out.push({ from: [r, c], to: [nr, nc], captured: [] })
      }
    }
  }
  return out
}

/** All legal moves for the side to move, honoring mandatory maximum capture. */
export function legalMoves(state) {
  const { board, turn } = state
  const captures = []
  const quiet = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c]
      if (ownerOf(v) !== turn) continue
      const king = isKing(v)
      const caps = pieceCaptureSeqs(board, r, c, turn, king)
      if (caps.length) captures.push(...caps)
      else quiet.push(...simpleMoves(board, r, c, turn, king))
    }
  }
  if (captures.length) {
    const max = Math.max(...captures.map((m) => m.captured.length))
    return captures.filter((m) => m.captured.length === max)
  }
  return quiet
}

const sameMove = (a, b) =>
  a.from[0] === b.from[0] &&
  a.from[1] === b.from[1] &&
  a.to[0] === b.to[0] &&
  a.to[1] === b.to[1] &&
  a.captured.length === b.captured.length

/**
 * Apply an already-legal move `m`, returning the next CORE state
 * ({board,turn,moves,promoted}) WITHOUT win detection. Pure (no mutation of
 * `state`). Used by applyMove and by the AI search for a fast, correct child.
 */
export function nextState(state, m) {
  const b = clone(state.board)
  const [fr, fc] = m.from
  const [tr, tc] = m.to
  let val = b[fr][fc]
  b[fr][fc] = 0
  for (const [cr, cc] of m.captured) b[cr][cc] = 0
  // promotion on reaching the far rank
  const lastRank = state.turn === P1 ? 0 : SIZE - 1
  if (!isKing(val) && tr === lastRank) val = val > 0 ? 2 : -2
  b[tr][tc] = val
  return { board: b, turn: enemyOf(state.turn), moves: state.moves + 1, promoted: isKing(val) }
}

/** Apply a legal move; promotes, removes captures, toggles the turn, checks win. */
export function applyMove(state, move) {
  const legal = legalMoves(state)
  const m = legal.find((lm) => sameMove(lm, move))
  if (!m) return { ok: false }
  const ns = nextState(state, m)
  state.board = ns.board
  state.moves = ns.moves
  state.turn = ns.turn
  const w = winnerOf(state)
  if (w) {
    state.status = 'won'
    state.winner = w
  }
  return { ok: true, captured: m.captured.length, promoted: ns.promoted }
}

/** The winner (opponent has no pieces or no legal moves), or 0. */
export function winnerOf(state) {
  let p1 = 0
  let p2 = 0
  for (const row of state.board) {
    for (const v of row) {
      if (v > 0) p1++
      else if (v < 0) p2++
    }
  }
  if (p1 === 0) return P2
  if (p2 === 0) return P1
  if (legalMoves(state).length === 0) return enemyOf(state.turn) // side to move is stuck
  return 0
}

export const countPieces = (state, player) => {
  let n = 0
  for (const row of state.board) for (const v of row) if (ownerOf(v) === player) n++
  return n
}

// ── Serialization for online sync (64-char string) ───────────────────────────
const CH = { 0: '.', 1: 'w', 2: 'W', '-1': 'b', '-2': 'B' }
const UNCH = { '.': 0, w: 1, W: 2, b: -1, B: -2 }

export function serialize(state) {
  let s = ''
  for (const row of state.board) for (const v of row) s += CH[v]
  return `${s}|${state.turn}`
}

export function deserialize(str) {
  const [cells, turn] = str.split('|')
  const board = emptyBoard()
  for (let i = 0; i < SIZE * SIZE; i++) {
    // `||` e não `??`: o único valor falsy que UNCH devolve é o próprio 0 da
    // casa vazia, que cai no mesmo 0 do fallback. As duas formas decidem igual
    // aqui, e entre duas formas idênticas fica a que um teste consegue
    // verificar: `|| vira &&` esvazia o tabuleiro inteiro e morre no primeiro
    // ida-e-volta, enquanto `?? vira ||` seria um mutante impossível de matar.
    board[Math.floor(i / SIZE)][i % SIZE] = UNCH[cells[i]] || 0
  }
  return { board, turn: Number(turn) || P1 }
}
