// O som das Damas, procedural: nenhum arquivo de áudio, só osciladores. O
// AudioContext é do host (no RoqueOS, o compartilhado com os apps de música;
// fora dele, um próprio), e o jogo só toca quando o contexto já está rodando,
// porque tocar num contexto suspenso enfileira som que sai tudo junto depois.
//
// Frequências, formas de onda, envelopes, volume e os intervalos entre as
// notas são os mesmos do componente de antes da extração, em 25/09/2026: o
// jogo tem de soar igual. As Damas não têm botão de mudo, e continuam sem.

/**
 * @param {{ contexto: () => AudioContext | null }} audio a capacidade `audio` do host
 * @param {(fn: () => void, ms: number) => unknown} depois agenda uma nota; é o
 *   relógio do componente, que desmontar limpa, para nenhuma nota de uma
 *   sequência tocar com o jogo já fechado
 */
export function criarSom(audio, depois) {
  let volume = null
  let dono = null

  const contexto = () => {
    try {
      const c = audio.contexto()
      if (!c || c.state !== 'running') return null
      // O ganho mestre pertence a UM contexto. Se o host trocar de contexto
      // (o iOS fecha o antigo ao voltar do fundo), recria em vez de ligar num
      // nó morto.
      if (dono !== c) {
        volume = c.createGain()
        volume.gain.value = 0.4
        volume.connect(c.destination)
        dono = c
      }
      return c
    } catch {
      return null
    }
  }

  const bip = (freq, tipo = 'sine', pico = 0.1, duracao = 0.1) => {
    const c = contexto()
    if (!c) return
    const agora = c.currentTime
    const o = c.createOscillator()
    o.type = tipo
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, agora)
    g.gain.exponentialRampToValueAtTime(pico, agora + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, agora + duracao)
    g.connect(volume)
    o.connect(g)
    o.start(agora)
    o.stop(agora + duracao + 0.02)
  }

  return {
    /** Um passo simples, sem captura; também o lance do adversário online. */
    mover: () => bip(340, 'sine', 0.12, 0.09),
    /** Uma nota por peça capturada, cada uma mais grave. */
    capturar(n) {
      for (let i = 0; i < n; i++) depois(() => bip(260 - i * 20, 'triangle', 0.14, 0.12), i * 110)
    },
    /** A pedra que vira dama. */
    coroar() {
      bip(660, 'triangle', 0.12, 0.15)
      depois(() => bip(880, 'triangle', 0.12, 0.2), 90)
    },
    /** Fim de partida: arpejo subindo para quem venceu, descendo para quem perdeu. */
    fim(venceu) {
      const notas = venceu ? [60, 64, 67, 72] : [64, 60, 55]
      notas.forEach((m, i) =>
        depois(() => bip(440 * Math.pow(2, (m - 69) / 12), 'triangle', 0.14, 0.3), i * 110),
      )
    },
  }
}
