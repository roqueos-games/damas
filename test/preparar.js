// O jsdom não tem ResizeObserver, e as Damas o usam para o tabuleiro 3D refazer o
// enquadramento quando a janela muda de tamanho. No navegador o jogo recebe o
// observador de verdade; aqui basta um que não faz nada, porque os testes não
// dependem do tamanho da tela.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
