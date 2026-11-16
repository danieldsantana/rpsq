// CAMADA DE DADOS EM MEMÓRIA (etapa 2 do plano). Usada nos testes e na demonstração, sem banco.
//
// ESTE ARQUIVO DEFINE O CONTRATO. dados-supabase.js tem de oferecer exatamente as mesmas funções,
// com os mesmos nomes, parâmetros e formatos. O resto do app só conversa com a variável `Dados`
// (escolhida em app.js conforme RPSQ_CONFIG.dados) e não sabe qual das duas está em uso.
// É isso que permite trocar de banco no futuro mexendo em um arquivo só.
//
// Todas as funções devolvem Promise, mesmo aqui, para o app ser escrito do mesmo jeito nos dois casos.
//
// --- Sessão ---
//   entrar(email, senha)        -> { id, nome, papel }       papel: 'admin' | 'edita' | 'consulta'
//                                  rejeita com mensagem clara se a senha estiver errada ou se a pessoa
//                                  não estiver na lista de usuários do RPSQ
//   sair()
//   usuarioAtual()              -> { id, nome, papel } ou null
//
// --- Dados de base (mudam raramente) ---
//   carregarBase()              -> { config: { contratante, contratada, contrato, codigoFormulario },
//                                    trechos: [ { id, sigla, nomeLt,
//                                      canteiros:  [ { id, nome } ],
//                                      torres:     [ [codigo, familia, tipo, vaoM] ],
//                                      atividades: [ { id, codigo, nome, unidade, topico, nomeTopico, avulsa } ] } ] }
//   criarAvulsa(trechoId, topico, nome, unidade)  -> a atividade criada (código = próximo livre do tópico)
//
// --- Semana ---
//   listarSemanas()             -> [ { inicio: '2026-11-16', revisao: 0, elaboradoPor: '' } ]  mais recente primeiro
//   carregarSemana(inicio)      -> { celulas:  [ { canteiroId, atividadeId, tipo, dia, torres: [], comentario, aConfirmar } ],
//                                    linhas:   [ { canteiroId, atividadeId, tipo, encarregado } ],
//                                    planilha: [ { canteiroId, atividadeId, visivel } ],
//                                    controle: [ { atividadeId, previsto, acumulado } ] }
//                                  tipo: 'E' | 'P1' | 'P2'      dia: 0 (segunda) a 6 (domingo)
//   gravarSemana(inicio, { revisao, elaboradoPor })             só admin
//   abrirSemana(novoInicio)                                     só admin; regras na especificação, seção 11
//
// --- Lançamentos (cada chamada grava na hora) ---
//   gravarCelula(semana, canteiroId, atividadeId, tipo, dia, { torres, comentario, aConfirmar })
//   gravarEncarregado(semana, canteiroId, atividadeId, tipo, nome)
//   gravarVisibilidade(semana, canteiroId, atividadeId, visivel)
//   gravarControle(semana, atividadeId, { previsto, acumulado })
//
// --- Tempo real e conexão ---
//   assinar(semana, aoMudar)    -> função que cancela a assinatura
//                                  aoMudar({ tabela: 'celulas'|'linhas'|'planilha'|'controle'|'atividades'|'semanas', registro })
//                                  é chamada para mudanças feitas por OUTRAS pessoas
//   aoMudarConexao(fn)          -> fn(true|false)
//
// --- Administração ---
//   listarUsuarios()            -> [ { id, email, nome, papel, ativo } ]
//   gravarUsuario({ id, nome, papel, ativo })
//   copiaDeSeguranca()          -> objeto com todas as tabelas, para baixar como JSON
//
// Aqui, os dados de base vêm da variável RPSQ_BASE: nos testes públicos, testes/base-exemplo.js (fictício).
// A semana de exemplo é montada com as torres fictícias e nomes inventados ("ENCARREGADO A").
// REPOSITÓRIO PÚBLICO: nenhum dado real de obra neste arquivo.
// Para testar a edição simultânea sem banco, ofereça uma função extra só de teste que simula a
// alteração feita por outra pessoa.
var DadosMemoria = {};
