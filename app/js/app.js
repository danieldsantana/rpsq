// INICIALIZAÇÃO (etapas 2 e 5 do plano): liga as partes.
//
// A FAZER
//   - escolher a camada de dados conforme RPSQ_CONFIG.dados
//   - tela de entrada (e-mail e senha) e saída; mensagem clara para quem não está na lista do RPSQ
//   - estado da tela: semana, trecho, canteiro, célula selecionada
//   - carregar a base e a semana, desenhar, assinar as mudanças
//   - eventos gerais: teclado (setas, Tab, Enter, F2, Delete), troca de canteiro, de trecho e de semana
//   - aviso de falta de conexão, com bloqueio da edição
//   - papéis: 'consulta' não edita; os botões de administrador só aparecem para 'admin'
//   - botões de administrador: abrir semana nova, revisão, usuários, cópia de segurança
//
// Do protótipo, portar: render, redesenha, faixa (caixa de nome e barra de fórmulas), toast e os
// ouvintes de evento do fim do script.
var App = {};
var Dados = RPSQ_CONFIG.dados === 'supabase' ? DadosSupabase : DadosMemoria;
