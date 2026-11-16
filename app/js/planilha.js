// A FOLHA (etapa 2 do plano): desenha a planilha e cuida da seleção.
// Especificação: privado/docs/ESPECIFICACAO.md, seções 3, 8, 9 e 10.
//
// A FAZER: portar do protótipo (privado/referencia/previa.html)
//   - cabecalho, thead, tr, abreTabela, colControle, porTopico
//   - folhaCanteiro (visão editável de um canteiro) e folhaTodos (consolidado, só leitura)
//   - linhasDe e conflitos (mesma torre em dois canteiros)
//   - observacoes (lista no fim da folha, com "remover")
//   - seleção: selTd, aplicaSel, seleciona, move
//   - larguras e alturas: larg, largPadrao, autoLargura e os eventos de arrastar (pointerdown/move/up)
//   - renderTabs (abas dos trechos e legenda)
//
// Diferenças em relação ao protótipo:
//   - o total da linha em negrito do consolidado usa a UNIÃO das torres dos canteiros (Regras), não a soma
//   - as abas de trecho funcionam para quantos trechos a base tiver
//   - o cabeçalho da folha é montado a partir da configuração, sem texto fixo no código
//   - os dados vêm da camada de dados, não de uma variável S guardada no navegador
//   - larguras e alturas continuam guardadas no navegador de cada pessoa (localStorage), por trecho
//   - quando chega uma mudança de outra pessoa, atualize só as células afetadas, sem perder a seleção
//     nem a posição da rolagem
var Planilha = {};
