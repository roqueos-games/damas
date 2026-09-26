<template>
  <div
    ref="rootRef"
    class="ros-checkers"
    :class="{ 'ros-checkers--low': modoLeve }"
    :dir="estado.idioma === 'ar-AR' ? 'rtl' : 'ltr'"
  >
    <canvas ref="canvasRef" class="ros-checkers__canvas" />

    <!-- player cards (opponent above the 3D board, me below) -->
    <template v-if="phase === 'playing' || phase === 'ended'">
      <div
        class="ros-checkers__pcard ros-checkers__pcard--top"
        :class="{ 'is-active': turn === topPlayer && phase === 'playing' }"
      >
        <span class="ros-checkers__avatar">
          <img v-if="uiUrls[topPlayer]" :src="uiUrls[topPlayer]" alt="" />
        </span>
        <span class="ros-checkers__pname">{{ topName }}</span>
        <span v-if="aiThinking && mode === 'ai'" class="ros-checkers__thinking">
          <Icone nome="pensando" :tamanho="16" />
          {{ txt('thinking') }}
        </span>
        <span class="ros-checkers__caps">
          <template v-if="capturedBy(topPlayer) > 0">
            <img v-if="uiUrls[other(topPlayer)]" :src="uiUrls[other(topPlayer)]" alt="" />
            <b>×{{ capturedBy(topPlayer) }}</b>
          </template>
        </span>
        <span class="ros-checkers__turn-dot" />
        <button class="ros-checkers__icon-btn" :aria-label="txt('newGame')" @click="toMenu">
          <Icone nome="fechar" :tamanho="18" />
        </button>
      </div>
      <div
        class="ros-checkers__pcard ros-checkers__pcard--bottom"
        :class="{ 'is-active': turn === bottomPlayer && phase === 'playing' }"
      >
        <span class="ros-checkers__avatar">
          <img v-if="uiUrls[bottomPlayer]" :src="uiUrls[bottomPlayer]" alt="" />
        </span>
        <span class="ros-checkers__pname">{{ bottomName }}</span>
        <span class="ros-checkers__caps">
          <template v-if="capturedBy(bottomPlayer) > 0">
            <img v-if="uiUrls[other(bottomPlayer)]" :src="uiUrls[other(bottomPlayer)]" alt="" />
            <b>×{{ capturedBy(bottomPlayer) }}</b>
          </template>
        </span>
        <span class="ros-checkers__turn-dot" />
      </div>
    </template>

    <transition name="checkers-fade">
      <div v-if="mustCapture && phase === 'playing'" class="ros-checkers__must">
        <Icone nome="raio" :tamanho="14" /> {{ txt('mustCapture') }}
      </div>
    </transition>

    <!-- menu (the live 3D board glows behind the glass) -->
    <div v-if="phase === 'menu'" class="ros-checkers__menu">
      <div class="ros-checkers__hero">
        <img v-if="uiUrls['1']" :src="uiUrls['1']" class="ros-checkers__hero-piece is-l" alt="" />
        <img v-if="uiUrls.K2" :src="uiUrls.K2" class="ros-checkers__hero-piece is-r" alt="" />
      </div>
      <div class="ros-checkers__logo">{{ txt('title') }}</div>
      <div class="ros-checkers__sub">{{ txt('tagline') }}</div>
      <div class="ros-checkers__menu-btns">
        <button class="ros-checkers__mbtn ros-checkers__mbtn--ai" @click="phase = 'aisetup'">
          <Icone nome="robo" :tamanho="22" />
          <span>{{ txt('vsAi') }}</span>
          <small>{{ txt('vsAiHint') }}</small>
        </button>
        <button class="ros-checkers__mbtn" @click="startLocal">
          <Icone nome="pessoas" :tamanho="22" />
          <span>{{ txt('local') }}</span>
          <small>{{ txt('localHint') }}</small>
        </button>
        <button class="ros-checkers__mbtn ros-checkers__mbtn--online" @click="hostOnline">
          <Icone nome="qr" :tamanho="22" />
          <span>{{ txt('createOnline') }}</span>
          <small>{{ txt('createHint') }}</small>
        </button>
        <button class="ros-checkers__mbtn" @click="phase = 'join'">
          <Icone nome="entrar" :tamanho="22" />
          <span>{{ txt('joinOnline') }}</span>
          <small>{{ txt('joinHint') }}</small>
        </button>
      </div>
    </div>

    <!-- vs AI: pick side + difficulty -->
    <div v-if="phase === 'aisetup'" class="ros-checkers__menu">
      <div class="ros-checkers__logo">{{ txt('vsAi') }}</div>
      <div class="ros-checkers__sub">{{ txt('chooseLevel') }}</div>
      <div class="ros-checkers__side-row">
        <button
          class="ros-checkers__side"
          :class="{ 'is-on': aiSide === 'l' }"
          @click="aiSide = 'l'"
        >
          <img v-if="uiUrls['1']" :src="uiUrls['1']" alt="" />
          <span>{{ txt('light') }}</span>
        </button>
        <button
          class="ros-checkers__side"
          :class="{ 'is-on': aiSide === 'd' }"
          @click="aiSide = 'd'"
        >
          <img v-if="uiUrls['2']" :src="uiUrls['2']" alt="" />
          <span>{{ txt('dark') }}</span>
        </button>
      </div>
      <div class="ros-checkers__menu-btns">
        <button class="ros-checkers__mbtn" @click="startAI('easy')">
          <Icone nome="sorriso" :tamanho="22" />
          <span>{{ txt('level_easy') }}</span>
          <small>{{ txt('level_easy_hint') }}</small>
        </button>
        <button class="ros-checkers__mbtn" @click="startAI('medium')">
          <Icone nome="cerebro" :tamanho="22" />
          <span>{{ txt('level_medium') }}</span>
          <small>{{ txt('level_medium_hint') }}</small>
        </button>
        <button class="ros-checkers__mbtn" @click="startAI('hard')">
          <Icone nome="fogo" :tamanho="22" />
          <span>{{ txt('level_hard') }}</span>
          <small>{{ txt('level_hard_hint') }}</small>
        </button>
      </div>
      <button class="ros-checkers__ghost-btn" @click="phase = 'menu'">
        {{ txt('cancel') }}
      </button>
    </div>

    <div v-if="phase === 'waiting'" class="ros-checkers__wait">
      <div class="ros-checkers__wait-card">
        <div class="ros-checkers__wait-title">{{ txt('waiting') }}</div>
        <img v-if="qr" :src="qr" class="ros-checkers__qr" :alt="txt('scanQr')" />
        <div class="ros-checkers__code-row">
          <span class="ros-checkers__code-label">{{ txt('code') }}</span>
          <span class="ros-checkers__code">{{ code }}</span>
          <button class="ros-checkers__copy" @click="copyInvite">
            <Icone nome="copiar" :tamanho="16" />
          </button>
        </div>
        <div class="ros-checkers__wait-hint">{{ txt('scanQr') }}</div>
        <button class="ros-checkers__ghost-btn" @click="toMenu">{{ txt('cancel') }}</button>
      </div>
    </div>

    <div v-if="phase === 'join'" class="ros-checkers__wait">
      <div class="ros-checkers__wait-card">
        <div class="ros-checkers__wait-title">{{ txt('enterCode') }}</div>
        <input
          v-model="joinInput"
          class="ros-checkers__code-input"
          maxlength="5"
          :placeholder="txt('codePlaceholder')"
          @keyup.enter="guestJoin"
        />
        <div v-if="joinError" class="ros-checkers__err">{{ joinError }}</div>
        <button class="ros-checkers__solid-btn" :disabled="joinInput.length < 5" @click="guestJoin">
          {{ txt('join') }}
        </button>
        <button class="ros-checkers__ghost-btn" @click="toMenu">{{ txt('cancel') }}</button>
      </div>
    </div>

    <transition name="checkers-pop">
      <div v-if="phase === 'ended'" class="ros-checkers__over">
        <div class="ros-checkers__over-title">{{ resultText }}</div>
        <button class="ros-checkers__solid-btn" @click="toMenu">
          <Icone nome="reiniciar" :tamanho="19" /> {{ txt('newGame') }}
        </button>
      </div>
    </transition>

    <div v-if="onlineToast" class="ros-checkers__net-toast">{{ onlineToast }}</div>
  </div>
</template>

<script setup>
// As Damas. Falam com o sistema só pelo `host` do jogo-sdk: a partida online
// (a `sala`), o áudio, o modo leve, as métricas, o aviso e o nome de quem joga
// chegam por ele, e é por isso que o mesmo arquivo roda dentro do RoqueOS, no
// `yarn dev` do repo e no teste.
//
// O que toca a GPU mora em `tabuleiro3d.js` e veio do RoqueOS SEM MUDANÇA, em
// 25/09/2026; daqui ele só recebe o canvas, o modo leve e o toque. Mexer ali
// pede teste no iPhone de verdade antes de subir: verde no desktop não é verde
// no iPhone.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { emModoE2E } from '@roqueos-games/jogo-sdk'
import { bakeDiscSet, spriteUrl } from './arteDoTabuleiro.js'
import { createBoardScene, buildCheckersSet3D } from './tabuleiro3d.js'
import {
  createGame,
  startGame,
  legalMoves,
  applyMove,
  serialize,
  deserialize,
  ownerOf,
  isKing,
  winnerOf,
  P1,
  P2,
} from './engine.js'
import { bestMove as checkersAiMove } from './ai.js'
import { criarSom } from './som.js'
import { traduzir } from './textos.js'
import Icone from './Icone.vue'

const props = defineProps({
  /** O host do contrato v1 do jogo-sdk, com a capacidade `sala`. */
  host: { type: Object, required: true },
  /** `{ ativo, idioma, textos }`, reativo; quem escreve é o `montar` do jogo. */
  estado: { type: Object, required: true },
})

const host = props.host
const txt = (chave, valores) => traduzir(props.estado.textos, chave, valores)

const rootRef = ref(null)
const canvasRef = ref(null)
const phase = ref('menu') // 'menu'|'aisetup'|'join'|'waiting'|'playing'|'ended'
const mode = ref('local') // 'local' | 'ai' | 'online'
const aiLevel = ref('medium')
const aiSide = ref('l') // 'l' = light (P1) · 'd' = dark (P2)
const humanPlayer = ref(P1)
const aiThinking = ref(false)
const turn = ref(P1)
const resultText = ref('')
const code = ref('')
const qr = ref('')
const joinInput = ref('')
const joinError = ref('')
const myPlayer = ref(P1)
const oppName = ref('')
const onlineToast = ref('')
const mustCapture = ref(false)
const uiUrls = ref({}) // baked 2D disc sprites (cards/menu icons)
const aliveCount = ref({ 1: 12, 2: 12 })
// O perfil leve para o CSS; o three recebe o mesmo valor ao montar.
const modoLeve = ref(false)
// O nome de quem joga, no cartão. Vem da identidade do host e acompanha quem
// entra ou sai da conta com o jogo aberto, como acompanhava a store antes.
const meuNome = ref(host.identidade.atual()?.nome || '')

let game = null
let scene3d = null
let selected = null
let legalForSel = []
let lastMove = null
let unsub = null
let resizeObserver = null
let pararIdentidade = null
let lastSerialized = ''
let mustFrom = [] // squares that MUST capture this turn (pulsing gold rings)
// O link do convite (o do QR e o do "copiar"), que o host devolve ao criar a
// sala. Antes o jogo montava o link sozinho; agora quem sabe o endereço é o host.
let linkDoConvite = ''

const pendingTimers = new Set()
const later = (fn, ms) => {
  const id = setTimeout(() => {
    pendingTimers.delete(id)
    fn()
  }, ms)
  pendingTimers.add(id)
  return id
}

const flip = computed(
  () =>
    (mode.value === 'online' && myPlayer.value === P2) ||
    (mode.value === 'ai' && humanPlayer.value === P2),
)
const topPlayer = computed(() => (flip.value ? P1 : P2))
const bottomPlayer = computed(() => (flip.value ? P2 : P1))
const other = (p) => (p === P1 ? P2 : P1)
const meName = () => meuNome.value || txt('you')
const aiName = computed(() => `${txt('ai')} · ${txt(`level_${aiLevel.value}`)}`)
// Online, quem joga fica sempre embaixo, como contra a IA: a câmera vai para
// o lado da cor de quem joga, e o `flip` já troca as cores dos cartões. Antes
// o nome também dependia do `flip`, e para quem criou a sala os nomes saíam
// trocados: o próprio nome no cartão de cima, o das escuras, e o do outro no
// de baixo. Defeito do componente antigo, achado na extração em 25/09/2026.
const topName = computed(() => {
  if (mode.value === 'ai') return aiName.value // the AI is always the opponent (top)
  if (mode.value === 'online') return oppName.value || txt('opponent')
  return txt('dark')
})
const bottomName = computed(() => {
  if (mode.value === 'ai' || mode.value === 'online') return meName()
  return txt('light')
})

const syncAlive = () => {
  if (!game) return
  const cnt = { 1: 0, 2: 0 }
  for (const row of game.board) for (const v of row) if (v !== 0) cnt[ownerOf(v)]++
  aliveCount.value = cnt
}
const capturedBy = (p) => 12 - aliveCount.value[other(p)]

// ── Audio ────────────────────────────────────────────────────────────────────
// As notas em sequência (captura, dama, fim) andam no relógio `later`, que o
// desmontar limpa.
const som = criarSom(host.audio, later)
// Chamado de dentro do gesto (toque, clique), sem `await` antes: o iOS só
// libera o áudio assim.
const primeAudio = () => {
  try {
    host.audio.destravar()?.catch?.(() => {})
  } catch {
    /* best-effort */
  }
}
const buzz = (p) => {
  try {
    navigator.vibrate?.(p)
  } catch {
    /* best-effort */
  }
}

// ── Scene sync ───────────────────────────────────────────────────────────────
const spriteKey = (v) => (isKing(v) ? `K${ownerOf(v)}` : String(ownerOf(v)))

const boardCells = () => {
  const cells = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = game.board[r][c]
      if (v !== 0) cells.push({ sq: [r, c], key: spriteKey(v) })
    }
  }
  return cells
}

const syncScene = () => {
  if (!scene3d || !game) return
  scene3d.setPieces(boardCells())
  scene3d.setHighlights({
    lastMove,
    selected,
    targets: legalForSel.map((m) => ({ sq: m.to, capture: m.captured.length > 0 })),
    must: phase.value === 'playing' && !selected ? mustFrom : [],
  })
}

// ── Interaction (raycast tap from the scene) ─────────────────────────────────
const aiPlayer = () => (humanPlayer.value === P1 ? P2 : P1)
const myTurn = () =>
  phase.value === 'playing' &&
  !aiThinking.value &&
  (mode.value === 'ai'
    ? game.turn === humanPlayer.value
    : mode.value === 'local' || game.turn === myPlayer.value)

const refreshMustCapture = () => {
  const lm = legalMoves(game)
  const capMoves = lm.filter((m) => m.captured.length > 0)
  mustCapture.value = lm.length > 0 && capMoves.length === lm.length && capMoves.length > 0
  const seen = new Set()
  mustFrom = []
  if (mustCapture.value) {
    for (const m of capMoves) {
      const key = `${m.from[0]},${m.from[1]}`
      if (!seen.has(key)) {
        seen.add(key)
        mustFrom.push(m.from)
      }
    }
  }
}

const onTap = (r, c) => {
  if (!myTurn()) return
  primeAudio()
  if (selected) {
    const m = legalForSel.find((mm) => mm.to[0] === r && mm.to[1] === c)
    if (m) {
      commitMove(m)
      return
    }
  }
  const v = game.board[r][c]
  if (ownerOf(v) === game.turn) {
    const all = legalMoves(game).filter((m) => m.from[0] === r && m.from[1] === c)
    if (all.length) {
      selected = [r, c]
      legalForSel = all
    }
  } else {
    selected = null
    legalForSel = []
  }
  syncScene()
}

const commitMove = (move) => {
  const res = applyMove(game, move)
  if (!res.ok) return
  selected = null
  legalForSel = []
  lastMove = { from: move.from, to: move.to }
  turn.value = game.turn
  syncAlive()
  refreshMustCapture()
  syncScene()
  scene3d?.animateMove(move.from, move.to, { hop: move.captured.length > 0 })
  if (res.captured) som.capturar(res.captured)
  else som.mover()
  if (res.promoted) som.coroar()
  buzz(res.captured ? [12, 20] : 6)
  if (mode.value === 'online') pushState()
  if (game.status === 'won') endGame(game.winner)
  else if (mode.value === 'ai') maybeAiMove()
}

// Vs-AI: think off a timer so the "pensando" UI paints first, then play. Guarded
// so leaving mid-think can't apply a stray move.
const maybeAiMove = () => {
  if (mode.value !== 'ai' || phase.value !== 'playing') return
  if (game.status === 'won' || game.turn !== aiPlayer()) return
  aiThinking.value = true
  syncScene()
  later(() => {
    if (mode.value !== 'ai' || phase.value !== 'playing' || game.turn !== aiPlayer()) {
      aiThinking.value = false
      return
    }
    const mv = checkersAiMove(game, aiLevel.value)
    aiThinking.value = false
    if (mv) commitMove(mv)
  }, 460)
}

const endGame = (winner) => {
  phase.value = 'ended'
  aiThinking.value = false
  const vsHuman = mode.value === 'online' || mode.value === 'ai'
  const meP = mode.value === 'ai' ? humanPlayer.value : myPlayer.value
  const iWon = vsHuman ? winner === meP : true
  resultText.value = vsHuman
    ? iWon
      ? txt('youWin')
      : txt('youLose')
    : winner === P1
      ? txt('lightWins')
      : txt('darkWins')
  som.fim(!vsHuman || iWon)
  host.metricas.evento('game_over', {
    mode: mode.value,
    ...(mode.value === 'ai' ? { level: aiLevel.value } : {}),
  })
}

const startLocal = () => {
  primeAudio()
  mode.value = 'local'
  game = createGame({ mode: 'local' })
  startGame(game)
  turn.value = P1
  selected = null
  legalForSel = []
  lastMove = null
  phase.value = 'playing'
  mustCapture.value = false
  mustFrom = []
  syncAlive()
  scene3d?.setSide('w')
  syncScene()
  host.metricas.evento('game_start', { mode: 'local' })
}

// ── Vs AI ─────────────────────────────────────────────────────────────────────
const startAI = (level, side) => {
  primeAudio()
  mode.value = 'ai'
  aiLevel.value = level || aiLevel.value
  humanPlayer.value = (side || aiSide.value) === 'd' ? P2 : P1
  game = createGame({ mode: 'ai' })
  startGame(game)
  turn.value = P1
  selected = null
  legalForSel = []
  lastMove = null
  aiThinking.value = false
  phase.value = 'playing'
  mustCapture.value = false
  mustFrom = []
  syncAlive()
  scene3d?.setSide(humanPlayer.value === P1 ? 'w' : 'b')
  syncScene()
  host.metricas.evento('game_start', { mode: 'ai', level: aiLevel.value })
  maybeAiMove() // the AI opens if the human chose to play Dark
}

const toMenu = () => {
  phase.value = 'menu'
  aiThinking.value = false
  cleanupOnline()
}

// ── Online ───────────────────────────────────────────────────────────────────
// A partida online passa pela capacidade `sala` do host. O que atravessa a
// sala continua exatamente o que atravessava o banco antes da extração: o
// tabuleiro do `serialize` (64 casas e a vez), a vez como 1 ou 2 e, na
// abertura, 'host'. A outra ponta pode ser um RoqueOS antigo ainda aberto
// durante o deploy, e ele só entende esse formato.
const cleanupOnline = () => {
  if (unsub) {
    unsub()
    unsub = null
  }
  code.value = ''
  qr.value = ''
  oppName.value = ''
  linkDoConvite = ''
}
// A partida online começa zerada, como a local e a da IA já começavam. Antes
// ela herdava da partida anterior a vez do cartão aceso, a última jogada
// destacada no tabuleiro e o aviso de captura obrigatória. Achado na extração
// em 25/09/2026.
const zerarLance = () => {
  turn.value = P1
  selected = null
  legalForSel = []
  lastMove = null
  mustCapture.value = false
  mustFrom = []
}
const makeQr = async (url) => {
  try {
    const QRCode = (await import('qrcode')).default
    qr.value = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#241812', light: '#f6efe2' },
    })
  } catch {
    qr.value = ''
  }
}
// Sem conta não há sala: o host recusa no `criar` (lança com o código
// 'sem-conta') e no `entrar` (devolve o erro), e o jogo mostra o mesmo aviso de
// antes. Antes o jogo olhava a conta sozinho, antes de mexer em qualquer coisa;
// por isso a partida nova só vira a do jogo depois que a sala existe.
const hostOnline = async () => {
  primeAudio()
  const novo = createGame({ mode: 'online' })
  startGame(novo)
  let res
  try {
    res = await host.sala.criar({ estadoInicial: serialize(novo), vez: 'host' })
  } catch (erro) {
    if (erro?.codigo !== 'sem-conta') throw erro
    host.avisar(txt('needAccount'), { tipo: 'aviso' })
    return
  }
  mode.value = 'online'
  myPlayer.value = P1
  game = novo
  zerarLance()
  syncAlive()
  syncScene()
  code.value = res.codigo
  makeQr(res.link)
  phase.value = 'waiting'
  subscribeMatch(res.codigo)
  linkDoConvite = res.link
  host.metricas.evento('game_start', { mode: 'online-host' })
}
const guestJoin = async (presetCode) => {
  primeAudio()
  const c = (typeof presetCode === 'string' ? presetCode : joinInput.value).trim().toUpperCase()
  if (c.length < 5) return
  joinError.value = ''
  const res = await host.sala.entrar(c)
  if (res.erro === 'sem-conta') {
    host.avisar(txt('needAccount'), { tipo: 'aviso' })
    return
  }
  if (res.erro) {
    joinError.value =
      res.erro === 'nao-encontrada'
        ? txt('codeNotFound')
        : res.erro === 'cheia'
          ? txt('roomFull')
          : txt('joinFailed')
    return
  }
  mode.value = 'online'
  myPlayer.value = P2
  code.value = c
  game = createGame({ mode: 'online' })
  startGame(game)
  zerarLance()
  // Quem entra vai direto para o tabuleiro: a sala já está `jogando` desde
  // que o `entrar` sentou o convidado. Antes nada tirava o convidado da tela
  // do código (a observação só passa de 'waiting' para 'playing', e o
  // convidado nunca esteve em 'waiting'), e ele não conseguia jogar lance
  // nenhum. Defeito do componente antigo, achado na extração em 25/09/2026,
  // na partida entre duas abas do `yarn dev`.
  phase.value = 'playing'
  syncAlive()
  scene3d?.setSide('b')
  syncScene()
  subscribeMatch(c)
  host.metricas.evento('game_start', { mode: 'online-guest' })
}
// `anfitriaoSaiu` (o `hostGone` do banco) chega na sala e não é lido aqui, como
// não era antes da extração: quem decide o que fazer com ele é outra conversa.
const subscribeMatch = (c) => {
  cleanupOnline()
  code.value = c
  unsub = host.sala.observar(c, (m) => {
    if (!m) return
    oppName.value = myPlayer.value === P1 ? m.nomeDoConvidado || '' : m.nomeDoAnfitriao || ''
    if (m.situacao === 'jogando' && phase.value === 'waiting') {
      phase.value = 'playing'
      onlineToast.value = txt('oppJoined')
      later(() => (onlineToast.value = ''), 2500)
    }
    if (m.estado && m.estado !== lastSerialized && m.estado !== serialize(game)) applyRemote(m)
    if (m.situacao === 'encerrada' && phase.value === 'playing' && game.status !== 'won') {
      phase.value = 'ended'
      resultText.value = txt('oppLeft')
    }
  })
}
const applyRemote = (m) => {
  const prev = game.board.map((row) => row.slice())
  const d = deserialize(m.estado)
  game.board = d.board
  game.turn = d.turn
  lastSerialized = m.estado
  turn.value = game.turn
  selected = null
  legalForSel = []
  syncAlive()
  refreshMustCapture()
  // reconstruct the opponent's move for the highlight + glide animation
  let fromSq = null
  let toSq = null
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (prev[r][c] === game.board[r][c]) continue
      if (game.board[r][c] === 0 && prev[r][c] !== 0) fromSq = fromSq || [r, c]
      else if (game.board[r][c] !== 0) toSq = [r, c]
    }
  }
  if (fromSq && toSq) lastMove = { from: fromSq, to: toSq }
  syncScene()
  if (fromSq && toSq) {
    scene3d?.animateMove(fromSq, toSq, { hop: true })
    som.mover()
  }
  const w = winnerOf(game)
  if (w) {
    game.status = 'won'
    game.winner = w
    endGame(w)
  }
}
// `vencedor` e `situacao` vão em toda jogada, como `winner` e `status` iam.
const pushState = () => {
  lastSerialized = serialize(game)
  const situacao = game.status === 'won' ? 'encerrada' : 'jogando'
  const vencedor = game.status === 'won' ? game.winner : null
  try {
    host.sala
      .jogar(code.value, { estado: lastSerialized, vez: game.turn, vencedor, situacao })
      ?.catch?.(() => {})
  } catch {
    /* best-effort, como antes */
  }
}
const copyInvite = async () => {
  try {
    await navigator.clipboard.writeText(linkDoConvite)
    host.avisar(txt('copied'), { tipo: 'sucesso' })
  } catch {
    /* best-effort */
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  const lowEnd = Boolean(host.desempenho.modoLeve())
  modoLeve.value = lowEnd
  game = createGame()
  startGame(game)
  syncAlive()
  const ui = bakeDiscSet(46, Math.min(window.devicePixelRatio || 1, 2))
  const urls = {}
  for (const [key, cv] of ui) urls[key] = spriteUrl(cv)
  uiUrls.value = urls
  // the real-3D board
  scene3d = createBoardScene({
    canvas: canvasRef.value,
    lowEnd,
    coords: false,
    set: buildCheckersSet3D({ quality: lowEnd ? 'low' : 'high' }),
    onTap,
  })
  syncScene()
  resizeObserver = new ResizeObserver(() => scene3d?.resize())
  resizeObserver.observe(rootRef.value)
  pararIdentidade = host.identidade.aoMudar((quem) => {
    meuNome.value = quem?.nome || ''
  })

  // A janela aberta pelo link ou pelo QR de um convite já vai para a entrada
  // na sala, como fazia a prop `joinCode`. Só vale o convite com que a janela
  // abriu: um segundo convite com ela já aberta não chega aqui (limitação
  // aceita desta versão; está no README).
  const convite = host.sala.conviteRecebido()
  if (convite) {
    phase.value = 'join'
    joinInput.value = convite.toUpperCase()
    later(() => guestJoin(convite), 300)
  }

  if (emModoE2E()) {
    window.__checkers = {
      get state() {
        return game
      },
      get thinking() {
        return aiThinking.value
      },
      startLocal,
      startAI: (level, side) => startAI(level, side),
      move: (from, to) => {
        const m = legalMoves(game).find(
          (mm) =>
            mm.from[0] === from[0] &&
            mm.from[1] === from[1] &&
            mm.to[0] === to[0] &&
            mm.to[1] === to[1],
        )
        if (m) commitMove(m)
      },
      stage: () => {
        startLocal()
        const seq = [
          [
            [5, 0],
            [4, 1],
          ],
          [
            [2, 1],
            [3, 2],
          ],
          [
            [5, 2],
            [4, 3],
          ],
          [
            [2, 3],
            [3, 4],
          ],
          [
            [6, 1],
            [5, 0],
          ],
          [
            [2, 5],
            [3, 6],
          ],
        ]
        for (const [f, tt] of seq) {
          const m = legalMoves(game).find(
            (mm) =>
              mm.from[0] === f[0] &&
              mm.from[1] === f[1] &&
              mm.to[0] === tt[0] &&
              mm.to[1] === tt[1],
          )
          if (m) commitMove(m)
        }
      },
    }
  }
})

onUnmounted(() => {
  for (const id of pendingTimers) clearTimeout(id)
  pendingTimers.clear()
  cleanupOnline()
  resizeObserver?.disconnect()
  pararIdentidade?.()
  scene3d?.dispose()
  scene3d = null
  if (emModoE2E()) delete window.__checkers
})
</script>

<style scoped lang="scss">
// Veio de `checkers/styles/ros-checkers.scss` do RoqueOS em 25/09/2026. Os
// valores são os mesmos; só mudou de onde vêm os tokens do sistema.
.ros-checkers {
  // Cores de identidade do jogo, como custom property para que um tema consiga
  // alcançá-las. As que vêm do sistema herdam o token do RoqueOS quando ele
  // existe e caem no valor que o tema padrão do RoqueOS dá, em 25/09/2026,
  // quando o jogo roda sozinho: fora do RoqueOS não há `tokens-root.scss`
  // nenhum carregado.
  --ros-checkers-texto: var(--ros-text, rgba(255, 255, 255, 0.95));
  --ros-checkers-texto-100: var(--ros-text-100, #ffffff);
  --ros-checkers-texto-suave: var(--ros-text-muted, rgba(255, 255, 255, 0.72));
  --ros-checkers-borda-sutil: var(--ros-border-subtle, rgba(255, 255, 255, 0.12));
  --ros-checkers-borda-discreta: var(--ros-border-muted, rgba(255, 255, 255, 0.08));
  --ros-checkers-borda-suave: var(--ros-border-soft, rgba(255, 255, 255, 0.1));
  --ros-checkers-linha-15: var(--ros-line-15, rgba(255, 255, 255, 0.15));
  --ros-checkers-preenchimento-07: var(--ros-fill-07, rgba(255, 255, 255, 0.07));
  --ros-checkers-preenchimento-08: var(--ros-fill-08, rgba(255, 255, 255, 0.08));
  --ros-checkers-preenchimento-10: var(--ros-fill-10, rgba(255, 255, 255, 0.1));
  --ros-checkers-preenchimento-16: var(--ros-fill-16, rgba(255, 255, 255, 0.16));
  --ros-checkers-sombra-45: var(--ros-shadow-45, rgba(0, 0, 0, 0.45));
  --ros-checkers-sombra-50: var(--ros-shadow-50, rgba(0, 0, 0, 0.5));
  --ros-checkers-veu-30: var(--ros-scrim-30, rgba(0, 0, 0, 0.3));
  --ros-checkers-veu-55: var(--ros-scrim-55, rgba(0, 0, 0, 0.55));
  --ros-checkers-preto-rgb: var(--ros-black-rgb, 0, 0, 0);
  --ros-checkers-branco-rgb: var(--ros-white-rgb, 255, 255, 255);
  --ros-checkers-desfoque: var(--ros-backdrop-blur, blur(20px));
  --ros-checkers-bg-1: rgba(232, 139, 95, 0.12);
  --ros-checkers-bg-2: rgba(150, 96, 44, 0.14);
  --ros-checkers-bg-3: #17120c;
  --ros-checkers-bg-4: #0a0806;
  --ros-checkers-bg-5: rgba(26, 20, 14, 0.6);
  --ros-checkers-line-1: rgba(226, 190, 132, 0.55);
  --ros-checkers-shadow-1: rgba(226, 190, 132, 0.25);
  --ros-checkers-shadow-2: rgba(160, 110, 40, 0.18);
  --ros-checkers-bg-6: #4a3a26;
  --ros-checkers-bg-7: #241a10;
  --ros-checkers-fg-1: #e5c98a;
  --ros-checkers-shadow-3: rgba(229, 201, 138, 0.8);
  --ros-checkers-bg-8: rgba(150, 100, 20, 0.85);
  --ros-checkers-line-2: rgba(255, 200, 110, 0.5);
  --ros-checkers-fg-2: #ffedc9;
  --ros-checkers-bg-9: rgba(10, 8, 6, 0.55);
  --ros-checkers-bg-10: #fdf6e8;
  --ros-checkers-bg-11: #e2be84;
  --ros-checkers-bg-12: #9a6b32;
  --ros-checkers-bg-13: rgba(32, 25, 17, 0.78);
  --ros-checkers-shadow-4: rgba(160, 110, 40, 0.2);
  --ros-checkers-bg-14: rgba(32, 25, 17, 0.7);
  --ros-checkers-shadow-5: rgba(226, 190, 132, 0.4);
  --ros-checkers-bg-15: rgba(24, 19, 13, 0.82);
  --ros-checkers-line-3: rgba(226, 190, 132, 0.22);
  --ros-checkers-bg-16: #f6efe2;
  --ros-checkers-bg-17: rgba(226, 190, 132, 0.1);
  --ros-checkers-line-4: rgba(226, 190, 132, 0.3);
  --ros-checkers-fg-3: #f87171;
  --ros-checkers-bg-18: #e2b268;
  --ros-checkers-bg-19: #a9742f;
  --ros-checkers-fg-4: #241a0d;
  --ros-checkers-shadow-6: rgba(200, 150, 70, 0.35);
  --ros-checkers-bg-20: rgba(10, 8, 6, 0.85);
  --ros-checkers-bg-21: rgba(26, 20, 14, 0.92);
}

.ros-checkers {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  background: radial-gradient(90% 70% at 18% -8%, var(--ros-checkers-bg-1), transparent 55%),
    radial-gradient(80% 60% at 85% 108%, var(--ros-checkers-bg-2), transparent 60%),
    linear-gradient(180deg, var(--ros-checkers-bg-3) 0%, var(--ros-checkers-bg-4) 100%);

  &__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  &__pcard {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: min(94%, 620px);
    height: 50px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 0 12px;
    border-radius: 13px;
    background: var(--ros-checkers-bg-5);
    border: 1px solid var(--ros-checkers-borda-discreta);
    backdrop-filter: var(--ros-checkers-desfoque);
    -webkit-backdrop-filter: var(--ros-checkers-desfoque);
    pointer-events: none;
    transition:
      border-color 0.25s ease,
      box-shadow 0.25s ease;

    &--top {
      top: 10px;
    }
    &--bottom {
      bottom: calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    }

    &.is-active {
      border-color: var(--ros-checkers-line-1);
      box-shadow:
        0 0 0 1px var(--ros-checkers-shadow-1),
        0 10px 30px var(--ros-checkers-shadow-2);

      .ros-checkers__turn-dot {
        opacity: 1;
        animation: checkers-dot 1.4s ease-in-out infinite;
      }
    }
  }

  &__avatar {
    width: 34px;
    height: 34px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid var(--ros-checkers-borda-sutil);
    background: linear-gradient(160deg, var(--ros-checkers-bg-6), var(--ros-checkers-bg-7));

    img {
      width: 30px;
      height: 30px;
    }
  }

  &__pname {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--ros-checkers-texto);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  &__caps {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;

    img {
      width: 19px;
      height: 19px;
      filter: drop-shadow(0 1px 1px var(--ros-checkers-sombra-50));
    }
    b {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--ros-checkers-fg-1);
    }
  }

  &__turn-dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--ros-checkers-fg-1);
    box-shadow: 0 0 10px var(--ros-checkers-shadow-3);
    opacity: 0;
    margin: 0 4px;
  }

  &__must {
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--ros-checkers-bg-8);
    border: 1px solid var(--ros-checkers-line-2);
    color: var(--ros-checkers-fg-2);
    font-size: 11.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  &__icon-btn {
    flex: none;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: var(--ros-checkers-preenchimento-07);
    color: var(--ros-checkers-texto-suave);
    cursor: pointer;
    pointer-events: auto;

    &:hover {
      background: var(--ros-checkers-preenchimento-16);
      color: var(--ros-checkers-texto);
    }
  }

  &__menu,
  &__wait,
  &__over {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    z-index: 6;
    padding: 24px;
  }

  &__menu {
    background: var(--ros-checkers-bg-9);
    backdrop-filter: var(--ros-checkers-desfoque);
    -webkit-backdrop-filter: var(--ros-checkers-desfoque);
  }

  &__hero {
    position: relative;
    height: 82px;
    width: 128px;
    margin-bottom: -4px;
    filter: drop-shadow(0 14px 22px rgba(var(--ros-checkers-preto-rgb), 0.55));
  }

  &__hero-piece {
    position: absolute;
    bottom: 0;
    width: 74px;
    height: 74px;

    &.is-l {
      left: 0;
      transform: rotate(-6deg);
      z-index: 2;
    }
    &.is-r {
      right: 0;
      width: 84px;
      height: 84px;
      transform: rotate(5deg);
    }
  }

  &__over {
    background: var(--ros-checkers-veu-55);
    backdrop-filter: var(--ros-checkers-desfoque);
    -webkit-backdrop-filter: var(--ros-checkers-desfoque);
  }

  &__logo {
    font-size: clamp(38px, 10vw, 54px);
    font-weight: 800;
    letter-spacing: 7px;
    background: linear-gradient(
      120deg,
      var(--ros-checkers-bg-10) 0%,
      var(--ros-checkers-bg-11) 55%,
      var(--ros-checkers-bg-12) 120%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__sub {
    font-size: 14px;
    color: var(--ros-checkers-texto-suave);
    margin-bottom: 18px;
    text-align: center;
  }

  &__menu-btns {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(330px, 88%);
  }

  &__mbtn {
    display: grid;
    grid-template-columns: 26px 1fr;
    grid-template-rows: auto auto;
    column-gap: 12px;
    align-items: center;
    text-align: left;
    padding: 14px 18px;
    border: 1px solid var(--ros-checkers-borda-suave);
    border-radius: 14px;
    background: var(--ros-checkers-bg-13);
    color: var(--ros-checkers-texto);
    cursor: pointer;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    // O ícone ocupa as duas linhas da coluna da esquerda (era o `.q-icon`).
    .icone-damas {
      grid-row: 1 / 3;
      color: var(--ros-checkers-bg-11);
    }
    span {
      font-size: 15px;
      font-weight: 700;
    }
    small {
      font-size: 11.5px;
      color: var(--ros-checkers-texto-suave);
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--ros-checkers-line-1);
      box-shadow: 0 10px 26px var(--ros-checkers-shadow-4);
    }
  }

  &__side-row {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 96px;
    padding: 12px 10px;
    border: 1px solid var(--ros-checkers-borda-suave);
    border-radius: 14px;
    background: var(--ros-checkers-bg-14);
    color: var(--ros-checkers-texto-suave);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease,
      color 0.15s ease;

    img {
      width: 38px;
      height: 38px;
    }
    span {
      font-size: 12.5px;
      font-weight: 700;
    }

    &.is-on {
      border-color: var(--ros-checkers-bg-11);
      color: var(--ros-checkers-texto);
      box-shadow: 0 0 0 1px var(--ros-checkers-shadow-5);
      transform: translateY(-2px);
    }
  }

  &__thinking {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ros-checkers-fg-1);
    white-space: nowrap;
  }

  &__wait-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 26px 30px;
    border-radius: 20px;
    background: var(--ros-checkers-bg-15);
    border: 1px solid var(--ros-checkers-line-3);
    backdrop-filter: var(--ros-checkers-desfoque);
    -webkit-backdrop-filter: var(--ros-checkers-desfoque);
    box-shadow: 0 24px 60px var(--ros-checkers-sombra-50);
    max-width: min(360px, 92%);
  }

  &__wait-title,
  &__over-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--ros-checkers-texto-100);
    text-align: center;
  }

  &__qr {
    width: min(230px, 62vw);
    aspect-ratio: 1;
    border-radius: 16px;
    background: var(--ros-checkers-bg-16);
    padding: 10px;
    box-shadow: 0 10px 30px var(--ros-checkers-sombra-45);
  }

  &__code-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__code-label {
    font-size: 12px;
    color: var(--ros-checkers-texto-suave);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  &__code {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 6px;
    color: var(--ros-checkers-bg-11);
    padding: 4px 10px 4px 16px;
    border-radius: 10px;
    background: var(--ros-checkers-bg-17);
    border: 1px solid var(--ros-checkers-line-4);
  }

  &__copy {
    // O ícone de antes era inline e o botão o centrava pelo texto; o SVG é
    // bloco, e é a grade que o põe no meio.
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 9px;
    background: var(--ros-checkers-preenchimento-10);
    color: var(--ros-checkers-texto);
    cursor: pointer;
    &:hover {
      background: rgba(var(--ros-checkers-branco-rgb), 0.18);
    }
  }

  &__wait-hint {
    font-size: 13px;
    color: var(--ros-checkers-texto-suave);
    text-align: center;
  }

  &__code-input {
    width: min(240px, 70vw);
    text-align: center;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 6px;
    text-transform: uppercase;
    padding: 12px;
    border: 1px solid var(--ros-checkers-linha-15);
    border-radius: 12px;
    background: var(--ros-checkers-veu-30);
    color: var(--ros-checkers-texto-100);
    outline: none;
    &:focus {
      border-color: var(--ros-checkers-bg-11);
    }
  }

  &__err {
    font-size: 13px;
    color: var(--ros-checkers-fg-3);
  }

  &__solid-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 26px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--ros-checkers-bg-18), var(--ros-checkers-bg-19));
    color: var(--ros-checkers-fg-4);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 8px 26px var(--ros-checkers-shadow-6);
    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  &__ghost-btn {
    padding: 9px 20px;
    border: none;
    border-radius: 999px;
    background: var(--ros-checkers-preenchimento-08);
    color: var(--ros-checkers-texto-suave);
    font-size: 13px;
    cursor: pointer;
  }

  &__net-toast {
    position: absolute;
    bottom: calc(18px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(var(--ros-checkers-preto-rgb), 0.6);
    color: var(--ros-checkers-texto);
    font-size: 13px;
    z-index: 8;
  }
}

.checkers-pop-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}
.checkers-pop-enter-from {
  transform: scale(0.8);
  opacity: 0;
}
.checkers-fade-enter-active,
.checkers-fade-leave-active {
  transition: opacity 0.25s ease;
}
.checkers-fade-enter-from,
.checkers-fade-leave-to {
  opacity: 0;
}

// O perfil leve vem do host (`desempenho.modoLeve`), não do atributo que o
// RoqueOS põe no <html>: fora do RoqueOS esse atributo não existe.
.ros-checkers--low {
  .ros-checkers__menu,
  .ros-checkers__over,
  .ros-checkers__wait-card,
  .ros-checkers__pcard {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .ros-checkers__menu,
  .ros-checkers__over {
    background: var(--ros-checkers-bg-20);
  }
  .ros-checkers__pcard {
    background: var(--ros-checkers-bg-21);
  }
  .ros-checkers__turn-dot {
    animation: none !important;
  }
}

@keyframes checkers-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.7;
  }
}
</style>
