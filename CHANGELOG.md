# Changelog

## 0.1.0 (25/09/2026)

- As Damas saem do repositório do RoqueOS e passam a falar com ele só pelo `jogo-sdk` 0.2.0.
  Motor, IA, tabuleiro 3D, arte das peças, som, visual, nomes e dados de evento
  (`game_start`, `game_over`) e o gancho `window.__checkers` ficam como eram. O código que toca
  a GPU (`src/tabuleiro3d.js`, cópia do `board3d.js` do RoqueOS) veio sem mudança.
- A partida online passa pela capacidade `sala` do SDK, e não mais pelo Firebase direto. O
  que atravessa a sala é o mesmo de antes (o tabuleiro do `serialize`, a vez como 1 ou 2,
  'host' na abertura). O link do QR e do "copiar" é o que o host devolve ao criar a sala, e o
  convite pelo link (`joinMatch`) chega pelo `sala.conviteRecebido()` ao montar.
- Quem entra numa sala pelo código ou pelo link agora vai para o tabuleiro e joga. Antes o
  convidado ficava parado na tela do código e não conseguia jogar lance nenhum.
- Para quem cria a sala, o próprio nome fica no cartão de baixo e o do outro no de cima. Antes
  os dois saíam trocados.
- A partida online começa zerada, como a local e a da IA: sem herdar da partida anterior o
  cartão aceso, a última jogada destacada nem o aviso de captura obrigatória.
- `three` e `qrcode` viram `peerDependencies`: o RoqueOS fornece os dele, nas mesmas versões
  de antes.
- Texto nos dez idiomas em `i18n/`, ícones SVG próprios (o `qr` e os três pontos de "pensando"
  desenhados novos), e o jogo roda sozinho com `yarn dev`, com a partida online entre duas abas.
- O perfil leve do aparelho chega pelo host e liga a classe `ros-checkers--low`.
