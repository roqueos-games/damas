# Origem dos assets

Todo arquivo em `public/` tem uma linha aqui, com a licença e a origem. O `jogo check`
reprova arquivo sem linha e licença fora da lista do SDK.

| caminho          | licença | origem                                                                                                                                           |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| public/capa.jpg  | MIT     | autoral: capa ilustrada gerada pelo kit de arte do RoqueOS (`scripts/gameart`), última mudança no commit `4142f768` do roqueos-front, 20/08/2026 |
| public/icone.svg | MIT     | autoral: ícone gerado pelo kit de arte do RoqueOS, última mudança no commit `4142f768` do roqueos-front, 20/08/2026                              |

O som do jogo é procedural (`src/som.js`), os ícones dos botões são SVG desenhado em
`src/Icone.vue`, e o tabuleiro 3D, as peças e as figurinhas dos cartões são geometria e
pintura de canvas feitas no código (`src/tabuleiro3d.js`, `src/arteDoTabuleiro.js`): nenhum
deles é arquivo de terceiro.
