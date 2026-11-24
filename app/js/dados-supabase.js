// CAMADA DE DADOS DO SUPABASE (etapa 5 do plano).
// Oferece exatamente as mesmas funções de dados-memoria.js; o contrato está descrito lá.
// Tabelas, regras de acesso e funções do banco: banco/001_estrutura.sql.
//
// - Usa a biblioteca lib/supabase.js (variável global `supabase`) com RPSQ_CONFIG.supabaseUrl e supabaseChave.
// - Só toca nas tabelas e funções com prefixo rpsq_. O projeto do Supabase tem outras, de outro app.
// - Ter login no projeto não basta: depois de entrar, confere se a pessoa está em rpsq_usuarios e ativa.
// - O banco usa nomes com sublinhado (canteiro_id); o app usa canteiroId. A conversão fica toda aqui.
// - O Supabase devolve no máximo 1000 linhas por consulta; as leituras grandes são feitas em páginas.
// - Quem protege os dados são as regras de acesso do banco. As conferências daqui são só para dar
//   mensagens claras.
var DadosSupabase = (function () {
  var sb = null, meuId = null;
  // Duas coisas diferentes:
  //   rede     -> há conexão com o banco? Sem ela, o app bloqueia a edição.
  //   tempoReal-> o canal de atualização ao vivo (WebSocket) está ligado? Algumas redes de empresa o
  //               bloqueiam mesmo com a internet funcionando; aí o app continua editável e busca as
  //               mudanças dos colegas de tempos em tempos.
  var conexao = { rede: navigator.onLine !== false, tempoReal: true }, ouvintesConexao = [], ouvintesTempoReal = [], sonda = null;

  function cliente() {
    if (!sb) sb = supabase.createClient(RPSQ_CONFIG.supabaseUrl, RPSQ_CONFIG.supabaseChave);
    return sb;
  }

  // ---------- erros com mensagem clara ----------
  function traduz(e) {
    var msg = (e && e.message) || String(e);
    if (/invalid login credentials/i.test(msg)) return new Error('E-mail ou senha incorretos.');
    if (/email not confirmed/i.test(msg)) return new Error('O e-mail deste login ainda não foi confirmado.');
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      redeCaiu();
      return new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    }
    // gravação barrada pela regra de acesso
    if (/row-level security/i.test(msg)) {
      return new Error('Sem permissão para esta alteração. Só a semana mais recente pode ser alterada, e só por quem tem acesso de edição.');
    }
    // sem login válido (sessão expirada) ou sem acesso à tabela
    if ((e && e.code === '42501') || /permission denied/i.test(msg)) {
      return new Error('Sem acesso aos dados do RPSQ. Saia e entre de novo; se continuar, fale com o administrador.');
    }
    return new Error(msg);
  }
  function dados(r) { if (r.error) throw traduz(r.error); return r.data; }
  function lerTudo(montar) {
    var tam = 1000, saida = [];
    function pagina(i) {
      return montar().range(i, i + tam - 1).then(function (r) {
        var d = dados(r);
        saida = saida.concat(d);
        return d.length < tam ? saida : pagina(i + tam);
      });
    }
    return pagina(0);
  }

  // ---------- conversões banco -> app ----------
  function celula(x) {
    return { semana: x.semana, canteiroId: x.canteiro_id, atividadeId: x.atividade_id, tipo: x.tipo, dia: x.dia,
             torres: x.torres || [], comentario: x.comentario || '', aConfirmar: !!x.a_confirmar };
  }
  function linha(x) { return { semana: x.semana, canteiroId: x.canteiro_id, atividadeId: x.atividade_id, tipo: x.tipo, encarregado: x.encarregado || '' }; }
  function planilha(x) { return { semana: x.semana, canteiroId: x.canteiro_id, atividadeId: x.atividade_id, visivel: !!x.visivel }; }
  function controle(x) {
    return { semana: x.semana, atividadeId: x.atividade_id,
             previsto: x.previsto == null ? null : Number(x.previsto), acumulado: x.acumulado == null ? null : Number(x.acumulado) };
  }
  function atividade(x) {
    return { id: x.id, trechoId: x.trecho_id, codigo: x.codigo, nome: x.nome, unidade: x.unidade, topico: x.topico,
             nomeTopico: x.nome_topico, avulsa: !!x.avulsa, ativa: x.ativa !== false,
             partes: x.partes || null, texto: !!x.texto }; // partes: script 006; texto: script 011 (antes, null/false)
  }
  function semana(x) { return { inicio: x.inicio, revisao: x.revisao || 0, elaboradoPor: x.elaborado_por || '' }; }
  function semCampoSemana(x) { delete x.semana; return x; }

  // ---------- sessão ----------
  // procura a pessoa logada na lista do RPSQ; null se não está ou está inativa
  function papelDe(userId) {
    return cliente().from('rpsq_usuarios').select('user_id, nome, papel, ativo').eq('user_id', userId).maybeSingle().then(function (r) {
      var u = dados(r);
      return u && u.ativo ? { id: u.user_id, nome: u.nome, papel: u.papel } : null;
    });
  }
  function entrar(email, senha) {
    return cliente().auth.signInWithPassword({ email: String(email || '').trim(), password: senha || '' }).then(function (r) {
      var d = dados(r);
      return papelDe(d.user.id);
    }).then(function (u) {
      if (!u) {
        return cliente().auth.signOut().then(function () {
          throw new Error('Seu login existe, mas você não está na lista de usuários do RPSQ (ou está inativo). Peça ao administrador para incluir você.');
        });
      }
      meuId = u.id;
      return u;
    });
  }
  function usuarioAtual() {
    return cliente().auth.getSession().then(function (r) {
      var s = dados(r).session;
      if (!s) return null;
      return papelDe(s.user.id).then(function (u) { meuId = u ? u.id : null; return u; });
    });
  }
  function sair() { meuId = null; return cliente().auth.signOut().then(function () {}); }

  // ---------- base ----------
  function carregarBase() {
    var c = cliente();
    return Promise.all([
      c.from('rpsq_config').select('chave, valor').then(dados),
      c.from('rpsq_trechos').select('id, sigla, nome_lt, ordem').order('ordem').then(dados),
      c.from('rpsq_canteiros').select('id, trecho_id, nome, ordem').order('trecho_id').order('ordem').then(dados),
      lerTudo(function () { return c.from('rpsq_torres').select('trecho_id, ordem, codigo, familia, tipo, vao_m').order('trecho_id').order('ordem'); }),
      lerTudo(function () { return c.from('rpsq_atividades').select('*').order('id'); })
    ]).then(function (r) {
      var cfg = {};
      r[0].forEach(function (x) { cfg[x.chave] = x.valor; });
      return {
        config: { contratante: cfg.contratante || '', contratada: cfg.contratada || '', contrato: cfg.contrato || '',
                  codigoFormulario: cfg.codigo_formulario || '', identificacaoFormulario: cfg.identificacao_formulario || '',
                  logoContratada: cfg.logo_contratada || '', logoContratante: cfg.logo_contratante || '' },
        trechos: r[1].map(function (t) {
          return {
            id: t.id, sigla: t.sigla, nomeLt: t.nome_lt,
            canteiros: r[2].filter(function (x) { return x.trecho_id === t.id; }).map(function (x) { return { id: x.id, nome: x.nome }; }),
            torres: r[3].filter(function (x) { return x.trecho_id === t.id; }).map(function (x) { return [x.codigo, x.familia, x.tipo, Number(x.vao_m)]; }),
            atividades: r[4].filter(function (x) { return x.trecho_id === t.id; }).map(atividade)
          };
        })
      };
    });
  }
  function criarAvulsa(trechoId, topico, nome, unidade) {
    return cliente().rpc('rpsq_criar_avulsa', { p_trecho: trechoId, p_topico: topico, p_nome: nome, p_unidade: unidade })
      .then(dados).then(function (x) { return atividade(Array.isArray(x) ? x[0] : x); });
  }

  // ---------- semana ----------
  function listarSemanas() {
    return cliente().from('rpsq_semanas').select('inicio, revisao, elaborado_por').order('inicio', { ascending: false })
      .then(dados).then(function (l) { return l.map(semana); });
  }
  function carregarSemana(inicio) {
    var c = cliente();
    function da(tabela, campos, ordem) {
      return lerTudo(function () {
        var q = c.from(tabela).select(campos).eq('semana', inicio);
        ordem.forEach(function (o) { q = q.order(o); });
        return q;
      });
    }
    return Promise.all([
      da('rpsq_celulas', 'semana, canteiro_id, atividade_id, tipo, dia, torres, comentario, a_confirmar', ['canteiro_id', 'atividade_id', 'tipo', 'dia']),
      da('rpsq_linhas', 'semana, canteiro_id, atividade_id, tipo, encarregado', ['canteiro_id', 'atividade_id', 'tipo']),
      da('rpsq_planilha', 'semana, canteiro_id, atividade_id, visivel', ['canteiro_id', 'atividade_id']),
      da('rpsq_controle', 'semana, atividade_id, previsto, acumulado', ['atividade_id'])
    ]).then(function (r) {
      return {
        celulas: r[0].map(celula).map(semCampoSemana),
        linhas: r[1].map(linha).map(semCampoSemana),
        planilha: r[2].map(planilha).map(semCampoSemana),
        controle: r[3].map(controle).map(semCampoSemana)
      };
    });
  }
  // update que não encontra linha (regra de acesso) não dá erro no Supabase: confere o que voltou
  function exigeLinha(l) {
    if (!l || !l.length) throw new Error('Sem permissão para esta alteração.');
    return l;
  }
  function gravarSemana(inicio, campos) {
    var v = {};
    if (campos.revisao !== undefined) v.revisao = campos.revisao;
    if (campos.elaboradoPor !== undefined) v.elaborado_por = campos.elaboradoPor;
    return cliente().from('rpsq_semanas').update(v).eq('inicio', inicio).select('inicio').then(dados).then(exigeLinha).then(function () {});
  }
  function abrirSemana(nova) {
    return cliente().rpc('rpsq_abrir_semana', { p_nova: nova }).then(dados).then(function () {});
  }

  // ---------- lançamentos (cada chamada grava na hora; a célula inteira de uma vez) ----------
  function grava(tabela, valores, chave) {
    return cliente().from(tabela).upsert(valores, { onConflict: chave }).select().then(dados).then(exigeLinha).then(function (l) { return l[0]; });
  }
  function gravarCelula(sem, canteiroId, atividadeId, tipo, dia, campos) {
    return grava('rpsq_celulas', {
      semana: sem, canteiro_id: canteiroId, atividade_id: atividadeId, tipo: tipo, dia: dia,
      torres: campos.torres || [], comentario: campos.comentario || '', a_confirmar: !!campos.aConfirmar
    }, 'semana,canteiro_id,atividade_id,tipo,dia').then(celula);
  }
  function gravarEncarregado(sem, canteiroId, atividadeId, tipo, nome) {
    return grava('rpsq_linhas', { semana: sem, canteiro_id: canteiroId, atividade_id: atividadeId, tipo: tipo, encarregado: nome || '' },
      'semana,canteiro_id,atividade_id,tipo').then(linha);
  }
  function gravarVisibilidade(sem, canteiroId, atividadeId, visivel) {
    return grava('rpsq_planilha', { semana: sem, canteiro_id: canteiroId, atividade_id: atividadeId, visivel: !!visivel },
      'semana,canteiro_id,atividade_id').then(planilha);
  }
  function gravarControle(sem, atividadeId, campos) {
    return grava('rpsq_controle', { semana: sem, atividade_id: atividadeId, previsto: campos.previsto, acumulado: campos.acumulado },
      'semana,atividade_id').then(controle);
  }

  // ---------- tempo real e conexão ----------
  function avisaConexao() { ouvintesConexao.forEach(function (fn) { fn(conexao.rede); }); }
  function mudaTempoReal(ligado) {
    if (conexao.tempoReal === ligado) return;
    conexao.tempoReal = ligado;
    ouvintesTempoReal.forEach(function (fn) { fn(ligado); });
  }
  function paraSonda() { if (sonda) { clearInterval(sonda); sonda = null; } }
  function redeVoltou() { paraSonda(); if (!conexao.rede) { conexao.rede = true; avisaConexao(); } }
  // uma chamada ao banco falhou por rede: bloqueia a edição e testa a cada 10 segundos se voltou
  function redeCaiu() {
    if (!conexao.rede) return;
    conexao.rede = false;
    avisaConexao();
    paraSonda();
    sonda = setInterval(function () {
      cliente().from('rpsq_semanas').select('inicio').limit(1).then(function (r) {
        if (!r.error || !/failed to fetch|networkerror|load failed/i.test(r.error.message)) redeVoltou();
      });
    }, 10000);
  }
  window.addEventListener('online', redeVoltou);
  window.addEventListener('offline', function () { if (conexao.rede) { conexao.rede = false; avisaConexao(); } });

  function assinar(sem, aoMudar) {
    var c = cliente();
    function trata(tabela, conv) {
      return function (p) {
        var novo = p.new && Object.keys(p.new).length ? p.new : null;
        // mudança feita por esta mesma pessoa: a tela já mostra
        if (novo && meuId && (novo.alterado_por === meuId || (tabela === 'atividades' && novo.criada_por === meuId))) return;
        var reg;
        if (novo) reg = conv(novo);
        else if (tabela === 'celulas') reg = celula(Object.assign({ torres: [], comentario: '', a_confirmar: false }, p.old)); // célula apagada = vazia
        else return;
        if (reg.semana !== undefined && reg.semana !== sem) return;
        aoMudar({ tabela: tabela, registro: reg });
      };
    }
    var filtro = 'semana=eq.' + sem;
    var canal = c.channel('rpsq-semana-' + sem)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpsq_celulas', filter: filtro }, trata('celulas', celula))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpsq_linhas', filter: filtro }, trata('linhas', linha))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpsq_planilha', filter: filtro }, trata('planilha', planilha))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpsq_controle', filter: filtro }, trata('controle', controle))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rpsq_atividades' }, trata('atividades', atividade))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpsq_semanas' }, trata('semanas', semana))
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') mudaTempoReal(true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') mudaTempoReal(false);
      });
    return function () { c.removeChannel(canal); };
  }
  function aoMudarConexao(fn) { ouvintesConexao.push(fn); }
  function aoMudarTempoReal(fn) { ouvintesTempoReal.push(fn); }

  // ---------- histórico (script 007; o banco grava sozinho a cada alteração) ----------
  function listarHistorico(sem, atividadeId, canteiroId) {
    var c = cliente();
    return lerTudo(function () {
      return c.from('rpsq_historico').select('tipo, dia, campo, antes, depois, por_nome, em')
        .eq('semana', sem).eq('atividade_id', atividadeId)
        .or('canteiro_id.eq.' + Number(canteiroId) + ',canteiro_id.is.null')
        .order('id', { ascending: false });
    }).then(function (l) {
      return l.map(function (x) {
        return { tipo: x.tipo, dia: x.dia, campo: x.campo, antes: x.antes, depois: x.depois, porNome: x.por_nome || '', em: x.em };
      });
    });
  }

  // ---------- administração ----------
  function listarUsuarios() { return cliente().rpc('rpsq_listar_usuarios').then(dados); }
  function gravarUsuario(u) {
    return cliente().rpc('rpsq_gravar_usuario', { p_email: u.email, p_nome: u.nome, p_papel: u.papel, p_ativo: u.ativo !== false })
      .then(dados).then(function () {});
  }
  function copiaDeSeguranca() {
    // tabela -> colunas da chave, para a leitura em páginas sair sempre na mesma ordem
    var c = cliente(), chaves = {
      rpsq_config: ['chave'], rpsq_trechos: ['id'], rpsq_canteiros: ['id'], rpsq_torres: ['trecho_id', 'ordem'],
      rpsq_atividades: ['id'], rpsq_semanas: ['inicio'], rpsq_planilha: ['semana', 'canteiro_id', 'atividade_id'],
      rpsq_linhas: ['semana', 'canteiro_id', 'atividade_id', 'tipo'], rpsq_celulas: ['semana', 'canteiro_id', 'atividade_id', 'tipo', 'dia'],
      rpsq_controle: ['semana', 'atividade_id'], rpsq_usuarios: ['user_id'], rpsq_historico: ['id']
    }, tabelas = Object.keys(chaves);
    return Promise.all(tabelas.map(function (t) {
      return lerTudo(function () {
        var q = c.from(t).select('*');
        chaves[t].forEach(function (k) { q = q.order(k); });
        return q;
      });
    })).then(function (r) {
      var saida = { geradoEm: new Date().toISOString() };
      tabelas.forEach(function (t, i) { saida[t] = r[i]; });
      return saida;
    });
  }

  return {
    entrar: entrar, sair: sair, usuarioAtual: usuarioAtual,
    carregarBase: carregarBase, criarAvulsa: criarAvulsa,
    listarSemanas: listarSemanas, carregarSemana: carregarSemana, gravarSemana: gravarSemana, abrirSemana: abrirSemana,
    gravarCelula: gravarCelula, gravarEncarregado: gravarEncarregado, gravarVisibilidade: gravarVisibilidade, gravarControle: gravarControle,
    assinar: assinar, aoMudarConexao: aoMudarConexao, aoMudarTempoReal: aoMudarTempoReal,
    listarHistorico: listarHistorico,
    listarUsuarios: listarUsuarios, gravarUsuario: gravarUsuario, copiaDeSeguranca: copiaDeSeguranca
  };
})();
