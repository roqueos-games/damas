// As Damas inteiras, montadas pelo contrato do jogo-sdk com o host falso.
//
// Nenhum mock de store, de analytics, de i18n ou do `useRealtimeMatch` do
// RoqueOS: se o jogo ainda alcançasse algo do RoqueOS, este arquivo não rodaria
// fora dele. Os sete casos do teste que rodava no front antes da extração, em
// 25/09/2026, estão aqui (marcados com "Do front:"), com os do contrato e os da
// partida online em volta. Os mocks são dois: o do three, porque o jsdom não
// tem WebGL (ver threeStub.js), e o do qrcode, para o teste ver que link vai
// no QR.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import * as THREE from 'three'
import QRCode from 'qrcode'
import { VERSAO_DO_CONTRATO } from '@roqueos-games/jogo-sdk'
import { criarHostFalso } from '@roqueos-games/jogo-sdk/host-falso'
import jogo from '../src/index.js'
import { traduzir } from '../src/textos.js'
import { createGame, startGame, applyMove, legalMoves, serialize } from '../src/engine.js'
import manifesto from '../jogo.json'
import ptBR from '../i18n/pt-BR.json'
import enUS from '../i18n/en-US.json'
import tela from '../src/JogoDamas.vue?raw'

vi.mock('three', async () => (await import('./threeStub.js')).criarThreeFalso())
// O QR devolve o próprio link embrulhado, para o teste ler o que foi desenhado.
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async (link) => `data:image/png;base64,${btoa(link)}`) },
}))

// Um canvas 2D que aceita tudo e não desenha nada: a arte do tabuleiro e as
// figurinhas das peças pintam no canvas, e o jsdom não tem canvas 2D. É o
// mesmo dublê do teste do front.
const make2dStub = () => {
  const stub = new Proxy(function () {}, {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 0 : stub),
    set: () => true,
    apply: () => stub,
  })
  return stub
}

let el = null
let host = null
let montagem = null
// O laço do tabuleiro 3D roda no requestAnimationFrame. Aqui o quadro só anda
// quando o teste manda. É uma fila, e não "o último callback", porque as
// <transition> do Vue também pedem quadro.
let fila = []
const rodar = (n = 1) => {
  for (let i = 0; i < n; i++) for (const fn of fila.splice(0)) fn(performance.now())
}

const palco = () => {
  el = document.createElement('div')
  document.body.appendChild(el)
  return el
}
const montou = () =>
  vi.waitFor(() => {
    if (!el.querySelector('.ros-checkers')) throw new Error('as Damas ainda não montaram')
  })
const montarCom = async (h, { ativo = true } = {}) => {
  host = h
  montagem = jogo.mount(palco(), host, { windowId: 'w1', ativo })
  // O app só monta com o texto do idioma carregado.
  await montou()
  await nextTick()
}
const novoHost = (opcoes = {}) => criarHostFalso({ jogoId: 'checkers', ...opcoes })
const montar = ({ ativo = true, ...opcoes } = {}) => montarCom(novoHost(opcoes), { ativo })
// Quem joga online tem conta; o host falso nasce convidado.
const comConta = (opcoes = {}) => montar({ uid: 'ana', nome: 'Ana', ...opcoes })

const $ = (sel) => el.querySelector(sel)
const $$ = (sel) => [...el.querySelectorAll(sel)]
const texto = (sel) => $(sel)?.textContent.trim() ?? null
const chamadas = (capacidade, metodo) =>
  host.chamadas.filter((c) => c.capacidade === capacidade && c.metodo === metodo).map((c) => c.args)
const eventos = (nome) => chamadas('metricas', 'evento').filter((a) => a[0] === nome)
const avisos = () => chamadas('avisar', 'avisar')
const tecla = (key, tipo = 'keydown') => window.dispatchEvent(new KeyboardEvent(tipo, { key }))
const renderizador = () => $('.ros-checkers__canvas').__renderizador
const nomes = () => [
  texto('.ros-checkers__pcard--top .ros-checkers__pname'),
  texto('.ros-checkers__pcard--bottom .ros-checkers__pname'),
]
// Espera o que chega fora de ordem (a sala entrega numa microtarefa, o texto
// do idioma e o QR descem por import dinâmico).
const esperar = (fn) => vi.waitFor(fn, { timeout: 2000 })

// Um toque sem arrastar na casa [linha, coluna]: o tabuleiro 3D recebe o
// ponteiro no canvas, o raio do three falso acerta a casa, e o jogo recebe o
// `onTap`, como no aparelho. O jsdom não tem PointerEvent completo; vai um
// Event com os campos que o tabuleiro lê, como no teste do tabuleiro.
const tocar = (linha, coluna) => {
  THREE.Raycaster.mira = [linha, coluna]
  const cv = $('.ros-checkers__canvas')
  for (const tipo of ['pointerdown', 'pointerup']) {
    const ev = new Event(tipo, { bubbles: true, cancelable: true })
    Object.assign(ev, { pointerId: 1, isPrimary: true, clientX: 200, clientY: 200 })
    cv.dispatchEvent(ev)
  }
  THREE.Raycaster.mira = null
}
const jogarPeloToque = (de, para) => {
  tocar(...de)
  tocar(...para)
}

// O tabuleiro de abertura e o tabuleiro depois de uma lista de lances, no
// formato que atravessa a sala (o `serialize` do motor).
const partida = (...lances) => {
  const g = createGame({ mode: 'online' })
  startGame(g)
  for (const [from, to] of lances) {
    const m = legalMoves(g).find(
      (x) =>
        x.from[0] === from[0] && x.from[1] === from[1] && x.to[0] === to[0] && x.to[1] === to[1],
    )
    if (!m) throw new Error(`lance ilegal no teste: ${from} → ${to}`)
    applyMove(g, m)
  }
  return g
}
const vazio = () => Array.from({ length: 8 }, () => new Array(8).fill(0))

describe('Damas pelo jogo-sdk', () => {
  beforeEach(() => {
    window.__ROS_E2E__ = {} // instala o gancho __checkers
    fila = []
    THREE.Raycaster.mira = null
    QRCode.toDataURL.mockClear()
    vi.stubGlobal('requestAnimationFrame', (fn) => fila.push(fn))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => make2dStub())
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QQ==')
  })
  afterEach(() => {
    montagem?.desmontar()
    el?.remove()
    montagem = null
    el = null
    host = null
    THREE.Raycaster.mira = null
    delete window.__ROS_E2E__
    delete window.__checkers
    delete window.devicePixelRatio
    delete navigator.clipboard
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('o contrato', () => {
    it('é um jogo do SDK, com o id que a sala e o catálogo usam, e exige a sala', () => {
      expect(jogo.id).toBe('checkers')
      expect(jogo.versaoDoContrato).toBe(VERSAO_DO_CONTRATO)
      expect(jogo.capacidades).toEqual(['sala'])
      expect(manifesto.id).toBe('checkers')
      expect(manifesto.capacidades).toEqual(['sala'])
      expect(manifesto.aceitaConvite).toBe(true)
    })

    it('host sem a capacidade sala não monta as Damas', () => {
      const semSala = novoHost({ sala: false })
      expect(() => jogo.mount(palco(), semSala, { ativo: true })).toThrow(/sala/)
      expect(el.querySelector('.ros-checkers')).toBeNull()
    })

    it('toda chave que a tela usa existe no pt-BR, os três níveis inclusive', () => {
      const usadas = [...tela.matchAll(/txt\('([\w.]+)'/g)].map((m) => m[1])
      expect(usadas.length).toBeGreaterThan(40)
      // `txt(\`level_${aiLevel.value}\`)` monta a chave em tempo de execução.
      const niveis = ['easy', 'medium', 'hard'].map((n) => `level_${n}`)
      const faltando = [...usadas, ...niveis].filter((k) => traduzir(ptBR, k) === k)
      expect(faltando).toEqual([])
    })
  })

  describe('o menu e o idioma', () => {
    // Do front: 'opens on the menu with vs-AI, local + online options'.
    it('abre no menu com IA, local e as duas entradas online, no idioma do host', async () => {
      await montar()
      expect(texto('.ros-checkers__logo')).toBe(ptBR.title)
      expect(texto('.ros-checkers__sub')).toBe(ptBR.tagline)
      const botoes = $$('.ros-checkers__mbtn')
      expect(botoes).toHaveLength(4)
      expect(botoes.map((b) => b.querySelector('span').textContent)).toEqual([
        ptBR.vsAi,
        ptBR.local,
        ptBR.createOnline,
        ptBR.joinOnline,
      ])
      expect($('.ros-checkers__mbtn--ai')).not.toBeNull()
      expect($('.ros-checkers__mbtn--online')).not.toBeNull()
      // As duas peças do herói são as figurinhas pintadas pela arte do tabuleiro.
      expect($$('.ros-checkers__hero-piece')).toHaveLength(2)
      // Cada botão do menu tem o seu ícone, sem nada do Quasar.
      expect($$('.ros-checkers__mbtn svg.icone-damas')).toHaveLength(4)
      expect(el.innerHTML).not.toMatch(/q-icon|q-spinner/)
      expect(window.__checkers.state.status).toBe('playing')
    })

    it('fala o idioma do host, e troca quando o host troca', async () => {
      await montar({ idioma: 'en-US' })
      expect(texto('.ros-checkers__logo')).toBe(enUS.title)
      expect(texto('.ros-checkers__mbtn--ai span')).toBe(enUS.vsAi)
      host.disparar('idioma', 'pt-BR')
      await esperar(() => expect(texto('.ros-checkers__logo')).toBe(ptBR.title))
      expect(texto('.ros-checkers__mbtn--ai span')).toBe(ptBR.vsAi)
    })

    it('em árabe o jogo se desenha da direita para a esquerda', async () => {
      await montar({ idioma: 'ar-AR' })
      expect($('.ros-checkers').getAttribute('dir')).toBe('rtl')
    })

    // O componente de antes não ouvia teclado nenhum, e continua assim: as
    // Damas se jogam com o ponteiro. Com duas janelas abertas, tecla nenhuma
    // mexe em nenhuma das duas. O único Enter que vale é o do campo do código,
    // que só recebe tecla quando está em foco.
    it('tecla nenhuma mexe no jogo, esteja a janela ativa ou não', async () => {
      await montar()
      for (const key of ['Enter', ' ', 'ArrowUp', 'Escape', '1']) {
        tecla(key)
        tecla(key, 'keyup')
      }
      await nextTick()
      expect($('.ros-checkers__menu')).not.toBeNull()
      expect(eventos('game_start')).toHaveLength(0)
      window.__checkers.startLocal()
      montagem.ativar(false)
      for (const key of ['Enter', ' ', 'ArrowUp', 'Escape']) tecla(key)
      montagem.ativar(true)
      for (const key of ['Enter', ' ', 'ArrowUp', 'Escape']) tecla(key)
      expect(window.__checkers.state.moves).toBe(0)
      expect(window.__checkers.state.turn).toBe(1)
    })
  })

  describe('local e contra a IA', () => {
    // Do front: 'starts a local game with 12 men per side'.
    it('o jogo local começa com 12 pedras de cada lado, e game_start sai com o nome e os dados de antes', async () => {
      await montar()
      $$('.ros-checkers__mbtn')[1].click()
      await nextTick()
      expect(window.__checkers.state.status).toBe('playing')
      let claras = 0
      let escuras = 0
      for (const row of window.__checkers.state.board)
        for (const v of row) v > 0 ? claras++ : v < 0 ? escuras++ : 0
      expect(claras).toBe(12)
      expect(escuras).toBe(12)
      expect(eventos('game_start')).toEqual([['game_start', { mode: 'local' }]])
      expect(nomes()).toEqual([ptBR.dark, ptBR.light])
    })

    it('o clique que começa destrava o áudio no mesmo gesto', async () => {
      await montar()
      expect(host.contar('audio', 'destravar')).toBe(0)
      $$('.ros-checkers__mbtn')[1].click()
      expect(host.contar('audio', 'destravar')).toBe(1)
    })

    // Do front: 'plays a move and hands over the turn'.
    it('um lance passa a vez', async () => {
      await montar()
      window.__checkers.startLocal()
      window.__checkers.move([5, 0], [4, 1]) // uma pedra anda
      expect(window.__checkers.state.board[4][1]).toBe(1)
      expect(window.__checkers.state.turn).toBe(2)
    })

    it('tocar na pedra e depois na casa joga; tocar na pedra de quem não joga não seleciona', async () => {
      await montar()
      $$('.ros-checkers__mbtn')[1].click()
      await nextTick()
      jogarPeloToque([2, 1], [3, 2]) // as escuras não jogam primeiro
      expect(window.__checkers.state.board[3][2]).toBe(0)
      expect(window.__checkers.state.turn).toBe(1)
      jogarPeloToque([5, 0], [4, 1])
      expect(window.__checkers.state.board[5][0]).toBe(0)
      expect(window.__checkers.state.board[4][1]).toBe(1)
      expect(window.__checkers.state.turn).toBe(2)
      await nextTick()
      expect($('.ros-checkers__pcard--top').classList.contains('is-active')).toBe(true)
      expect($('.ros-checkers__pcard--bottom').classList.contains('is-active')).toBe(false)
    })

    it('com captura na mesa, o aviso de captura obrigatória aparece', async () => {
      await montar()
      window.__checkers.startLocal()
      window.__checkers.move([5, 2], [4, 3])
      window.__checkers.move([2, 5], [3, 4]) // agora as claras são obrigadas a comer
      await nextTick()
      expect(texto('.ros-checkers__must')).toBe(ptBR.mustCapture)
      // Com captura obrigatória, o passo simples não vale.
      jogarPeloToque([5, 0], [4, 1])
      expect(window.__checkers.state.board[4][1]).toBe(0)
      jogarPeloToque([4, 3], [2, 5])
      expect(window.__checkers.state.board[3][4]).toBe(0)
      expect(window.__checkers.state.board[2][5]).toBe(1)
      await nextTick()
      expect(texto('.ros-checkers__pcard--bottom .ros-checkers__caps b')).toBe('×1')
    })

    // Do front: 'capturing the last enemy piece wins and ends the game'.
    it('comer a última pedra vence e encerra, com o game_over de antes', async () => {
      await montar()
      window.__checkers.startLocal()
      const st = window.__checkers.state
      st.board = vazio()
      st.board[5][2] = 1
      st.board[4][3] = -1
      st.turn = 1
      window.__checkers.move([5, 2], [3, 4]) // come a última pedra
      await nextTick()
      expect(st.status).toBe('won')
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.lightWins)
      expect(eventos('game_over')).toEqual([['game_over', { mode: 'local' }]])
    })

    it('"Novo jogo" no fim e o X do cartão voltam ao menu', async () => {
      await montar()
      window.__checkers.startLocal()
      await nextTick()
      $('.ros-checkers__icon-btn').click()
      await nextTick()
      expect($('.ros-checkers__menu')).not.toBeNull()
      expect($('.ros-checkers__pcard--top')).toBeNull()
      window.__checkers.startLocal()
      const st = window.__checkers.state
      st.board = vazio()
      st.board[5][2] = 1
      st.board[4][3] = -1
      window.__checkers.move([5, 2], [3, 4])
      await nextTick()
      $('.ros-checkers__over .ros-checkers__solid-btn').click()
      await nextTick()
      expect($('.ros-checkers__menu')).not.toBeNull()
    })

    // Do front: 'vs AI: opens the setup, starts a match, and the bot replies'.
    it('contra a IA: abre a escolha, começa, e a IA responde depois de pensar', async () => {
      await montar()
      $('.ros-checkers__mbtn--ai').click()
      await nextTick()
      expect($('.ros-checkers__side-row')).not.toBeNull() // lado + nível
      expect(texto('.ros-checkers__logo')).toBe(ptBR.vsAi)
      vi.useFakeTimers()
      window.__checkers.startAI('easy')
      expect(window.__checkers.state.status).toBe('playing')
      expect(eventos('game_start')).toEqual([['game_start', { mode: 'ai', level: 'easy' }]])
      window.__checkers.move([5, 0], [4, 1]) // o jogador (claras) anda; a IA (escuras) responde
      expect(window.__checkers.thinking).toBe(true)
      await nextTick()
      expect(texto('.ros-checkers__thinking')).toBe(ptBR.thinking)
      expect($('.ros-checkers__thinking svg.icone-damas')).not.toBeNull()
      vi.advanceTimersByTime(400)
      expect(window.__checkers.state.moves).toBe(1)
      vi.advanceTimersByTime(200) // a IA pensa 460 ms
      expect(window.__checkers.state.moves).toBe(2)
      expect(window.__checkers.state.turn).toBe(1)
      await nextTick()
      expect($('.ros-checkers__thinking')).toBeNull()
      expect(nomes()).toEqual([`${ptBR.ai} · ${ptBR.level_easy}`, ptBR.you])
    })

    it('escolher as escuras pelos botões: a IA abre, e o jogador fica embaixo', async () => {
      await montar()
      $('.ros-checkers__mbtn--ai').click()
      await nextTick()
      $$('.ros-checkers__side')[1].click()
      await nextTick()
      expect($$('.ros-checkers__side')[1].classList.contains('is-on')).toBe(true)
      vi.useFakeTimers()
      $$('.ros-checkers__mbtn')[2].click() // Difícil
      expect(eventos('game_start')).toEqual([['game_start', { mode: 'ai', level: 'hard' }]])
      expect(window.__checkers.thinking).toBe(true)
      vi.advanceTimersByTime(500)
      expect(window.__checkers.state.moves).toBe(1)
      expect(window.__checkers.state.turn).toBe(2)
      await nextTick()
      expect(nomes()).toEqual([`${ptBR.ai} · ${ptBR.level_hard}`, ptBR.you])
    })

    it('vencer a IA diz "Você venceu!" e o game_over leva o nível, como antes', async () => {
      await montar()
      window.__checkers.startAI('medium')
      const st = window.__checkers.state
      st.board = vazio()
      st.board[5][2] = 1
      st.board[4][3] = -1
      window.__checkers.move([5, 2], [3, 4])
      await nextTick()
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.youWin)
      expect(eventos('game_over')).toEqual([['game_over', { mode: 'ai', level: 'medium' }]])
    })

    it('voltar ao menu com a IA pensando não deixa a IA jogar depois', async () => {
      await montar()
      vi.useFakeTimers()
      window.__checkers.startAI('easy')
      window.__checkers.move([5, 0], [4, 1])
      await nextTick()
      $('.ros-checkers__icon-btn').click()
      vi.advanceTimersByTime(1000)
      expect(window.__checkers.state.moves).toBe(1)
    })

    it('entrar na conta com o jogo aberto põe o nome da conta no cartão', async () => {
      await montar()
      window.__checkers.startAI('easy')
      await nextTick()
      expect(nomes()[1]).toBe(ptBR.you)
      host.disparar('identidade', { uid: 'u1', nome: 'Ana' })
      await nextTick()
      expect(nomes()[1]).toBe('Ana')
    })

    // As Damas não têm recorde (o manifesto diz `recorde: null`) e nunca
    // guardaram nada no localStorage. Convidado joga igual a quem tem conta.
    it('convidado joga local e contra a IA, e nada vai para placar ou armazenamento', async () => {
      const h = novoHost()
      const gravarNoHost = vi.spyOn(h.storage, 'setItem')
      const gravarNoNavegador = vi.spyOn(Storage.prototype, 'setItem')
      await montarCom(h)
      window.__checkers.startLocal()
      window.__checkers.move([5, 0], [4, 1])
      window.__checkers.startAI('easy')
      const st = window.__checkers.state
      st.board = vazio()
      st.board[5][2] = 1
      st.board[4][3] = -1
      window.__checkers.move([5, 2], [3, 4])
      await nextTick()
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.youWin)
      expect(host.contar('placar', 'carregar')).toBe(0)
      expect(host.contar('placar', 'salvar')).toBe(0)
      expect(gravarNoHost).not.toHaveBeenCalled()
      expect(gravarNoNavegador).not.toHaveBeenCalled()
    })
  })

  describe('a partida online pela sala', () => {
    // Cria a sala pelo botão do menu e devolve o código que apareceu na tela.
    const criarSala = async () => {
      $('.ros-checkers__mbtn--online').click()
      await esperar(() => expect($('.ros-checkers__code')).not.toBeNull())
      return texto('.ros-checkers__code')
    }
    // Outra pessoa abriu uma sala e espera no código ABC23.
    const salaDaBia = (h, codigo = 'ABC23') =>
      h.disparar('sala', {
        acao: 'criar',
        codigo,
        uid: 'bia',
        nome: 'Bia',
        estadoInicial: serialize(partida()),
        vez: 'host',
      })
    const entrarPeloCodigo = async (codigo) => {
      if ($('.ros-checkers__menu')) {
        $$('.ros-checkers__mbtn')[3].click()
        await nextTick()
      }
      const campo = $('.ros-checkers__code-input')
      campo.value = codigo
      campo.dispatchEvent(new Event('input'))
      await nextTick()
      $('.ros-checkers__wait .ros-checkers__solid-btn').click()
    }

    // Do front: 'creating an online game shows the QR/code wait screen'.
    it('criar mostra a espera com o código, e o QR e o "copiar" levam o link que o host devolveu', async () => {
      await comConta()
      const codigo = await criarSala()
      expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
      expect(texto('.ros-checkers__wait-title')).toBe(ptBR.waiting)
      // O que a sala recebe é o que o banco recebia: o tabuleiro do motor e a vez 'host'.
      expect(chamadas('sala', 'criar')).toEqual([
        [{ estadoInicial: serialize(partida()), vez: 'host' }],
      ])
      expect(host.salas.ler(codigo)).toMatchObject({
        anfitriao: 'ana',
        nomeDoAnfitriao: 'Ana',
        situacao: 'esperando',
        vez: 'host',
        estado: serialize(partida()),
      })
      const link = `https://host-falso.invalid/checkers?sala=${codigo}`
      await esperar(() => expect($('.ros-checkers__qr')).not.toBeNull())
      expect(QRCode.toDataURL).toHaveBeenCalledWith(link, {
        width: 320,
        margin: 1,
        color: { dark: '#241812', light: '#f6efe2' },
      })
      expect($('.ros-checkers__qr').getAttribute('src')).toBe(`data:image/png;base64,${btoa(link)}`)
      const escrever = vi.fn(async () => {})
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: escrever },
        configurable: true,
      })
      $('.ros-checkers__copy').click()
      await esperar(() => expect(avisos()).toEqual([[ptBR.copied, { tipo: 'sucesso' }]]))
      expect(escrever).toHaveBeenCalledWith(link)
      expect(eventos('game_start')).toEqual([['game_start', { mode: 'online-host' }]])
    })

    it('sem conta, criar avisa como antes e não sai do menu', async () => {
      await montar() // convidado
      $('.ros-checkers__mbtn--online').click()
      await esperar(() => expect(avisos()).toEqual([[ptBR.needAccount, { tipo: 'aviso' }]]))
      expect($('.ros-checkers__menu')).not.toBeNull()
      expect($('.ros-checkers__wait')).toBeNull()
      expect(eventos('game_start')).toHaveLength(0)
    })

    it('cancelar a espera volta ao menu e para de observar a sala', async () => {
      await comConta()
      const codigo = await criarSala()
      $('.ros-checkers__wait .ros-checkers__ghost-btn').click()
      await nextTick()
      expect($('.ros-checkers__menu')).not.toBeNull()
      host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
      await nextTick()
      expect($('.ros-checkers__pcard--top')).toBeNull()
      expect($('.ros-checkers__net-toast')).toBeNull()
    })

    it('a partida online começa zerada, sem herdar vez, destaque nem captura obrigatória da anterior', async () => {
      await comConta()
      // A última jogada fica destacada no tabuleiro com duas placas desta cor.
      const destaques = () =>
        renderizador().cena.children.filter((m) => m.visible && m.material?.color?.hex === 0xb9c94d)
      window.__checkers.startLocal()
      window.__checkers.move([5, 2], [4, 3])
      window.__checkers.move([2, 5], [3, 4])
      window.__checkers.move([4, 3], [2, 5]) // as escuras ficam obrigadas a comer
      await nextTick()
      expect(destaques()).toHaveLength(2)
      expect($('.ros-checkers__must')).not.toBeNull()
      expect($('.ros-checkers__pcard--top').classList.contains('is-active')).toBe(true)
      $('.ros-checkers__icon-btn').click() // X: volta ao menu
      await nextTick()
      const codigo = await criarSala()
      expect(destaques()).toHaveLength(0)
      host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
      await nextTick()
      // O aviso da partida anterior sai por uma <transition>, que anda no quadro.
      rodar(2)
      await nextTick()
      expect($('.ros-checkers__pcard--bottom').classList.contains('is-active')).toBe(true)
      expect($('.ros-checkers__pcard--top').classList.contains('is-active')).toBe(false)
      expect($('.ros-checkers__must')).toBeNull()
    })

    it('do lado de quem cria: o outro entra, e os lances vão e voltam no formato de antes', async () => {
      await comConta()
      const codigo = await criarSala()
      expect(host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })).toEqual({
        ok: true,
      })
      await nextTick()
      expect($('.ros-checkers__wait')).toBeNull()
      expect(texto('.ros-checkers__net-toast')).toBe(ptBR.oppJoined)
      expect(nomes()).toEqual(['Bia', 'Ana'])

      // Eu (claras) jogo; vai para a sala o tabuleiro, a vez 2 e a partida em curso.
      jogarPeloToque([5, 0], [4, 1])
      const meu = serialize(
        partida([
          [5, 0],
          [4, 1],
        ]),
      )
      expect(chamadas('sala', 'jogar')).toEqual([
        [codigo, { estado: meu, vez: 2, vencedor: null, situacao: 'jogando' }],
      ])
      expect(host.salas.ler(codigo)).toMatchObject({ estado: meu, vez: 2, situacao: 'jogando' })

      // Não é a minha vez: o toque não joga.
      jogarPeloToque([5, 2], [4, 3])
      expect(window.__checkers.state.board[4][3]).toBe(0)
      expect(chamadas('sala', 'jogar')).toHaveLength(1)

      // A Bia (escuras) joga do outro lado.
      const dela = serialize(
        partida(
          [
            [5, 0],
            [4, 1],
          ],
          [
            [2, 1],
            [3, 2],
          ],
        ),
      )
      host.disparar('sala', { acao: 'jogar', codigo, estado: dela, vez: 1 })
      await nextTick()
      expect(window.__checkers.state.board[3][2]).toBe(-1)
      expect(window.__checkers.state.board[2][1]).toBe(0)
      expect(window.__checkers.state.turn).toBe(1)

      // A minha vez de novo.
      jogarPeloToque([5, 2], [4, 3])
      expect(window.__checkers.state.board[4][3]).toBe(1)
      expect(chamadas('sala', 'jogar')).toHaveLength(2)
      expect(chamadas('sala', 'jogar')[1][1]).toMatchObject({ vez: 2, situacao: 'jogando' })
    })

    it('do lado de quem cria: comer a última pedra encerra a sala com o vencedor', async () => {
      await comConta()
      const codigo = await criarSala()
      host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
      await nextTick()
      const st = window.__checkers.state
      st.board = vazio()
      st.board[5][2] = 1
      st.board[4][3] = -1
      jogarPeloToque([5, 2], [3, 4])
      await nextTick()
      const [, jogada] = chamadas('sala', 'jogar').at(-1)
      expect(jogada).toMatchObject({ vez: 2, vencedor: 1, situacao: 'encerrada' })
      expect(host.salas.ler(codigo)).toMatchObject({ situacao: 'encerrada', vencedor: 1 })
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.youWin)
      expect(eventos('game_over')).toEqual([['game_over', { mode: 'online' }]])
    })

    it('o outro encerrar a sala no meio da partida mostra "O oponente saiu"', async () => {
      await comConta()
      const codigo = await criarSala()
      host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' })
      await nextTick()
      host.disparar('sala', { acao: 'encerrar', codigo })
      await nextTick()
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.oppLeft)
    })

    it('quem entra pelo código joga de escuras, e os lances vão e voltam', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana' })
      salaDaBia(h)
      await montarCom(h)
      await entrarPeloCodigo('abc23')
      await esperar(() => expect($('.ros-checkers__pcard--top')).not.toBeNull())
      expect(chamadas('sala', 'entrar')).toEqual([['ABC23']])
      expect(host.salas.ler('ABC23')).toMatchObject({
        convidado: 'ana',
        nomeDoConvidado: 'Ana',
        situacao: 'jogando',
      })
      expect(eventos('game_start')).toEqual([['game_start', { mode: 'online-guest' }]])
      // O convidado sai da tela do código e vê o tabuleiro, com a Bia em cima,
      // e a vez é dela (claras).
      expect($('.ros-checkers__wait')).toBeNull()
      expect(nomes()).toEqual(['Bia', 'Ana'])
      expect($('.ros-checkers__pcard--top').classList.contains('is-active')).toBe(true)
      expect(texto('.ros-checkers__net-toast')).toBeNull()

      // A Bia (claras) abre.
      const abertura = serialize(
        partida([
          [5, 0],
          [4, 1],
        ]),
      )
      h.disparar('sala', { acao: 'jogar', codigo: 'ABC23', estado: abertura, vez: 2 })
      await nextTick()
      expect(window.__checkers.state.board[4][1]).toBe(1)
      expect(window.__checkers.state.turn).toBe(2)

      // Eu (escuras) respondo pelo toque.
      jogarPeloToque([2, 1], [3, 2])
      expect(window.__checkers.state.board[3][2]).toBe(-1)
      expect(chamadas('sala', 'jogar')).toEqual([
        [
          'ABC23',
          {
            estado: serialize(
              partida(
                [
                  [5, 0],
                  [4, 1],
                ],
                [
                  [2, 1],
                  [3, 2],
                ],
              ),
            ),
            vez: 1,
            vencedor: null,
            situacao: 'jogando',
          },
        ],
      ])
    })

    it('quem entra pelo código perde quando a Bia come a última pedra dele', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana' })
      salaDaBia(h)
      await montarCom(h)
      await entrarPeloCodigo('ABC23')
      await esperar(() => expect($('.ros-checkers__pcard--top')).not.toBeNull())
      // O tabuleiro da Bia depois de comer a última pedra escura: só claras.
      const fim = `${'.'.repeat(20)}w${'.'.repeat(43)}|2`
      h.disparar('sala', {
        acao: 'jogar',
        codigo: 'ABC23',
        estado: fim,
        vez: 2,
        vencedor: 1,
        situacao: 'encerrada',
      })
      await nextTick()
      expect(texto('.ros-checkers__over-title')).toBe(ptBR.youLose)
      expect(eventos('game_over')).toEqual([['game_over', { mode: 'online' }]])
    })

    it('o anfitrião sair não muda nada para quem entrou, como antes', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana' })
      salaDaBia(h)
      await montarCom(h)
      await entrarPeloCodigo('ABC23')
      await esperar(() => expect($('.ros-checkers__pcard--top')).not.toBeNull())
      h.disparar('sala', { acao: 'anfitriaoSaiu', codigo: 'ABC23' })
      await nextTick()
      expect(host.salas.ler('ABC23').anfitriaoSaiu).toBe(true)
      expect($('.ros-checkers__over')).toBeNull()
      // A sala sumir também não derruba a partida.
      h.disparar('sala', { acao: 'sumir', codigo: 'ABC23' })
      await nextTick()
      expect($('.ros-checkers__over')).toBeNull()
      expect($('.ros-checkers__pcard--top')).not.toBeNull()
    })

    it('sala cheia, código que não existe e sala própria dão os textos de antes', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana' })
      salaDaBia(h, 'CHE22')
      h.disparar('sala', { acao: 'entrar', codigo: 'CHE22', uid: 'caio', nome: 'Caio' })
      h.disparar('sala', { acao: 'criar', codigo: 'MIN23', uid: 'ana', nome: 'Ana' })
      await montarCom(h)
      await entrarPeloCodigo('CHE22')
      await esperar(() => expect(texto('.ros-checkers__err')).toBe(ptBR.roomFull))
      await entrarPeloCodigo('ZZZ99')
      await esperar(() => expect(texto('.ros-checkers__err')).toBe(ptBR.codeNotFound))
      await entrarPeloCodigo('MIN23')
      await esperar(() => expect(texto('.ros-checkers__err')).toBe(ptBR.joinFailed))
      expect($('.ros-checkers__code-input')).not.toBeNull()
      expect(eventos('game_start')).toHaveLength(0)
    })

    it('sem conta, entrar avisa como antes e fica na tela do código', async () => {
      const h = novoHost()
      salaDaBia(h)
      await montarCom(h)
      await entrarPeloCodigo('ABC23')
      await esperar(() => expect(avisos()).toEqual([[ptBR.needAccount, { tipo: 'aviso' }]]))
      expect($('.ros-checkers__code-input')).not.toBeNull()
      expect($('.ros-checkers__err')).toBeNull()
      expect(host.salas.ler('ABC23').convidado).toBeNull()
    })

    it('Enter no campo do código entra, e o botão só acende com os cinco caracteres', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana' })
      salaDaBia(h)
      await montarCom(h)
      $$('.ros-checkers__mbtn')[3].click()
      await nextTick()
      const campo = $('.ros-checkers__code-input')
      const entrar = $('.ros-checkers__wait .ros-checkers__solid-btn')
      campo.value = 'ABC2'
      campo.dispatchEvent(new Event('input'))
      await nextTick()
      expect(entrar.disabled).toBe(true)
      campo.value = 'ABC23'
      campo.dispatchEvent(new Event('input'))
      await nextTick()
      expect(entrar.disabled).toBe(false)
      campo.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
      await esperar(() => expect(chamadas('sala', 'entrar')).toEqual([['ABC23']]))
    })

    // A janela aberta pelo link ou pelo QR (no RoqueOS, `/app?joinMatch=checkers:<código>`).
    it('o convite com que a janela abriu já entra na sala, sem tocar em nada', async () => {
      const h = novoHost({ uid: 'ana', nome: 'Ana', convite: 'abc23' })
      salaDaBia(h)
      await montarCom(h)
      expect($('.ros-checkers__code-input').value).toBe('ABC23')
      await esperar(() => expect(chamadas('sala', 'entrar')).toEqual([['ABC23']]))
      await esperar(() => expect($('.ros-checkers__pcard--top')).not.toBeNull())
      expect(nomes()).toEqual(['Bia', 'Ana'])
    })

    it('sem convite, a janela abre no menu', async () => {
      await comConta()
      expect(host.contar('sala', 'conviteRecebido')).toBe(1)
      expect($('.ros-checkers__menu')).not.toBeNull()
      await new Promise((r) => setTimeout(r, 350))
      expect(chamadas('sala', 'entrar')).toHaveLength(0)
    })
  })

  describe('o tabuleiro 3D e o fim da janela', () => {
    beforeEach(() => {
      THREE.criados.length = 0
    })
    const discos = () => THREE.criados.filter((g) => g instanceof THREE.LatheGeometry)

    // O modo leve é a única coisa do código de GPU que muda de origem na
    // extração: vinha do composable do RoqueOS e agora vem do host.
    it('o perfil leve do host chega no three: sem antialias, sem sombra, pixel ratio até 1,25 e disco de 24 gomos', async () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
      await montar({ modoLeve: true })
      expect($('.ros-checkers').classList.contains('ros-checkers--low')).toBe(true)
      const r = renderizador()
      expect(r.opcoes).toEqual({
        canvas: $('.ros-checkers__canvas'),
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      })
      expect(r.pixelRatio).toBe(1.25)
      expect(r.shadowMap.enabled).toBe(false)
      expect(discos().map((g) => g.args[1])).toEqual([24])
    })

    it('sem perfil leve o three nasce com antialias, sombra, pixel ratio até 2 e disco de 48 gomos', async () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
      await montar({ modoLeve: false })
      expect($('.ros-checkers').classList.contains('ros-checkers--low')).toBe(false)
      const r = renderizador()
      expect(r.opcoes).toMatchObject({ antialias: true, alpha: true })
      expect(r.pixelRatio).toBe(2)
      expect(r.shadowMap).toEqual({ enabled: true, type: THREE.PCFSoftShadowMap })
      expect(discos().map((g) => g.args[1])).toEqual([48])
    })

    it('o tabuleiro desenha no requestAnimationFrame e para de vez ao desmontar', async () => {
      await montar()
      const r = renderizador()
      const antes = r.quadros
      rodar(3)
      expect(r.quadros).toBe(antes + 3)
      montagem.desmontar()
      rodar(3)
      expect(r.quadros).toBe(antes + 3)
    })

    // Do front: 'cleans up the E2E hook on unmount'.
    it('desmontar solta o gancho, o contexto WebGL, as texturas e geometrias, a IA pendente e a tela', async () => {
      await montar()
      vi.useFakeTimers()
      window.__checkers.startAI('easy')
      const st = window.__checkers.state
      window.__checkers.move([5, 0], [4, 1])
      const r = renderizador()
      const texturas = THREE.criados.filter((t) => t instanceof THREE.CanvasTexture)
      const doJogo = THREE.criados.filter(
        (g) => g instanceof THREE.LatheGeometry || g instanceof THREE.TorusGeometry,
      )
      expect(window.__checkers).toBeTruthy()
      montagem.desmontar()
      expect(window.__checkers).toBeUndefined()
      expect(r.descartado).toBe(true)
      expect(texturas).toHaveLength(2)
      expect(texturas.every((t) => t.descartado)).toBe(true)
      expect(doJogo).toHaveLength(2)
      expect(doJogo.every((g) => g.descartado)).toBe(true)
      expect(el.querySelector('.ros-checkers')).toBeNull()
      expect(el.querySelector('canvas')).toBeNull()
      // A resposta da IA que estava no relógio não chega a jogar.
      vi.advanceTimersByTime(1000)
      expect(st.moves).toBe(1)
      // Desmontar de novo acontece de verdade (a janela fecha e o componente em
      // volta desmonta depois) e não pode lançar.
      expect(() => montagem.desmontar()).not.toThrow()
    })

    it('desmontar no meio da partida online para de observar a sala', async () => {
      await comConta()
      $('.ros-checkers__mbtn--online').click()
      await esperar(() => expect($('.ros-checkers__code')).not.toBeNull())
      const codigo = texto('.ros-checkers__code')
      expect(host.salas.observadas()).toEqual([codigo])
      montagem.desmontar()
      expect(host.salas.observadas()).toEqual([])
      expect(() =>
        host.disparar('sala', { acao: 'entrar', codigo, uid: 'bia', nome: 'Bia' }),
      ).not.toThrow()
    })

    it('desmontar antes de o texto chegar não monta nada depois', async () => {
      host = novoHost()
      montagem = jogo.mount(palco(), host, { ativo: true })
      montagem.desmontar()
      await new Promise((r) => setTimeout(r, 50))
      expect(el.querySelector('.ros-checkers')).toBeNull()
    })
  })
})
