// PAINEL LATERAL (etapa 2 do plano): é por ele que a célula é preenchida.
// Especificação: privado/docs/ESPECIFICACAO.md, seções 5, 6 e 7.
//
// A FAZER: portar do protótipo (privado/referencia/previa.html)
//   - painel (desenho), torreDe, setCel, salvaCom, salvaPainel, focoPainel, erroPainel
//   - as ações de clique: adicionar torre, adicionar intervalo, remover pelo ×, limpar célula,
//     salvar e remover comentário, salvar encarregado, confirmar executado
//   - painelAdd (Adicionar atividade em cascata: Grupo > Tópico > Atividade, com opção de avulsa)
//
// Regra importante, já acertada no protótipo: o que estiver digitado no painel (comentário ou encarregado)
// é salvo ANTES de qualquer outra ação (trocar de célula, clicar em outro botão, trocar de canteiro).
// Não use o evento "change" dos campos para salvar: ele redesenha a tela no meio de um clique e o clique se perde.
var Painel = {};
