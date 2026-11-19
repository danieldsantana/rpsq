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
//   carregarBase()              -> { config: { contratante, contratada, contrato, codigoFormulario,
//                                              identificacaoFormulario,          (texto, várias linhas; opcional)
//                                              logoContratada, logoContratante }, (imagens em data URL; opcionais)
//                                    trechos: [ { id, sigla, nomeLt,
//                                      canteiros:  [ { id, nome } ],
//                                      torres:     [ [codigo, familia, tipo, vaoM] ],
//                                      atividades: [ { id, codigo, nome, unidade, topico, nomeTopico, avulsa, partes } ] } ] }
//                                      partes: null, 'pes', 'estais' ou 'mastro' (fundações; ver regras.js)
//   criarAvulsa(trechoId, topico, nome, unidade)  -> a atividade criada (código = próximo livre do tópico),
//                                  no formato de carregarBase e com trechoId
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
//                                  é chamada para mudanças feitas por OUTRAS pessoas. O registro vem no
//                                  formato de carregarSemana, com o campo semana; em 'atividades', no
//                                  formato de carregarBase e com trechoId
//   aoMudarConexao(fn)          -> fn(true|false)   há conexão com o banco? Sem ela, a edição é bloqueada
//   aoMudarTempoReal(fn)        -> fn(true|false)   o canal ao vivo está funcionando? Algumas redes o
//                                  bloqueiam com a internet funcionando; aí o app busca as mudanças
//                                  de tempos em tempos e continua editável
//
// --- Histórico (o banco grava sozinho a cada alteração; o app só lê) ---
//   listarHistorico(semana, atividadeId, canteiroId)
//                               -> [ { tipo, dia, campo, antes, depois, porNome, em } ]  mais recente primeiro
//                                  campo: 'torres' | 'comentario' | 'a_confirmar' | 'encarregado' | 'previsto' | 'acumulado'
//                                  tipo e dia vêm null quando não se aplicam (encarregado: só dia null;
//                                  previsto e acumulado: os dois null, e valem para todos os canteiros)
//                                  em: data e hora em ISO
//
// --- Administração ---
//   listarUsuarios()            -> [ { id, email, nome, papel, ativo } ]
//   gravarUsuario({ email, nome, papel, ativo })   inclui ou altera pelo e-mail do login; a pessoa
//                                  precisa já ter login no projeto. Recusa tirar o próprio acesso de admin.
//   copiaDeSeguranca()          -> objeto com todas as tabelas, para baixar como JSON
//
// Erros: as funções rejeitam com um Error cuja mensagem pode ser mostrada à pessoa como está.
//
// Aqui, os dados de base vêm da variável RPSQ_BASE: nos testes públicos, testes/base-exemplo.js (fictício).
// A semana de exemplo é montada com as torres fictícias e nomes inventados ("ENCARREGADO A").
// REPOSITÓRIO PÚBLICO: nenhum dado real de obra neste arquivo.
//
// Funções SÓ DE TESTE (não existem na camada do Supabase):
//   reiniciar()                          volta tudo ao estado inicial (base + semana de exemplo)
//   definirPapel('consulta')             troca o papel de quem está "logado"
//   simularOutraPessoa(tabela, registro, semAviso)  grava como se fosse outra pessoa e avisa quem
//                                        assinou (com semAviso, não avisa: como se o canal ao vivo estivesse fora)
//   simularConexao(true|false)           simula a queda e a volta da internet
//   simularTempoReal(true|false)         simula o canal ao vivo bloqueado pela rede
var DadosMemoria = (function () {
  var SEMANA_EXEMPLO = '2026-11-16';
  var M; // tudo o que está "no banco"

  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function ok(x) { return Promise.resolve(x === undefined ? undefined : copia(x)); }
  function falha(msg) { return Promise.reject(new Error(msg)); }
  function eSegunda(iso) { return new Date(iso + 'T12:00:00').getDay() === 1; }
  function somaDias(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function maisRecente() { return M.semanas.length ? M.semanas[0].inicio : null; }
  function ordenaSemanas() { M.semanas.sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }); }
  function acha(lista, campos, valores) {
    for (var i = 0; i < lista.length; i++) {
      if (campos.every(function (c, k) { return lista[i][c] === valores[k]; })) return lista[i];
    }
    return null;
  }

  // ---------- montagem ----------
  function montaBase() {
    var fonte = window.RPSQ_BASE;
    if (!fonte) throw new Error('Dados de exemplo não carregados (RPSQ_BASE).');
    var idCant = 0, idAtiv = 0;
    return {
      config: copia(fonte.config),
      trechos: fonte.trechos.map(function (t) {
        return {
          id: t.id, sigla: t.sigla, nomeLt: t.nomeLt,
          canteiros: t.canteiros.map(function (nome) { return { id: ++idCant, nome: nome }; }),
          torres: copia(t.torres),
          atividades: t.atividades.map(function (a) {
            return { id: ++idAtiv, codigo: a.codigo, nome: a.nome, unidade: a.unidade, topico: a.topico,
                     nomeTopico: a.nomeTopico, avulsa: false, partes: a.partes || null };
          })
        };
      })
    };
  }

  // Semana de exemplo, só nos trechos fictícios X1 e X2. Mostra os casos que a tela precisa tratar:
  // células amarelas, comentário em célula vazia, encarregado faltando, conflito entre canteiros,
  // avulsa e atividade oculta com lançamento.
  function montaExemplo() {
    var s = SEMANA_EXEMPLO;
    M.semanas = [{ inicio: s, revisao: 0, elaboradoPor: '' }];
    var x1 = M.base.trechos.filter(function (t) { return t.id === 'X1'; })[0];
    var x2 = M.base.trechos.filter(function (t) { return t.id === 'X2'; })[0];
    if (!x1 || !x2) return;
    function cant(t, nome) { return t.canteiros.filter(function (c) { return c.nome === nome; })[0].id; }
    function ativ(t, cod) { return t.atividades.filter(function (a) { return a.codigo === cod; })[0].id; }
    function vis(t, nome, cod, visivel) {
      M.planilha.push({ canteiroId: cant(t, nome), atividadeId: ativ(t, cod), visivel: visivel !== false });
    }
    function cel(t, nome, cod, tipo, dia, torres, comentario, aConfirmar) {
      M.celulas.push({ semana: s, canteiroId: cant(t, nome), atividadeId: ativ(t, cod), tipo: tipo, dia: dia,
                       torres: torres, comentario: comentario || '', aConfirmar: !!aConfirmar });
    }
    function enc(t, nome, cod, tipo, quem) {
      M.linhas.push({ semana: s, canteiroId: cant(t, nome), atividadeId: ativ(t, cod), tipo: tipo, encarregado: quem });
    }
    M.planilha = [];
    ['1.2.1', '2.1.1', '3.1.2', '4.1.1'].forEach(function (c) { vis(x1, 'Norte', c); });
    vis(x1, 'Norte', '5.1.1', false); // oculta, mas com lançamento
    ['2.1.1', '3.1.2'].forEach(function (c) { vis(x1, 'Sul', c); });
    vis(x2, 'Leste', '2.1.2');
    M.planilha.forEach(function (p) { p.semana = s; });

    cel(x1, 'Norte', '2.1.1', 'E', 0, ['0/1', '0/2'], '', true);
    cel(x1, 'Norte', '2.1.1', 'E', 1, ['0/3'], '', true);
    cel(x1, 'Norte', '2.1.1', 'E', 2, ['1/1', '1/2', '2/1'], '', true);
    cel(x1, 'Norte', '2.1.1', 'P1', 0, ['2/2', '3/1', '3/2']);
    cel(x1, 'Norte', '2.1.1', 'P1', 1, ['4/1', '4/2', '4/3']);
    cel(x1, 'Norte', '2.1.1', 'P2', 0, ['5/1', '5/2']);
    enc(x1, 'Norte', '2.1.1', 'E', 'ENCARREGADO A');
    enc(x1, 'Norte', '2.1.1', 'P1', 'ENCARREGADO A'); // P2 sem encarregado: aparece "obrigatório"
    cel(x1, 'Norte', '1.2.1', 'P1', 2, ['5/1', '5/2', '6/1', '6/2'], 'Manutenção da cerca do acesso');
    cel(x1, 'Norte', '1.2.1', 'P1', 3, ['6/2', '7/1A', '7/2A']);
    enc(x1, 'Norte', '1.2.1', 'P1', 'ENCARREGADO B');
    cel(x1, 'Norte', '3.1.2', 'E', 3, ['6/2', '7/1A', '7/2A']);
    cel(x1, 'Norte', '3.1.2', 'E', 4, [], 'Mudança da equipe para o canteiro Sul');
    enc(x1, 'Norte', '3.1.2', 'E', 'ENCARREGADO C');
    cel(x1, 'Norte', '5.1.1', 'P1', 0, ['1/1']);
    enc(x1, 'Norte', '5.1.1', 'P1', 'ENCARREGADO C');
    cel(x1, 'Sul', '2.1.1', 'P1', 0, ['3/1', '3/2', '10/1']); // 3/1 e 3/2 também no Norte: conflito
    enc(x1, 'Sul', '2.1.1', 'P1', 'ENCARREGADO D');
    cel(x1, 'Sul', '3.1.2', 'P1', 2, ['12/1', '12/2']);
    enc(x1, 'Sul', '3.1.2', 'P1', 'ENCARREGADO E');
    cel(x2, 'Leste', '2.1.2', 'P1', 1, ['2/1', '2/2', '3/1']);
    enc(x2, 'Leste', '2.1.2', 'P1', 'ENCARREGADO F');

    // atividade avulsa no tópico 2.1 do X1
    var av = criaAvulsa('X1', '2.1', 'DRENAGEM', 'TORRE');
    M.planilha.push({ semana: s, canteiroId: cant(x1, 'Norte'), atividadeId: av.id, visivel: true });
    M.celulas.push({ semana: s, canteiroId: cant(x1, 'Norte'), atividadeId: av.id, tipo: 'P1', dia: 3,
                     torres: ['9/1'], comentario: '', aConfirmar: false });
    M.linhas.push({ semana: s, canteiroId: cant(x1, 'Norte'), atividadeId: av.id, tipo: 'P1', encarregado: 'ENCARREGADO A' });

    M.controle = [
      { semana: s, atividadeId: ativ(x1, '2.1.1'), previsto: 59, acumulado: 20 },
      { semana: s, atividadeId: ativ(x1, '1.2.1'), previsto: 30.5, acumulado: 12.25 }
    ];
  }

  function reiniciar() {
    M = { base: null, semanas: [], celulas: [], linhas: [], planilha: [], controle: [], historico: [],
          usuario: { id: 'memoria', nome: 'USUÁRIO DE TESTE', papel: 'admin' },
          usuarios: [{ id: 'memoria', email: 'teste@exemplo.com', nome: 'USUÁRIO DE TESTE', papel: 'admin', ativo: true }],
          // logins que "existem no projeto" (no Supabase, auth.users); só esses podem entrar na lista do RPSQ
          logins: ['teste@exemplo.com', 'novo@exemplo.com', 'outro@exemplo.com'],
          ouvintes: [], ouvintesConexao: [], ouvintesTempoReal: [] };
    M.base = montaBase();
    montaExemplo();
  }

  // ---------- regras de acesso (as mesmas do banco) ----------
  function podeGravar(semana) {
    if (['admin', 'edita'].indexOf(M.usuario.papel) < 0) return 'Você não tem permissão para alterar a planilha.';
    if (semana !== maisRecente()) return 'Só a semana mais recente pode ser alterada.';
    return '';
  }
  function soAdmin() { return M.usuario.papel === 'admin' ? '' : 'Só o administrador pode fazer isso.'; }

  function trechoDaAtividade(id) {
    for (var i = 0; i < M.base.trechos.length; i++) {
      if (M.base.trechos[i].atividades.some(function (a) { return a.id === id; })) return M.base.trechos[i];
    }
    return null;
  }

  function criaAvulsa(trechoId, topico, nome, unidade) {
    var t = M.base.trechos.filter(function (x) { return x.id === trechoId; })[0];
    var doTopico = t ? t.atividades.filter(function (a) { return a.topico === topico; }) : [];
    if (!doTopico.length) throw new Error('O tópico ' + topico + ' não existe no trecho ' + trechoId + '.');
    var maior = 0;
    doTopico.forEach(function (a) {
      var resto = a.codigo.slice(topico.length + 1);
      if (/^\d+$/.test(resto)) maior = Math.max(maior, +resto);
    });
    var maxId = 0;
    M.base.trechos.forEach(function (x) { x.atividades.forEach(function (a) { maxId = Math.max(maxId, a.id); }); });
    var nova = { id: maxId + 1, trechoId: trechoId, codigo: topico + '.' + (maior + 1), nome: nome.trim().toUpperCase(),
                 unidade: unidade.trim().toUpperCase(), topico: topico, nomeTopico: doTopico[0].nomeTopico, avulsa: true, partes: null };
    t.atividades.push(nova);
    return nova;
  }

  function avisa(tabela, registro) {
    M.ouvintes.forEach(function (o) {
      if (registro.semana === undefined || registro.semana === o.semana) o.fn({ tabela: tabela, registro: copia(registro) });
    });
  }

  // como o gatilho do banco: anota o campo se o valor mudou
  function registra(semana, canteiroId, atividadeId, tipo, dia, campo, antes, depois) {
    if (antes === undefined) antes = null;
    if (depois === undefined) depois = null;
    if (JSON.stringify(antes) === JSON.stringify(depois)) return;
    M.historico.push({ semana: semana, canteiroId: canteiroId, atividadeId: atividadeId, tipo: tipo, dia: dia, campo: campo,
                       antes: copia(antes), depois: copia(depois), porNome: M.usuario.nome, em: new Date().toISOString() });
  }

  // grava sem conferir permissão (usada pelas funções públicas e pela simulação de outra pessoa)
  var gravadores = {
    celulas: function (r) {
      var x = acha(M.celulas, ['semana', 'canteiroId', 'atividadeId', 'tipo', 'dia'], [r.semana, r.canteiroId, r.atividadeId, r.tipo, r.dia]);
      if (!x) { x = { semana: r.semana, canteiroId: r.canteiroId, atividadeId: r.atividadeId, tipo: r.tipo, dia: r.dia,
                      torres: [], comentario: '', aConfirmar: false }; M.celulas.push(x); }
      if (r.torres !== undefined) x.torres = r.torres.slice();
      if (r.comentario !== undefined) x.comentario = r.comentario;
      if (r.aConfirmar !== undefined) x.aConfirmar = !!r.aConfirmar;
      return x;
    },
    linhas: function (r) {
      var x = acha(M.linhas, ['semana', 'canteiroId', 'atividadeId', 'tipo'], [r.semana, r.canteiroId, r.atividadeId, r.tipo]);
      if (!x) { x = { semana: r.semana, canteiroId: r.canteiroId, atividadeId: r.atividadeId, tipo: r.tipo, encarregado: '' }; M.linhas.push(x); }
      x.encarregado = r.encarregado;
      return x;
    },
    planilha: function (r) {
      var x = acha(M.planilha, ['semana', 'canteiroId', 'atividadeId'], [r.semana, r.canteiroId, r.atividadeId]);
      if (!x) { x = { semana: r.semana, canteiroId: r.canteiroId, atividadeId: r.atividadeId, visivel: true }; M.planilha.push(x); }
      x.visivel = !!r.visivel;
      return x;
    },
    controle: function (r) {
      var x = acha(M.controle, ['semana', 'atividadeId'], [r.semana, r.atividadeId]);
      if (!x) { x = { semana: r.semana, atividadeId: r.atividadeId, previsto: null, acumulado: null }; M.controle.push(x); }
      if (r.previsto !== undefined) x.previsto = r.previsto;
      if (r.acumulado !== undefined) x.acumulado = r.acumulado;
      return x;
    }
  };

  function semCampoSemana(lista, semana) {
    return lista.filter(function (x) { return x.semana === semana; }).map(function (x) {
      var y = copia(x); delete y.semana; return y;
    });
  }

  reiniciar();

  return {
    // ---------- sessão ----------
    entrar: function () { return ok(M.usuario); },
    sair: function () { return ok(); },
    usuarioAtual: function () { return ok(M.usuario); },

    // ---------- base ----------
    carregarBase: function () { return ok(M.base); },
    criarAvulsa: function (trechoId, topico, nome, unidade) {
      if (['admin', 'edita'].indexOf(M.usuario.papel) < 0) return falha('Você não tem permissão para criar atividades.');
      if (!String(nome || '').trim() || !String(unidade || '').trim()) return falha('Informe o nome e a unidade da atividade.');
      try { var nova = criaAvulsa(trechoId, topico, nome, unidade); } catch (e) { return falha(e.message); }
      avisa('atividades', nova);
      return ok(nova);
    },

    // ---------- semana ----------
    listarSemanas: function () { return ok(M.semanas); },
    carregarSemana: function (inicio) {
      return ok({
        celulas: semCampoSemana(M.celulas, inicio),
        linhas: semCampoSemana(M.linhas, inicio),
        planilha: semCampoSemana(M.planilha, inicio),
        controle: semCampoSemana(M.controle, inicio)
      });
    },
    gravarSemana: function (inicio, campos) {
      var erro = soAdmin(); if (erro) return falha(erro);
      var s = acha(M.semanas, ['inicio'], [inicio]);
      if (!s) return falha('Semana não encontrada.');
      if (campos.revisao !== undefined) s.revisao = campos.revisao;
      if (campos.elaboradoPor !== undefined) s.elaboradoPor = campos.elaboradoPor;
      return ok();
    },
    abrirSemana: function (nova) {
      var erro = soAdmin(); if (erro) return falha(erro);
      if (!eSegunda(nova)) return falha('A semana tem de começar numa segunda-feira.');
      if (acha(M.semanas, ['inicio'], [nova])) return falha('Essa semana já existe.');
      var ant = maisRecente();
      if (ant && nova !== somaDias(ant, 7)) return falha('A semana nova tem de ser a seguinte à mais recente.');
      M.semanas.push({ inicio: nova, revisao: 0, elaboradoPor: '' });
      ordenaSemanas();
      if (!ant) return ok();
      var novoTipo = { P1: 'E', P2: 'P1' };
      M.planilha.filter(function (x) { return x.semana === ant; }).forEach(function (x) {
        M.planilha.push({ semana: nova, canteiroId: x.canteiroId, atividadeId: x.atividadeId, visivel: x.visivel });
      });
      M.controle.filter(function (x) { return x.semana === ant; }).forEach(function (x) {
        M.controle.push({ semana: nova, atividadeId: x.atividadeId, previsto: x.previsto, acumulado: x.acumulado });
      });
      M.linhas.filter(function (x) { return x.semana === ant && novoTipo[x.tipo] && x.encarregado; }).forEach(function (x) {
        M.linhas.push({ semana: nova, canteiroId: x.canteiroId, atividadeId: x.atividadeId, tipo: novoTipo[x.tipo], encarregado: x.encarregado });
      });
      M.celulas.filter(function (x) { return x.semana === ant && novoTipo[x.tipo] && (x.torres.length || x.comentario); }).forEach(function (x) {
        M.celulas.push({ semana: nova, canteiroId: x.canteiroId, atividadeId: x.atividadeId, tipo: novoTipo[x.tipo], dia: x.dia,
                         torres: x.torres.slice(), comentario: x.comentario, aConfirmar: x.tipo === 'P1' && x.torres.length > 0 });
      });
      return ok();
    },

    // ---------- lançamentos ----------
    gravarCelula: function (semana, canteiroId, atividadeId, tipo, dia, campos) {
      var erro = podeGravar(semana); if (erro) return falha(erro);
      var t = trechoDaAtividade(atividadeId);
      if (campos.torres) {
        var r = Regras.criar(t.torres);
        var ruins = campos.torres.filter(function (c) { return !r.existe(c); });
        if (ruins.length) return falha('Torres que não existem no trecho ' + t.id + ': ' + ruins.join(', '));
      }
      var antes = copia(acha(M.celulas, ['semana', 'canteiroId', 'atividadeId', 'tipo', 'dia'], [semana, canteiroId, atividadeId, tipo, dia]) ||
                        { torres: [], comentario: '', aConfirmar: false });
      var x = gravadores.celulas({ semana: semana, canteiroId: canteiroId, atividadeId: atividadeId, tipo: tipo, dia: dia,
        torres: campos.torres, comentario: campos.comentario, aConfirmar: campos.aConfirmar });
      [['torres', 'torres'], ['comentario', 'comentario'], ['a_confirmar', 'aConfirmar']].forEach(function (c) {
        registra(semana, canteiroId, atividadeId, tipo, dia, c[0], antes[c[1]], x[c[1]]);
      });
      return ok(x);
    },
    gravarEncarregado: function (semana, canteiroId, atividadeId, tipo, nome) {
      var erro = podeGravar(semana); if (erro) return falha(erro);
      var l = acha(M.linhas, ['semana', 'canteiroId', 'atividadeId', 'tipo'], [semana, canteiroId, atividadeId, tipo]);
      var antes = l ? l.encarregado : '';
      var x = gravadores.linhas({ semana: semana, canteiroId: canteiroId, atividadeId: atividadeId, tipo: tipo, encarregado: nome });
      registra(semana, canteiroId, atividadeId, tipo, null, 'encarregado', antes, x.encarregado);
      return ok(x);
    },
    gravarVisibilidade: function (semana, canteiroId, atividadeId, visivel) {
      var erro = podeGravar(semana); if (erro) return falha(erro);
      return ok(gravadores.planilha({ semana: semana, canteiroId: canteiroId, atividadeId: atividadeId, visivel: visivel }));
    },
    gravarControle: function (semana, atividadeId, campos) {
      var erro = podeGravar(semana); if (erro) return falha(erro);
      var antes = copia(acha(M.controle, ['semana', 'atividadeId'], [semana, atividadeId]) || { previsto: null, acumulado: null });
      var x = gravadores.controle({ semana: semana, atividadeId: atividadeId, previsto: campos.previsto, acumulado: campos.acumulado });
      ['previsto', 'acumulado'].forEach(function (c) { registra(semana, null, atividadeId, null, null, c, antes[c], x[c]); });
      return ok(x);
    },

    // ---------- histórico ----------
    listarHistorico: function (semana, atividadeId, canteiroId) {
      return ok(M.historico.filter(function (h) {
        return h.semana === semana && h.atividadeId === atividadeId && (h.canteiroId === canteiroId || h.canteiroId === null);
      }).slice().reverse().map(function (h) {
        return { tipo: h.tipo, dia: h.dia, campo: h.campo, antes: copia(h.antes), depois: copia(h.depois), porNome: h.porNome, em: h.em };
      }));
    },

    // ---------- tempo real e conexão ----------
    assinar: function (semana, aoMudar) {
      var o = { semana: semana, fn: aoMudar };
      M.ouvintes.push(o);
      return function () { M.ouvintes = M.ouvintes.filter(function (x) { return x !== o; }); };
    },
    aoMudarConexao: function (fn) { M.ouvintesConexao.push(fn); },
    aoMudarTempoReal: function (fn) { M.ouvintesTempoReal.push(fn); },

    // ---------- administração ----------
    listarUsuarios: function () { var erro = soAdmin(); return erro ? falha(erro) : ok(M.usuarios); },
    gravarUsuario: function (u) {
      var erro = soAdmin(); if (erro) return falha(erro);
      var email = String(u.email || '').trim().toLowerCase();
      if (M.logins.indexOf(email) < 0) return falha('Não existe login com o e-mail ' + u.email + ' no projeto. Crie antes no painel do Supabase (Authentication > Users).');
      var x = acha(M.usuarios, ['email'], [email]);
      if (x && x.id === M.usuario.id && (u.papel !== 'admin' || u.ativo === false)) return falha('Você não pode tirar o seu próprio acesso de administrador.');
      if (!x) { x = { id: 'login-' + email, email: email }; M.usuarios.push(x); }
      x.nome = String(u.nome || '').trim(); x.papel = u.papel; x.ativo = u.ativo !== false;
      return ok();
    },
    copiaDeSeguranca: function () { return ok({ semanas: M.semanas, celulas: M.celulas, linhas: M.linhas, planilha: M.planilha, controle: M.controle, historico: M.historico }); },

    // ---------- só de teste ----------
    reiniciar: reiniciar,
    definirPapel: function (papel) { M.usuario.papel = papel; },
    simularOutraPessoa: function (tabela, registro, semAviso) {
      var gravado = gravadores[tabela](registro);
      if (!semAviso) avisa(tabela, gravado);
    },
    simularConexao: function (ligada) { M.ouvintesConexao.forEach(function (fn) { fn(!!ligada); }); },
    simularTempoReal: function (ligado) { M.ouvintesTempoReal.forEach(function (fn) { fn(!!ligado); }); }
  };
})();
