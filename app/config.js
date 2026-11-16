// Configuração do RPSQ. É o único arquivo que muda entre teste e produção.
var RPSQ_CONFIG = {
  // 'memoria'  : dados de exemplo dentro do navegador (testes e demonstração)
  // 'supabase' : banco real
  dados: 'memoria',

  // URL do projeto no Supabase (Project Settings > API).
  supabaseUrl: 'https://ilpijnuxkkyoyzccylzj.supabase.co',
  // Chave PÚBLICA (anon / publishable). Pode ficar neste arquivo: quem protege os dados
  // são as regras de acesso do banco. A chave service_role NUNCA entra aqui.
  supabaseChave: 'sb_publishable__X0os9OU9nNEj9-xnX2-Cg_vLme29V4'
};
