// EXPORTAÇÃO PARA EXCEL (etapa 3 do plano).
// Especificação: privado/docs/ESPECIFICACAO.md, seção 12. Layout detalhado: privado/docs/LAYOUT_EXCEL.md (a criar na etapa 3).
//
// A FAZER
//   - gerar UM arquivo com uma aba por trecho, usando lib/exceljs.min.js (variável global `ExcelJS`)
//   - cada aba é a visão "Todos" do trecho no layout do Modelo Novo
//   - só entram atividades visíveis e com lançamento
//   - QUANT. FALTA e % EXEC. saem como fórmulas; os demais valores, como texto ou número
//   - antes de gerar, conferir o encarregado obrigatório em todos os trechos; se faltar, não gerar
//   - nome: <código do formulário> - RPSQ - DD-MM-AAAA REVnn.xlsx (o código vem da configuração, não do código-fonte)
//   - os textos do cabeçalho (contratante, contratada, contrato, nome da linha) também vêm dos dados
//
// Para testar sem baixar arquivo: gere o conteúdo, converta para base64 e escreva num elemento da
// página de teste; um script Python lê, salva e confere com openpyxl.
var Exportacao = {};
