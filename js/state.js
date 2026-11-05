// Estado compartido entre vistas durante la sesión.
export const state = {
  selection: new Set(),   // ids seleccionados en la biblioteca
  deckFilter: '',         // id del mazo abierto en la biblioteca ('' = todos)
  search: '',
  printSource: '',        // 'selection' | 'deck:<id>' | 'all' al ir a imprimir
};
