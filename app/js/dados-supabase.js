// CAMADA DE DADOS DO SUPABASE (etapa 5 do plano).
// Oferece exatamente as mesmas funções de dados-memoria.js; leia o contrato lá.
// Tabelas, regras de acesso e tempo real: privado/docs/BANCO.md.
//
// Lembretes:
//   - usa a biblioteca lib/supabase.js (variável global `supabase`) com RPSQ_CONFIG.supabaseUrl e supabaseChave
//   - só as tabelas com prefixo rpsq_; nunca toque em outras tabelas que existam no projeto
//   - ter login no projeto não basta: depois de entrar, confira se a pessoa está em rpsq_usuarios e ativa
//   - os nomes das colunas no banco são com sublinhado (canteiro_id); o app usa canteiroId. A conversão fica aqui
//   - em assinar(), ignore as mudanças feitas pela própria pessoa
var DadosSupabase = {};
