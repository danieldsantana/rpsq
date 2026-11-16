// REGRAS DA CÉLULA (etapa 1 do plano). Funções puras: não tocam na tela nem no banco.
// Especificação: privado/docs/ESPECIFICACAO.md, seção 4.
//
// A FAZER: portar do protótipo (privado/referencia/previa.html) as funções parse, runs, fmtTowers,
// rowTotal e vaoKm, com estes ajustes:
//   - o código de torre aceita letra no fim: \d+/\d+[A-Za-z]?   (existem torres como 7/1A)
//   - nada de variáveis globais do trecho: tudo passa por um objeto criado por Regras.criar
//   - união de torres entre canteiros, para o total do consolidado
//
// Forma sugerida:
//   var r = Regras.criar(trecho.torres);      // torres: [[codigo, familia, tipo, vaoM], ...]
//   r.existe('48/2')                          -> true/false
//   r.lerTorre(' 48 / 2 ')                    -> '48/2', ou null se não for um código de torre
//   r.intervalo('5/1', '6/2', 'TORRE')        -> ['5/1','5/2','6/1','6/2']   (inclui as pontas)
//   r.intervalo('5/1', '6/2', 'KM')           -> ['5/1','5/2','6/1']         (vãos; o de 6/2 não entra)
//   r.ordenar(codigos)                        -> códigos na ordem do trecho, sem repetição
//   r.formatar(codigos, unidade)              -> '5/1 a 6/2, 10/1, 13/1 a 15/2'
//   r.ler(texto, unidade)                     -> { codigos: [...], invalidas: [...], resto: '...' }
//   r.total(listasDeCodigos, unidade)         -> nº de torres diferentes, ou km (soma dos vãos diferentes)
//
// A lista de códigos é o que se guarda no banco (rpsq_celulas.torres). Em KM, cada código é a torre
// onde o vão começa.
var Regras = {};
