# Damas

Jogo da organização roqueos-games, montado pelo RoqueOS através do `jogo-sdk`. Leia o
README antes de mudar qualquer coisa.

- Gate: `yarn verificar` (o mesmo do CI e do pre-push).
- O jogo só importa `vue`, `three` e `qrcode` (peers: o RoqueOS fornece os dele),
  `@roqueos-games/jogo-sdk` e arquivo deste repo. O RoqueOS confere isso e reprova o pin se
  aparecer outra coisa.
- Não troque a versão do `three`: a de `devDependencies` é a que o RoqueOS instala.
- Código que toca a GPU (`src/tabuleiro3d.js` inteiro: renderer, sombra, pixel ratio,
  materiais, texturas, geometria, perfil leve) só muda com evidência num iPhone de verdade. O
  teste usa um dublê do three e não vê a GPU.
- O que atravessa a sala online (o `serialize` do motor, a vez como 1 ou 2, 'host' na
  abertura) não muda: a outra ponta pode ser um RoqueOS antigo ainda aberto.
- JSON do jogo entra com `?raw` e `JSON.parse`: o build do RoqueOS quebra com import de JSON
  direto.
- Nomes e dados de evento não mudam. As Damas não guardam nada no armazenamento nem no
  placar; chave nova ali é decisão, não detalhe.
- Toda correção vem com teste que reprova sem ela.
- Português do Brasil no código e nos commits.
