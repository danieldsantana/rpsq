// INICIALIZAÇÃO E ESTADO DA TELA. Liga as partes: dados, planilha (planilha.js) e painel (painel.js).
// Especificação: seções 3, 7, 11, 13 e 15.
//
// O estado da tela fica em App.E. Os lançamentos da semana aberta ficam em mapas por chave:
//   E.cel  'canteiro|atividade|tipo|dia' -> { torres, comentario, aConfirmar }
//   E.enc  'canteiro|atividade|tipo'     -> nome do encarregado
//   E.vis  'canteiro|atividade'          -> true se a atividade está na planilha do canteiro
//   E.ctrl  atividade                    -> { previsto, acumulado }
// Toda alteração passa pelas funções App.gravar...: elas mudam o estado na hora (a tela responde sem
// esperar) e mandam para a camada de dados. Se a gravação falhar, a semana é recarregada.
//
// A FAZER na etapa 5: tela de entrada (e-mail e senha), tela de usuários e cópia de segurança.
var Dados = RPSQ_CONFIG.dados === 'supabase' ? DadosSupabase : DadosMemoria;

var App = (function () {
  var TODOS = 'todos';
  var TIPOS = [
    { k: 'E', n: 0, tar: 'EXEC.', xl: 'EXECUTADO', hd: 'EXECUTADO', desloc: -7 },
    { k: 'P1', n: 1, tar: 'PROG. 1', xl: 'PRIMEIRA SEMANA', hd: 'PROGRAMADO SEMANA 1', desloc: 0 },
    { k: 'P2', n: 2, tar: 'PROG. 2', xl: 'SEGUNDA SEMANA', hd: 'PROGRAMADA SEMANA 2', desloc: 7 }
  ];
  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var DIASX = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'];
  var VAZIA = Object.freeze({ torres: Object.freeze([]), comentario: '', aConfirmar: false });

  var E = {
    usuario: null, base: null, conectado: true,
    semanas: [], semana: null,
    cel: {}, enc: {}, vis: {}, ctrl: {},
    trecho: null, canteiro: null,      // canteiro: id do canteiro ou TODOS
    sel: null, ssel: null, nav: [],    // seleção na visão do canteiro ({r, c}) e no consolidado (chave)
    copiada: null,                     // célula copiada com Ctrl+C, destacada como no Excel: { semana, c, aid, tipo, col }
    addAberto: false, add: { g: '', t: '', a: '', avulsa: false },
    tela: 'planilha'                   // 'planilha' ou 'usuarios' (administrador)
  };
  var ATIV = {}, CANT = {}, REGRAS = {};
  var cancelarAssinatura = null;

  // ---------- apoio ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function dois(n) { return String(n).padStart(2, '0'); }
  function dataIso(iso) { return new Date(iso + 'T12:00:00'); }
  function iso(d) { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
  function somaDias(s, n) { var d = dataIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function ddmm(d) { return dois(d.getDate()) + '/' + dois(d.getMonth() + 1); }
  function ddmmaaaa(x) { var d = typeof x === 'string' ? dataIso(x) : x; return ddmm(d) + '/' + d.getFullYear(); }
  function tipo(k) { return TIPOS.filter(function (t) { return t.k === k; })[0]; }
  // data de um dia de uma linha: EXEC. é a semana anterior, PROG. 1 a semana do envio, PROG. 2 a seguinte
  function data(k, dia) { var d = dataIso(E.semana.inicio); d.setDate(d.getDate() + tipo(k).desloc + dia); return d; }
  function ehKm(a) { return String(a.unidade || '').toUpperCase() === 'KM'; }
  function cmpAtiv(a, b) {
    var x = a.codigo.split('.').map(Number), y = b.codigo.split('.').map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    }
    return 0;
  }
  // '12,5' -> 12.5; vazio -> null; texto que não é número -> undefined
  function num(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? n : undefined;
  }
  function fmtNum(v, unidade) {
    if (v == null || v === '') return '';
    var km = String(unidade || '').toUpperCase() === 'KM';
    return Number(v).toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: km ? 2 : 0, maximumFractionDigits: 2 });
  }
  var tmo;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(tmo); tmo = setTimeout(function () { t.hidden = true; }, 4500);
  }

  // ---------- chaves e leitura do estado ----------
  function kc(c, a, t, d) { return c + '|' + a + '|' + t + '|' + d; }
  function ke(c, a, t) { return c + '|' + a + '|' + t; }
  function kv(c, a) { return c + '|' + a; }
  function ativ(id) { return ATIV[id]; }
  function cant(id) { return CANT[id]; }
  function regras(trechoId) {
    var id = trechoId || E.trecho.id;
    if (!REGRAS[id]) REGRAS[id] = Regras.criar(E.base.trechos.filter(function (t) { return t.id === id; })[0].torres);
    return REGRAS[id];
  }
  function cel(c, a, t, d) { return E.cel[kc(c, a, t, d)] || VAZIA; }
  function encarregado(c, a, t) { return E.enc[ke(c, a, t)] || ''; }
  function visivel(c, a) { return !!E.vis[kv(c, a)]; }
  function controle(a) { return E.ctrl[a] || { previsto: null, acumulado: null }; }
  function temTorres(c, a, t) {
    for (var d = 0; d < 7; d++) if (cel(c, a, t, d).torres.length) return true;
    return false;
  }
  function atividadesDoTrecho(t) { return (t || E.trecho).atividades.slice().sort(cmpAtiv); }
  function canteirosDoTrecho(t) { return (t || E.trecho).canteiros; }
  function trechoDoCanteiro(id) {
    return E.base.trechos.filter(function (t) { return t.canteiros.some(function (c) { return c.id === id; }); })[0];
  }
  function visiveis(cid) {
    return atividadesDoTrecho(trechoDoCanteiro(cid)).filter(function (a) { return visivel(cid, a.id); });
  }

  // ---------- quem pode editar ----------
  function ehAdmin() { return !!E.usuario && E.usuario.papel === 'admin'; }
  function semanaAtual() { return !!E.semana && !!E.semanas.length && E.semana.inicio === E.semanas[0].inicio; }
  function motivoSoLeitura() {
    if (!E.conectado) return 'Sem conexão com a internet: a edição fica bloqueada até a conexão voltar.';
    if (!E.usuario || ['admin', 'edita'].indexOf(E.usuario.papel) < 0) return 'Seu acesso é só de consulta.';
    if (!semanaAtual()) return 'Semana anterior: só consulta. Só a semana mais recente pode ser alterada.';
    return '';
  }
  function podeEditar() { return !!E.semana && motivoSoLeitura() === ''; }

  // ---------- gravação ----------
  var pendentes = 0; // gravações ainda em andamento
  function falhou(err) {
    toast('Não foi possível gravar: ' + (err && err.message ? err.message : err));
    if (E.semana) recarregarSemana();
  }
  function envia(promessa) {
    pendentes++;
    return promessa.catch(falhou).then(function (x) { pendentes--; return x; });
  }
  // campos: { torres, comentario, aConfirmar }; o que não vier fica como está.
  // Mudar as torres de uma célula amarela confirma a célula (ela deixa de ser amarela).
  function gravarCelula(c, a, t, d, campos) {
    var atual = cel(c, a, t, d);
    var novo = {
      torres: campos.torres !== undefined ? campos.torres.slice() : atual.torres.slice(),
      comentario: campos.comentario !== undefined ? campos.comentario : atual.comentario,
      aConfirmar: campos.aConfirmar !== undefined ? !!campos.aConfirmar : (campos.torres !== undefined ? false : atual.aConfirmar)
    };
    E.cel[kc(c, a, t, d)] = novo;
    return envia(Dados.gravarCelula(E.semana.inicio, c, a, t, d, novo));
  }
  function gravarEncarregado(c, a, t, nome) {
    E.enc[ke(c, a, t)] = nome;
    return envia(Dados.gravarEncarregado(E.semana.inicio, c, a, t, nome));
  }
  function gravarVisibilidade(c, a, sim) {
    E.vis[kv(c, a)] = !!sim;
    return envia(Dados.gravarVisibilidade(E.semana.inicio, c, a, !!sim));
  }
  function gravarControle(a, campo, valor) {
    var c = controle(a), novo = { previsto: c.previsto, acumulado: c.acumulado };
    novo[campo] = valor;
    E.ctrl[a] = novo;
    return envia(Dados.gravarControle(E.semana.inicio, a, novo));
  }
  function gravarSemana(campos) {
    var s = E.semana;
    return Dados.gravarSemana(s.inicio, campos).then(function () {
      Object.keys(campos).forEach(function (k) { s[k] = campos[k]; });
      atualizarTela();
    }).catch(falhou);
  }
  // atividade nova (avulsa) criada aqui ou por outra pessoa; a camada de dados informa o trechoId
  function incluiAtividade(a) {
    if (ATIV[a.id]) return ATIV[a.id];
    var t = E.base.trechos.filter(function (x) { return x.id === a.trechoId; })[0];
    if (!t) return null;
    t.atividades.push(a);
    ATIV[a.id] = a;
    return a;
  }
  function criarAvulsa(topico, nome, unidade) {
    return Dados.criarAvulsa(E.trecho.id, topico, nome, unidade).then(incluiAtividade);
  }

  // ---------- carga ----------
  function indexa() {
    ATIV = {}; CANT = {}; REGRAS = {};
    E.base.trechos.forEach(function (t) {
      t.atividades.forEach(function (a) { a.trechoId = t.id; ATIV[a.id] = a; });
      t.canteiros.forEach(function (c) { CANT[c.id] = c; });
    });
  }
  function aplicaSemana(d) {
    E.cel = {}; E.enc = {}; E.vis = {}; E.ctrl = {};
    d.celulas.forEach(function (x) {
      E.cel[kc(x.canteiroId, x.atividadeId, x.tipo, x.dia)] = { torres: x.torres || [], comentario: x.comentario || '', aConfirmar: !!x.aConfirmar };
    });
    d.linhas.forEach(function (x) { E.enc[ke(x.canteiroId, x.atividadeId, x.tipo)] = x.encarregado || ''; });
    d.planilha.forEach(function (x) { E.vis[kv(x.canteiroId, x.atividadeId)] = !!x.visivel; });
    d.controle.forEach(function (x) { E.ctrl[x.atividadeId] = { previsto: x.previsto, acumulado: x.acumulado }; });
  }
  function carregarSemana(inicio) {
    return Dados.carregarSemana(inicio).then(function (d) {
      E.semana = E.semanas.filter(function (s) { return s.inicio === inicio; })[0];
      aplicaSemana(d);
      if (cancelarAssinatura) cancelarAssinatura();
      cancelarAssinatura = Dados.assinar(inicio, aoMudar);
    });
  }
  function recarregarSemana() {
    return carregarSemana(E.semana.inicio).then(atualizarTela);
  }

  // Mudança feita por outra pessoa: atualiza o estado e redesenha sem perder seleção, rolagem
  // nem o que estiver sendo digitado.
  function aoMudar(m) {
    var r = m.registro;
    if (m.tabela === 'celulas') E.cel[kc(r.canteiroId, r.atividadeId, r.tipo, r.dia)] = { torres: r.torres || [], comentario: r.comentario || '', aConfirmar: !!r.aConfirmar };
    else if (m.tabela === 'linhas') E.enc[ke(r.canteiroId, r.atividadeId, r.tipo)] = r.encarregado || '';
    else if (m.tabela === 'planilha') E.vis[kv(r.canteiroId, r.atividadeId)] = !!r.visivel;
    else if (m.tabela === 'controle') E.ctrl[r.atividadeId] = { previsto: r.previsto, acumulado: r.acumulado };
    else if (m.tabela === 'atividades') incluiAtividade(r);
    else if (m.tabela === 'semanas') {
      Dados.listarSemanas().then(function (ss) { E.semanas = ss; atualizarTela(); });
      return;
    }
    atualizarTela();
  }

  // ---------- desenho ----------
  function nomeArquivo() {
    if (!E.semana) return '';
    return E.base.config.codigoFormulario + ' - RPSQ - ' + ddmmaaaa(E.semana.inicio).replace(/\//g, '-') +
      ' REV' + dois(E.semana.revisao || 0) + '.xlsx';
  }
  function faixaComandos() {
    var todos = E.canteiro === TODOS;
    $('fname').textContent = nomeArquivo();
    $('conexao').textContent = !E.conectado ? 'Sem conexão com a internet: edição bloqueada'
      : (aoVivo ? '' : 'Atualização ao vivo indisponível nesta rede: as mudanças dos colegas aparecem a cada 20 segundos');
    $('f-cant').innerHTML = canteirosDoTrecho().map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === E.canteiro ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
    }).join('') + '<option value="' + TODOS + '"' + (todos ? ' selected' : '') + '>Todos (consolidado)</option>';
    $('f-sem').innerHTML = E.semanas.map(function (s, i) {
      return '<option value="' + s.inicio + '"' + (E.semana && s.inicio === E.semana.inicio ? ' selected' : '') + '>' +
        ddmmaaaa(s.inicio) + (i ? ' (consulta)' : '') + '</option>';
    }).join('');
    $('adm-sem').hidden = !ehAdmin();
    $('adm').hidden = !ehAdmin();
    $('f-rev').value = E.semana ? E.semana.revisao || 0 : '';
    $('f-rev').disabled = !E.semana || !E.conectado;
    $('b-abrir').disabled = !E.conectado;
    $('b-add').hidden = !podeEditar();
  }
  // caixa de nome e barra de fórmulas; depois, o painel
  function faixa() {
    var nb = $('namebox'), fx = $('fx');
    fx.disabled = true;
    if (!E.semana) { nb.innerHTML = '&nbsp;'; fx.value = ''; Painel.desenhar(); return; }
    if (E.canteiro === TODOS) {
      if (!E.ssel) { nb.innerHTML = '&nbsp;'; fx.value = ''; }
      else {
        var p = E.ssel.split('|'), a = ativ(+p[1]), tp = tipo(p[2]), d = +p[3];
        nb.textContent = a.codigo + ' · ' + cant(+p[0]).nome + ' · ' + tp.tar + ' · ' + DIAS[d] + ' ' + ddmm(data(tp.k, d));
        fx.value = regras().formatar(cel(+p[0], a.id, tp.k, d).torres, a.unidade);
      }
      Painel.desenhar();
      return;
    }
    var s = E.sel, nv = s && E.nav[s.r];
    if (!nv) { nb.innerHTML = '&nbsp;'; fx.value = ''; Painel.desenhar(); return; }
    var at = ativ(nv.aid), t = tipo(nv.tipo);
    nb.textContent = at.codigo + ' · ' + t.tar + ' · ' + (s.c === 0 ? 'Encarregado' : DIAS[s.c - 1] + ' ' + ddmm(data(t.k, s.c - 1)));
    fx.value = s.c === 0 ? encarregado(E.canteiro, at.id, t.k) : regras().formatar(cel(E.canteiro, at.id, t.k, s.c - 1).torres, at.unidade);
    Painel.desenhar();
  }
  function render() {
    faixaComandos();
    // na tela de usuários, a folha não é redesenhada (para não apagar o que está sendo digitado lá)
    if (E.tela === 'usuarios') {
      $('addp').hidden = true; $('pane').hidden = true;
      $('namebox').innerHTML = '&nbsp;'; $('fx').value = '';
      return;
    }
    Painel.desenharAdd();
    Planilha.desenhar();
    faixa();
  }
  // redesenha tudo guardando o que a pessoa estava digitando (no painel, no previsto/acumulado
  // ou no "elaborado") e o foco
  function atualizarTela() {
    var campos = [].slice.call(document.querySelectorAll('#pane input, #pane textarea, #paper input[data-ctl], #f-elab'));
    function seletor(el) { return el.id ? '#' + el.id : '[data-ctl="' + el.getAttribute('data-ctl') + '"]'; }
    var sujos = campos.filter(function (el) { return el.value !== el.defaultValue; })
      .map(function (el) { return { s: seletor(el), v: el.value }; });
    var ativo = document.activeElement, foco = null;
    if (ativo && campos.indexOf(ativo) >= 0) foco = { s: seletor(ativo), i: ativo.selectionStart, f: ativo.selectionEnd };
    var area = $('area'), x = area.scrollLeft, y = area.scrollTop;
    render();
    area.scrollLeft = x; area.scrollTop = y;
    sujos.forEach(function (c) { var el = document.querySelector(c.s); if (el) el.value = c.v; });
    if (foco) {
      var el = document.querySelector(foco.s);
      if (el) { el.focus(); try { el.setSelectionRange(foco.i, foco.f); } catch (e) { /* campo sem seleção */ } }
    }
  }
  function atualizaListaTorres() {
    $('dl-torres').innerHTML = E.trecho.torres.map(function (t) { return '<option value="' + esc(t[0]) + '"></option>'; }).join('');
  }

  // ---------- ações da faixa de comandos ----------
  function trocarTrecho(id) {
    var t = E.base.trechos.filter(function (x) { return x.id === id; })[0];
    if (!t || (t === E.trecho && E.tela === 'planilha')) return;
    E.tela = 'planilha';
    E.trecho = t;
    E.canteiro = t.canteiros.length ? t.canteiros[0].id : TODOS;
    E.sel = null; E.ssel = null; E.add = { g: '', t: '', a: '', avulsa: false };
    atualizaListaTorres();
    render();
  }
  function trocarCanteiro(v) {
    E.canteiro = v === TODOS ? TODOS : +v;
    E.sel = null; E.ssel = null; E.tela = 'planilha';
    render();
  }
  function trocarSemana(inicio) {
    return carregarSemana(inicio).then(function () { E.sel = null; E.ssel = null; E.tela = 'planilha'; render(); });
  }
  function abrirSemanaNova(semPerguntar) {
    var nova = E.semanas.length ? somaDias(E.semanas[0].inicio, 7) : null;
    if (!nova) {
      var txt = window.prompt('Data da primeira semana (a segunda-feira do envio), no formato DD/MM/AAAA:');
      var m = String(txt || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) { if (txt) toast('Data inválida. Use o formato DD/MM/AAAA.'); return Promise.resolve(); }
      nova = m[3] + '-' + dois(m[2]) + '-' + dois(m[1]);
    } else if (!semPerguntar && !window.confirm('Abrir a semana de ' + ddmmaaaa(nova) + '?\n\n' +
        'A PROG. 1 da semana atual vira o EXEC. da nova (em amarelo, a confirmar) e a PROG. 2 vira a PROG. 1. ' +
        'Depois disso, a semana atual fica só para consulta.')) {
      return Promise.resolve();
    }
    return Dados.abrirSemana(nova).then(function () { return Dados.listarSemanas(); }).then(function (ss) {
      E.semanas = ss;
      return carregarSemana(nova);
    }).then(function () {
      E.sel = null; E.ssel = null;
      render();
      toast('Semana de ' + ddmmaaaa(nova) + ' aberta.');
    }).catch(function (err) { toast(err.message); });
  }
  // linhas com torres e sem encarregado, em todos os trechos (só atividades visíveis, que são as exportadas)
  function faltaEncarregado() {
    var saida = [];
    E.base.trechos.forEach(function (t) {
      t.canteiros.forEach(function (c) {
        visiveis(c.id).forEach(function (a) {
          TIPOS.forEach(function (tp) {
            if (temTorres(c.id, a.id, tp.k) && !encarregado(c.id, a.id, tp.k)) saida.push({ trecho: t, canteiro: c.id, aid: a.id, tipo: tp.k });
          });
        });
      });
    });
    return saida;
  }
  function exportar() {
    if (!E.semana) return;
    var f = faltaEncarregado();
    if (f.length) {
      toast('Falta o encarregado em ' + f.length + (f.length === 1 ? ' linha' : ' linhas') +
        ' com lançamento. Preencha as células marcadas como obrigatório antes de exportar.');
      if (f[0].trecho !== E.trecho) trocarTrecho(f[0].trecho.id);
      if (E.canteiro !== f[0].canteiro) trocarCanteiro(f[0].canteiro);
      var r = -1;
      E.nav.forEach(function (n, i) { if (r < 0 && n.aid === f[0].aid && n.tipo === f[0].tipo) r = i; });
      if (r >= 0) Planilha.seleciona(r, 0);
      return;
    }
    if (typeof Exportacao.gerar === 'function') Exportacao.gerar();
    else toast('A geração do arquivo Excel entra na etapa seguinte.');
  }

  // ---------- eventos gerais ----------
  // Todo clique em botão salva antes o que estiver digitado no painel (especificação, seção 5).
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b || b.disabled) return;
    Painel.salvar();
    if (Painel.clique(b) || Planilha.clique(b) || Admin.clique(b)) return;
    if (b.id === 'b-exp') exportar();
    else if (b.id === 'b-abrir') abrirSemanaNova();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'f-cant') { Painel.salvar(); trocarCanteiro(t.value); }
    else if (t.id === 'f-sem') { Painel.salvar(); trocarSemana(t.value); }
    else if (t.id === 'f-rev') {
      var n = num(t.value);
      if (n === undefined || n === null || n < 0 || n !== Math.floor(n)) { toast('A revisão é um número inteiro: 0, 1, 2...'); t.value = E.semana.revisao || 0; return; }
      gravarSemana({ revisao: n });
    }
  });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target, k = ev.key;
    if (t.getAttribute && t.getAttribute('data-ctl') && k === 'Enter') { t.blur(); return; }
    if (t.id === 'f-rev' && k === 'Enter') { t.blur(); return; }
    if (t.matches && t.matches('input,textarea,select,button')) return;
    if (k === 'Escape' && E.copiada) { E.copiada = null; Planilha.marcaCopia(); return; }
    if (E.canteiro === TODOS || !E.sel) return;
    if (k === 'ArrowDown') { ev.preventDefault(); Planilha.move(1, 0); }
    else if (k === 'ArrowUp') { ev.preventDefault(); Planilha.move(-1, 0); }
    else if (k === 'ArrowRight') { ev.preventDefault(); Planilha.move(0, 1); }
    else if (k === 'ArrowLeft') { ev.preventDefault(); Planilha.move(0, -1); }
    else if (k === 'Tab') { ev.preventDefault(); Planilha.move(0, ev.shiftKey ? -1 : 1); }
    else if (k === 'Enter' || k === 'F2') { ev.preventDefault(); Painel.foco(); }
    else if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); Painel.apagar(); }
    else if (k.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      var el = Painel.foco();
      if (el) { ev.preventDefault(); el.value = k; }
    }
  });

  // Ctrl+C / Ctrl+V na planilha (fora dos campos, e sem texto marcado com o mouse)
  function ehDaPlanilha(ev) {
    var t = ev.target;
    if (E.tela !== 'planilha' || !E.semana) return false;
    if (t && t.matches && t.matches('input,textarea,select')) return false;
    var marcado = window.getSelection && String(window.getSelection());
    return !marcado;
  }
  document.addEventListener('copy', function (ev) { if (ehDaPlanilha(ev)) Painel.copiar(ev); });
  document.addEventListener('paste', function (ev) { if (ehDaPlanilha(ev)) { Painel.salvar(); Painel.colar(ev); } });

  // ---------- entrada (login) ----------
  function mostraEntrada(msg) {
    document.body.classList.add('sem-login');
    $('quem').textContent = '';
    $('b-sair').hidden = true;
    $('e-erro').textContent = msg || '';
    $('e-email').focus();
  }
  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'entrada') return;
    ev.preventDefault();
    var b = $('e-ok');
    b.disabled = true; $('e-erro').textContent = '';
    Dados.entrar($('e-email').value, $('e-senha').value).then(function (u) {
      $('e-senha').value = '';
      return comeca(u);
    }).catch(function (err) {
      $('e-erro').textContent = err && err.message ? err.message : String(err);
    }).then(function () { b.disabled = false; });
  });
  document.addEventListener('click', function (ev) {
    if (ev.target.id !== 'b-sair') return;
    Painel.salvar();
    Dados.sair().then(function () { location.reload(); });
  });

  // ---------- início ----------
  function iniciar() {
    return Dados.usuarioAtual().then(function (u) {
      if (!u) { mostraEntrada(); return; }
      return comeca(u);
    }).catch(function (err) { mostraEntrada(err && err.message ? err.message : String(err)); });
  }
  function comeca(u) {
    E.sel = null; E.ssel = null; E.addAberto = false;
    E.usuario = u;
    document.body.classList.remove('sem-login');
    $('quem').textContent = u.nome;
    $('b-sair').hidden = RPSQ_CONFIG.dados === 'memoria';
    return Dados.carregarBase().then(function (b) {
      E.base = b;
      indexa();
      E.trecho = b.trechos[0];
      E.canteiro = E.trecho.canteiros.length ? E.trecho.canteiros[0].id : TODOS;
      atualizaListaTorres();
      return Dados.listarSemanas();
    }).then(function (ss) {
      E.semanas = ss;
      E.semana = null;
      if (ss.length) return carregarSemana(ss[0].inicio);
    }).then(render).catch(function (err) {
      $('paper').innerHTML = '<p class="vazio-geral">Não foi possível carregar o RPSQ: ' + esc(err && err.message ? err.message : err) + '</p>';
    });
  }
  // Canal ao vivo bloqueado pela rede (a internet funciona): a edição continua, e a semana é
  // buscada de novo a cada 20 segundos, sem atrapalhar quem está digitando.
  var aoVivo = true, busca = null;
  function atualizarDoBanco() {
    if (!E.semana || !E.conectado || pendentes) return Promise.resolve();
    var inicio = E.semana.inicio;
    return Promise.all([Dados.listarSemanas(), Dados.carregarSemana(inicio)]).then(function (r) {
      if (!E.semana || E.semana.inicio !== inicio || pendentes) return;
      E.semanas = r[0];
      E.semana = E.semanas.filter(function (s) { return s.inicio === inicio; })[0] || E.semana;
      aplicaSemana(r[1]);
      atualizarTela();
    }).catch(function () { /* tenta de novo na próxima vez */ });
  }
  Dados.aoMudarTempoReal(function (ligado) {
    if (ligado === aoVivo) return;
    aoVivo = ligado;
    clearInterval(busca); busca = null;
    if (!ligado) busca = setInterval(atualizarDoBanco, 20000);
    else atualizarDoBanco(); // pega o que mudou enquanto o canal esteve fora
    if (E.base) faixaComandos();
  });
  Dados.aoMudarConexao(function (ligada) {
    var antes = E.conectado;
    E.conectado = ligada;
    if (antes !== ligada && E.base) {
      atualizarTela();
      if (ligada) recarregarSemana();
    }
  });

  var api = {
    E: E, TODOS: TODOS, TIPOS: TIPOS, DIAS: DIAS, DIASX: DIASX,
    esc: esc, ddmm: ddmm, ddmmaaaa: ddmmaaaa, data: data, tipo: tipo, ehKm: ehKm, num: num, fmtNum: fmtNum, toast: toast,
    ativ: ativ, cant: cant, regras: regras, cel: cel, encarregado: encarregado, visivel: visivel, controle: controle,
    temTorres: temTorres, atividadesDoTrecho: atividadesDoTrecho, canteirosDoTrecho: canteirosDoTrecho, visiveis: visiveis,
    ehAdmin: ehAdmin, podeEditar: podeEditar, motivoSoLeitura: motivoSoLeitura,
    gravarCelula: gravarCelula, gravarEncarregado: gravarEncarregado, gravarVisibilidade: gravarVisibilidade,
    gravarControle: gravarControle, gravarSemana: gravarSemana, criarAvulsa: criarAvulsa,
    render: render, faixa: faixa, atualizarTela: atualizarTela, nomeArquivo: nomeArquivo,
    trocarTrecho: trocarTrecho, trocarCanteiro: trocarCanteiro, trocarSemana: trocarSemana,
    abrirSemanaNova: abrirSemanaNova, faltaEncarregado: faltaEncarregado, exportar: exportar, atualizarDoBanco: atualizarDoBanco,
    iniciar: iniciar
  };
  // só começa se a página tem a moldura da tela (o teste de carga dos scripts não tem)
  api.pronto = document.getElementById('paper') ? iniciar() : Promise.resolve();
  return api;
})();
