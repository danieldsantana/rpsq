// PAINEL LATERAL: é por ele que a célula é preenchida. E o painel "Adicionar atividade".
// Especificação: seções 5, 6, 7 e 8. Portado do protótipo aprovado.
//
// Regra importante, já acertada no protótipo: o que estiver digitado no painel (comentário ou encarregado)
// é salvo ANTES de qualquer outra ação (trocar de célula, clicar em outro botão, trocar de canteiro).
// Por isso salvar() é chamado por quem trata esses eventos. Não use o evento "change" dos campos para
// salvar: ele redesenha a tela no meio de um clique e o clique se perde.
var Painel = (function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return App.esc(s); }

  // a célula selecionada na visão de um canteiro, ou null
  function sel() {
    var E = App.E, s = E.sel;
    if (!s || E.canteiro === App.TODOS || !E.semana) return null;
    var nv = E.nav[s.r];
    if (!nv) return null;
    return { c: E.canteiro, a: App.ativ(nv.aid), tipo: nv.tipo, tp: App.tipo(nv.tipo), col: s.c, dia: s.c - 1 };
  }
  // Partes das fundações (atividade com partes 'pes' ou 'estais'): as letras marcadas valem para a
  // próxima torre ou intervalo adicionado, em qualquer célula, até a pessoa mudar. Todas = torre inteira.
  var marcadas = Regras.PARTES;
  function porPartes(a) { return !App.ehKm(a) && (a.partes === 'pes' || a.partes === 'estais'); }
  function soEstaiadas(a) { return a.partes === 'estais' || a.partes === 'mastro'; }
  function nomePartes(a) { return a.partes === 'estais' ? 'Estais' : 'Pés (ou estais)'; }
  function mesmaTorre(item, torre) { return Regras.separa(item).torre === torre; }

  function exemploTorre() {
    var t = App.E.trecho.torres;
    return t.length ? t[Math.floor(t.length / 2)][0] : '';
  }

  // ---------- histórico (botão "Histórico" da barra) ----------
  // Com o botão ligado, o painel mostra quem alterou a célula selecionada, quando e o quê, no lugar do
  // lançamento. A lista vem do banco (o banco grava sozinho a cada alteração) e é buscada de novo ao trocar
  // de atividade, ou passados alguns segundos.
  var modoHistorico = false, tudo = false, hist = { chave: '', lista: null, erro: '', quando: 0 };
  function alternarHistorico() {
    if (App.E.canteiro === App.TODOS) { App.toast('Escolha um canteiro para ver o histórico de uma célula.'); return; }
    modoHistorico = !modoHistorico;
    hist.quando = 0;
    desenhar();
  }
  function marcaBotao() {
    var b = $('b-hist');
    if (b) { b.setAttribute('aria-pressed', modoHistorico ? 'true' : 'false'); b.classList.toggle('on', modoHistorico); }
  }
  function carregaHistorico(s) {
    var E = App.E, chave = E.semana.inicio + '|' + s.c + '|' + s.a.id;
    if (hist.chave === chave && Date.now() - hist.quando < 5000) return;
    hist = { chave: chave, lista: hist.chave === chave ? hist.lista : null, erro: '', quando: Date.now() };
    Dados.listarHistorico(E.semana.inicio, s.a.id, s.c).then(function (l) {
      if (hist.chave !== chave) return;
      hist.lista = l; hist.erro = '';
      if (modoHistorico) desenhar();
    }).catch(function (e) {
      if (hist.chave !== chave) return;
      hist.erro = 'Não foi possível ler o histórico: ' + e.message;
      if (modoHistorico) desenhar();
    });
  }
  function quando(iso) {
    var d = new Date(iso), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function textoHistorico(h, a) {
    var r = App.regras(), vazio = '(vazio)';
    function num(v) { return v === null || v === undefined || v === '' ? vazio : Number(v).toLocaleString('pt-BR'); }
    function tor(l) { return l && l.length ? r.formatar(l, a.unidade) : vazio; }
    switch (h.campo) {
      case 'torres': return 'Torres: ' + tor(h.antes) + ' \u2192 ' + tor(h.depois);
      case 'comentario':
        if (!h.antes) return 'Comentário incluído: "' + h.depois + '"';
        if (!h.depois) return 'Comentário removido: "' + h.antes + '"';
        return 'Comentário: "' + h.antes + '" \u2192 "' + h.depois + '"';
      case 'a_confirmar': return h.depois ? 'Ficou amarela (a confirmar)' : 'Célula amarela confirmada';
      case 'encarregado': return 'Encarregado: ' + (h.antes || vazio) + ' \u2192 ' + (h.depois || vazio);
      case 'previsto': return 'Total previsto: ' + num(h.antes) + ' \u2192 ' + num(h.depois);
      case 'acumulado': return 'Acumulado atual: ' + num(h.antes) + ' \u2192 ' + num(h.depois);
    }
    return h.campo;
  }
  function ondeHistorico(h) {
    if (!h.tipo) return 'Previsto e acumulado';
    var tp = App.tipo(h.tipo);
    return tp.tar + ' · ' + (h.dia === null || h.dia === undefined ? 'Encarregado' : App.DIAS[h.dia] + ' ' + App.ddmm(App.data(h.tipo, h.dia)));
  }
  function desenharHistorico(pn, s) {
    var h = '<h3>Histórico</h3>';
    if (!s) {
      pn.innerHTML = h + '<p class="dica">Clique numa célula para ver quem alterou, quando e o quê.</p>' +
        '<div class="lin"><button class="rb" id="h-voltar">Voltar ao lançamento</button></div>';
      return;
    }
    carregaHistorico(s);
    h += '<div class="onde">' + esc(s.a.codigo + ' ' + s.a.nome) + '<br>' + (tudo ? 'Toda a atividade · ' : s.tp.tar + ' · ' +
      (s.col === 0 ? 'Encarregado' : App.DIAS[s.dia] + ' ' + App.ddmm(App.data(s.tipo, s.dia))) + ' · ') + esc(App.cant(s.c).nome) + '</div>' +
      '<div class="lin"><button class="rb" id="h-tudo">' + (tudo ? 'Só esta célula' : 'Toda a atividade') + '</button>' +
      '<button class="rb" id="h-voltar">Voltar ao lançamento</button></div>';
    var corpo;
    if (hist.erro) corpo = '<p class="erro">' + esc(hist.erro) + '</p>';
    else if (!hist.lista) corpo = '<p class="dica">Carregando…</p>';
    else {
      var lista = hist.lista.filter(function (x) {
        if (tudo) return true;
        if (x.tipo !== s.tipo) return false;
        return s.col === 0 ? x.campo === 'encarregado' : x.dia === s.dia && x.campo !== 'encarregado';
      });
      corpo = lista.length ? '<ol class="hist">' + lista.map(function (x) {
        return '<li><div class="h-q">' + quando(x.em) + ' · ' + esc(x.porNome || 'sem nome (script no banco)') + '</div>' +
          (tudo ? '<div class="h-o">' + esc(ondeHistorico(x)) + '</div>' : '') + '<div>' + esc(textoHistorico(x, s.a)) + '</div></li>';
      }).join('') + '</ol>' : '<p class="dica">Nenhuma alteração registrada' + (tudo ? ' nesta atividade' : ' nesta célula') + ' nesta semana.</p>';
    }
    pn.innerHTML = h + '<div class="sec">' + corpo + (tudo ? '' : '<p class="dica">O total previsto e o acumulado aparecem em "Toda a atividade".</p>') + '</div>';
  }

  // ---------- desenho ----------
  function desenhar() {
    var pn = $('pane'), E = App.E;
    marcaBotao();
    if (E.canteiro === App.TODOS || !E.semana) { pn.hidden = true; pn.innerHTML = ''; return; }
    pn.hidden = false;
    var s = sel(), ed = App.podeEditar(), motivo = App.motivoSoLeitura();
    if (modoHistorico) { desenharHistorico(pn, s); return; }
    var f = Planilha.faixaSel();
    if (f && (f.r1 !== f.r2 || f.c1 !== f.c2)) {
      var nc = (f.r2 - f.r1 + 1) * (f.c2 - f.c1 + 1);
      pn.innerHTML = '<h3>' + nc + ' células selecionadas</h3><p class="dica">Ctrl+C copia, Ctrl+V cola e Delete apaga as torres' +
        (f.c1 === 0 ? ' e os encarregados' : '') + ' de todas. Os comentários ficam.</p>' +
        '<p class="dica">Para lançar torres ou comentário, clique numa célula só.</p>';
      return;
    }
    if (!s) {
      pn.innerHTML = '<h3>Lançamento</h3><p class="dica">' +
        esc(ed ? 'Clique numa célula da planilha para lançar as torres, o encarregado ou um comentário.' : motivo) + '</p>';
      return;
    }
    var h = '<h3>' + esc(s.a.codigo + ' ' + s.a.nome) + '</h3><div class="onde">' + s.tp.tar + ' · ' +
      (s.col === 0 ? 'Encarregado' : App.DIAS[s.dia] + ' ' + App.ddmm(App.data(s.tipo, s.dia))) + ' · ' + esc(App.cant(s.c).nome) + '</div>';
    if (!ed) h += '<p class="dica">' + esc(motivo) + '</p>';

    if (s.col === 0) {
      var enc = App.encarregado(s.c, s.a.id, s.tipo);
      if (ed) {
        h += '<div class="sec"><label for="p-enc"><b>Encarregado desta linha</b></label><input type="text" class="larg" id="p-enc" autocomplete="off" value="' + esc(enc) + '">' +
          '<div class="lin"><button class="rb main" id="p-enc-ok">Salvar</button></div><p class="dica">Obrigatório quando a linha tem lançamento.</p></div>';
      } else {
        h += '<div class="sec"><b>Encarregado desta linha</b><div class="como">' + esc(enc) + '</div></div>';
      }
      pn.innerHTML = h;
      return;
    }

    var x = App.cel(s.c, s.a.id, s.tipo, s.dia), r = App.regras(), km = App.ehKm(s.a), ex = exemploTorre();
    var pp = porPartes(s.a);
    if (ed && pp) {
      h += '<div class="sec"><b>' + nomePartes(s.a) + ' a lançar</b><div class="lin partes">' + Regras.PARTES.split('').map(function (l) {
        return '<label class="ck"><input type="checkbox" data-pt="' + l + '"' + (marcadas.indexOf(l) >= 0 ? ' checked' : '') + '> ' + l + '</label>';
      }).join('') + '</div><p class="dica">Todos marcados = torre inteira. Adicionar de novo uma torre troca as partes dela.</p></div>';
    }
    if (ed) {
      h += '<div class="sec"><label for="p-t"><b>Adicionar torre individual</b></label><div class="lin"><input type="text" id="p-t" list="dl-torres" autocomplete="off" placeholder="' + esc(ex) + '">' +
        '<button class="rb" id="p-add-t">Adicionar</button></div>' + (km ? '<p class="dica">Em KM, uma torre sozinha conta o vão à frente dela.</p>' : '') +
        (soEstaiadas(s.a) ? '<p class="dica">Esta atividade é só de torres estaiadas.</p>' : '') + '</div>';
      h += '<div class="sec"><b>Adicionar um intervalo de torres</b><div class="lin"><label for="p-de">De</label><input type="text" id="p-de" list="dl-torres" autocomplete="off" placeholder="' + esc(ex) + '">' +
        '<label for="p-ate">até</label><input type="text" id="p-ate" list="dl-torres" autocomplete="off"><button class="rb" id="p-add-i">Adicionar</button></div>' +
        (km ? '<p class="dica">Em KM, o intervalo inclui as duas torres; cada uma conta o vão à frente dela.</p>' : '') + '</div>';
      h += '<div class="erro" id="p-erro" role="alert"></div>';
    }
    var chips = km
      ? r.sequencias(x.torres, 'KM').map(function (sq) {
          return '<span class="chip">' + esc(sq.texto) + (ed ? '<button data-rmr="' + esc(sq.codigos.join(',')) + '" aria-label="Remover o intervalo">×</button>' : '') + '</span>';
        }).join('')
      : r.ordenar(x.torres).map(function (t) {
          var torre = Regras.separa(t).torre, texto = r.formatar([t], s.a.unidade);
          // nas atividades por partes, clicar na torre traz ela e as partes para o painel, para trocar
          var nome = ed && pp ? '<button class="edt" data-edt="' + esc(t) + '" title="Trocar as partes desta torre">' + esc(texto) + '</button>' : esc(texto);
          return '<span class="chip">' + nome + (ed ? '<button data-rmt="' + esc(torre) + '" aria-label="Remover a torre ' + esc(torre) + '">×</button>' : '') + '</span>';
        }).join('');
    var n = r.ordenar(x.torres).length, completas = r.total([x.torres], 'TORRE');
    var q = km ? (n ? Regras.formatarTotal(r.total([x.torres], 'KM'), 'KM') + ' km' : '') : (n ? n + (n === 1 ? ' torre' : ' torres') : '');
    if (!km && n && completas < n) q += ', ' + (completas === 1 ? '1 completa' : completas + ' completas');
    h += '<div class="sec"><b>' + (km ? 'Torres e intervalos adicionados' : 'Torres adicionadas') + (q ? ' (' + q + ')' : '') + '</b>' +
      (chips ? '<div class="chips">' + chips + '</div>' : '<p class="dica">Nada lançado nesta célula.</p>') +
      '<span class="dica">Como vai aparecer na célula:</span><div class="como">' + esc(r.formatar(x.torres, s.a.unidade)) + '</div>' +
      (ed && n ? '<div class="lin"><button class="rb" id="p-limpa">Limpar célula</button></div>' : '') + '</div>';
    if (ed) {
      h += '<div class="sec"><label for="cm"><b>Comentário</b></label><textarea id="cm" placeholder="Opcional">' + esc(x.comentario) + '</textarea>' +
        '<div class="lin"><button class="rb" id="p-cm-ok">Salvar comentário</button>' + (x.comentario ? '<button class="rb" id="p-cm-rm">Remover</button>' : '') + '</div>' +
        '<p class="dica">Não aparece na célula. Fica em Observações, no fim da planilha.</p></div>';
      if (s.tipo === 'E' && n && x.aConfirmar) {
        h += '<div class="sec"><b>Executado da semana passada</b><p class="dica">Esta célula veio da Prog. 1 anterior.</p>' +
          '<div class="lin"><button class="rb" data-conf="ok">Confirmar</button><button class="rb" id="b-confall">Confirmar todas as amarelas</button></div></div>';
      }
    } else if (x.comentario) {
      h += '<div class="sec"><b>Comentário</b><div class="como">' + esc(x.comentario) + '</div></div>';
    }
    pn.innerHTML = h;
  }

  // ---------- salvar o que está digitado ----------
  function salvar() {
    var s = sel();
    if (!s || !App.podeEditar()) return false;
    var mudou = false, cm = $('cm'), en = $('p-enc'), v;
    if (cm && s.col > 0) {
      v = cm.value.trim();
      if (v !== App.cel(s.c, s.a.id, s.tipo, s.dia).comentario) {
        App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { comentario: v });
        cm.defaultValue = cm.value; mudou = true;
      }
    }
    if (en && s.col === 0) {
      v = en.value.trim();
      if (v !== App.encarregado(s.c, s.a.id, s.tipo)) {
        App.gravarEncarregado(s.c, s.a.id, s.tipo, v);
        en.defaultValue = en.value; mudou = true;
      }
    }
    if (mudou) Planilha.redesenhar();
    return mudou;
  }
  function foco() {
    var el = $('p-t') || $('p-de') || $('p-enc');
    if (el) el.focus();
    return el;
  }
  function erro(m) { var el = $('p-erro'); if (el) el.textContent = m; return true; }
  function redesenhaTudo() { Planilha.redesenhar(); App.faixa(); }

  // Delete na célula selecionada: apaga as torres (o comentário fica) ou o encarregado
  function apagar() {
    var s = sel(), E = App.E, f = Planilha.faixaSel();
    if (!s || !f || !App.podeEditar()) return;
    hist.quando = 0;
    for (var r = f.r1; r <= f.r2; r++) {
      var nv = E.nav[r];
      for (var c = f.c1; c <= f.c2; c++) {
        if (c === 0) { if (App.encarregado(E.canteiro, nv.aid, nv.tipo)) App.gravarEncarregado(E.canteiro, nv.aid, nv.tipo, ''); }
        else if (App.cel(E.canteiro, nv.aid, nv.tipo, c - 1).torres.length) App.gravarCelula(E.canteiro, nv.aid, nv.tipo, c - 1, { torres: [] });
      }
    }
    redesenhaTudo();
  }
  // adiciona as torres; nas atividades por partes, com as partes marcadas, trocando as que a torre já tinha
  function adiciona(s, x, novas) {
    if (!porPartes(s.a)) { mudaTorres(x.torres.concat(novas)); return true; }
    if (!marcadas) return erro('Marque pelo menos uma parte (A, B, C ou D).');
    var ficam = x.torres.filter(function (t) { return !novas.some(function (n) { return mesmaTorre(t, n); }); });
    mudaTorres(ficam.concat(novas.map(function (t) { return Regras.junta(t, marcadas); })));
    return true;
  }
  function mudaTorres(lista) {
    var s = sel();
    App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { torres: App.regras().ordenar(lista) });
    redesenhaTudo();
    foco();
  }

  // ---------- cliques ----------
  function clique(b) {
    var d = b.dataset, s = sel(), r = s && App.regras(), x, T;
    if (s && s.col > 0 && App.podeEditar()) {
      x = App.cel(s.c, s.a.id, s.tipo, s.dia);
      if (b.id === 'p-add-t') {
        T = r.lerTorre($('p-t').value);
        if (!T) return erro('Digite a torre no formato quilômetro/sequência, por exemplo ' + exemploTorre() + '.');
        if (!r.existe(T)) return erro('A torre ' + T + ' não existe no trecho ' + App.E.trecho.id + '.');
        if (soEstaiadas(s.a) && r.familia(T) !== 'E') return erro('A torre ' + T + ' é autoportante: esta atividade é só de torres estaiadas.');
        return adiciona(s, x, [T]);
      }
      if (b.id === 'p-add-i') {
        var A = r.lerTorre($('p-de').value), B = r.lerTorre($('p-ate').value);
        if (!A || !B) return erro('Preencha as duas torres do intervalo, por exemplo ' + exemploTorre() + '.');
        var ruins = [A, B].filter(function (c) { return !r.existe(c); });
        if (ruins.length) return erro(ruins.length === 1 ? 'A torre ' + ruins[0] + ' não existe no trecho ' + App.E.trecho.id + '.' : 'As torres ' + ruins.join(' e ') + ' não existem no trecho ' + App.E.trecho.id + '.');
        var lista = r.intervalo(A, B, s.a.unidade), fora = [];
        if (soEstaiadas(s.a)) {
          fora = lista.filter(function (t) { return r.familia(t) !== 'E'; });
          lista = lista.filter(function (t) { return r.familia(t) === 'E'; });
          if (!lista.length) return erro('Esta atividade é só de torres estaiadas, e o intervalo só tem autoportantes.');
        }
        adiciona(s, x, lista);
        if (fora.length) App.toast('Ficaram de fora as autoportantes: ' + fora.join(', ') + '.');
        return true;
      }
      if (d.rmt !== undefined) { mudaTorres(x.torres.filter(function (t) { return !mesmaTorre(t, d.rmt); })); return true; }
      if (d.edt) {
        var e = Regras.separa(d.edt);
        marcadas = e.partes || Regras.PARTES;
        desenhar();
        $('p-t').value = e.torre;
        $('p-t').focus();
        return true;
      }
      if (d.rmr) { var tira = d.rmr.split(','); mudaTorres(x.torres.filter(function (t) { return tira.indexOf(t) < 0; })); return true; }
      if (b.id === 'p-limpa') { mudaTorres([]); return true; }
      if (b.id === 'p-cm-ok') { redesenhaTudo(); App.toast('Comentário salvo.'); return true; }
      if (b.id === 'p-cm-rm') { App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { comentario: '' }); redesenhaTudo(); return true; }
      if (d.conf) { App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { aConfirmar: false }); redesenhaTudo(); return true; }
    }
    if (b.id === 'b-hist') { alternarHistorico(); return true; }
    if (b.id === 'h-voltar') { modoHistorico = false; desenhar(); return true; }
    if (b.id === 'h-tudo') { tudo = !tudo; desenhar(); return true; }
    if (b.id === 'p-enc-ok') { redesenhaTudo(); return true; }
    if (b.id === 'b-confall') { confirmarTodas(); return true; }
    if (b.id === 'b-add') {
      if (App.E.canteiro === App.TODOS) { App.toast('Escolha um canteiro para adicionar atividades.'); return true; }
      App.E.addAberto = !App.E.addAberto;
      desenharAdd();
      if (App.E.addAberto) $('ad-g').focus();
      return true;
    }
    if (b.id === 'ad-x') { App.E.addAberto = false; desenharAdd(); return true; }
    if (b.id === 'ad-ok') { adicionar(); return true; }
    return false;
  }
  function confirmarTodas() {
    var c = App.E.canteiro;
    if (!App.podeEditar() || c === App.TODOS) return;
    App.visiveis(c).forEach(function (a) {
      for (var i = 0; i < 7; i++) {
        var x = App.cel(c, a.id, 'E', i);
        if (x.aConfirmar) App.gravarCelula(c, a.id, 'E', i, { aConfirmar: false });
      }
    });
    redesenhaTudo();
  }

  // ---------- copiar e colar (Ctrl+C / Ctrl+V; pedido do usuário em 24/11/2026) ----------
  // Copiar leva o texto das células para a área de transferência, como o Excel: colunas separadas por
  // tabulação e linhas por quebra de linha (dá para colar no Excel). Colar substitui as torres das células,
  // como no Excel; o comentário fica. Um bloco copiado é colado a partir da primeira célula selecionada;
  // uma célula só, colada numa seleção de várias, vai para todas. Aceita texto de fora, desde que seja só
  // torres e intervalos do trecho. Na coluna ENCARREGADO, copia e cola o nome. Se alguma célula não puder
  // receber o que foi colado, nada é colado.
  var copiado = null; // { trecho, texto, matriz }: o último bloco copiado no app, para colar exatamente igual
  function rotulo(a, tipo, col) {
    return a.codigo + ' ' + App.tipo(tipo).tar + ' ' + (col === 0 ? 'Encarregado' : App.DIAS[col - 1]);
  }
  // as células do bloco a copiar: matriz de { nome } (encarregado) ou { torres, unidade }
  function blocoParaCopiar() {
    var E = App.E;
    if (E.canteiro === App.TODOS) {
      if (!E.ssel) return null;
      var p = E.ssel.split('|'), a = App.ativ(+p[1]);
      return { matriz: [[{ torres: App.cel(+p[0], a.id, p[2], +p[3]).torres, unidade: a.unidade }]],
               onde: { c: +p[0], linhas: [{ aid: a.id, tipo: p[2] }], c1: +p[3] + 1, c2: +p[3] + 1 } };
    }
    var f = Planilha.faixaSel();
    if (!f) return null;
    var matriz = [], linhas = [];
    for (var r = f.r1; r <= f.r2; r++) {
      var nv = E.nav[r], a = App.ativ(nv.aid), linha = [];
      linhas.push({ aid: a.id, tipo: nv.tipo });
      for (var c = f.c1; c <= f.c2; c++) {
        linha.push(c === 0 ? { nome: App.encarregado(E.canteiro, a.id, nv.tipo) }
                           : { torres: App.cel(E.canteiro, a.id, nv.tipo, c - 1).torres, unidade: a.unidade });
      }
      matriz.push(linha);
    }
    return { matriz: matriz, onde: { c: E.canteiro, linhas: linhas, c1: f.c1, c2: f.c2 } };
  }
  function copiar(ev) {
    var x = blocoParaCopiar();
    if (!x) return;
    var r = App.regras();
    var texto = x.matriz.map(function (l) {
      return l.map(function (k) { return k.nome !== undefined ? k.nome : r.formatar(k.torres, k.unidade); }).join('\t');
    }).join('\n');
    ev.clipboardData.setData('text/plain', texto);
    ev.preventDefault();
    copiado = { trecho: App.E.trecho.id, texto: texto, matriz: x.matriz };
    x.onde.semana = App.E.semana.inicio;
    App.E.copiada = x.onde;
    Planilha.marcaCopia();
    var n = x.matriz.length * x.matriz[0].length;
    App.toast(n > 1 ? 'Copiadas ' + n + ' células.' : (texto ? 'Copiado: ' + texto : 'Copiada uma célula vazia.'));
  }
  // o que vai para uma célula: { torres } ou { nome }, ou { erro }
  function valorPara(a, tipo, col, k) {
    var r = App.regras(), onde = ' (' + rotulo(a, tipo, col) + ')';
    if (col === 0) {
      if (k.torres) return { erro: 'Não colei: torres não entram na coluna ENCARREGADO' + onde + '.' };
      return { nome: (k.nome !== undefined ? k.nome : k.texto.split('\n')[0]).trim() };
    }
    if (k.nome !== undefined) return { erro: 'Não colei: o nome do encarregado não entra numa coluna de dia' + onde + '.' };
    var lista;
    if (k.torres) lista = k.torres.slice();
    else {
      var lido = r.ler(k.texto, a.unidade);
      if (lido.invalidas.length) return { erro: 'Não colei: torres que não existem no trecho ' + App.E.trecho.id + ': ' + lido.invalidas.join(', ') + onde + '.' };
      if (lido.resto) return { erro: 'Não colei: "' + lido.resto + '" não é torre nem intervalo' + onde + '.' };
      lista = lido.codigos;
    }
    if (lista.some(function (t) { return Regras.separa(t).partes; }) && !porPartes(a)) {
      return { erro: 'Não colei: ' + a.codigo + ' não é lançada por pés ou estais.' };
    }
    if (soEstaiadas(a)) {
      var auto = lista.filter(function (t) { return r.familia(t) !== 'E'; }).map(function (t) { return Regras.separa(t).torre; });
      if (auto.length) return { erro: 'Não colei: ' + a.codigo + ' é só de torres estaiadas, e ' + auto.join(', ') + (auto.length > 1 ? ' são autoportantes.' : ' é autoportante.') };
    }
    return { torres: r.ordenar(lista) };
  }
  function colar(ev) {
    var E = App.E, f = Planilha.faixaSel();
    if (!sel() || !f) return;
    ev.preventDefault();
    if (!App.podeEditar()) { App.toast(App.motivoSoLeitura()); return; }
    var texto = String(ev.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
    var matriz;
    if (copiado && copiado.trecho === E.trecho.id && copiado.texto === texto) matriz = copiado.matriz;
    else {
      if (!texto.trim()) return;
      var linhas = texto.replace(/\n+$/, '').split('\n');
      matriz = linhas.map(function (l) { return l.split('\t').map(function (t) { return { texto: t }; }); });
    }
    var m = matriz.length, n = Math.max.apply(null, matriz.map(function (l) { return l.length; }));
    var alvos = [];
    if (m === 1 && n === 1) {
      if (f.c1 === 0 && f.c2 > 0) { App.toast('Não colei: para repetir uma célula, selecione só a coluna ENCARREGADO ou só dias.'); return; }
      for (var r = f.r1; r <= f.r2; r++) for (var c = f.c1; c <= f.c2; c++) alvos.push({ r: r, c: c, k: matriz[0][0] });
    } else {
      if (f.r1 + m > E.nav.length || f.c1 + n > 8) {
        App.toast('Não colei: o bloco copiado (' + m + (m > 1 ? ' linhas' : ' linha') + ' × ' + n + (n > 1 ? ' colunas' : ' coluna') + ') passa do fim da planilha.');
        return;
      }
      for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) alvos.push({ r: f.r1 + i, c: f.c1 + j, k: matriz[i][j] || { texto: '' } });
    }
    // confere tudo antes de gravar
    var plano = [];
    for (var x = 0; x < alvos.length; x++) {
      var al = alvos[x], nv = E.nav[al.r], a = App.ativ(nv.aid), v = valorPara(a, nv.tipo, al.c, al.k);
      if (v.erro) { App.toast(v.erro); return; }
      plano.push({ a: a, tipo: nv.tipo, c: al.c, v: v });
    }
    plano.forEach(function (p) {
      if (p.c === 0) { if (p.v.nome !== App.encarregado(E.canteiro, p.a.id, p.tipo)) App.gravarEncarregado(E.canteiro, p.a.id, p.tipo, p.v.nome); }
      else App.gravarCelula(E.canteiro, p.a.id, p.tipo, p.c - 1, { torres: p.v.torres });
    });
    if (!(m === 1 && n === 1)) Planilha.selecionaFaixa(f.r1, f.c1, f.r1 + m - 1, f.c1 + n - 1);
    hist.quando = 0; redesenhaTudo();
    var p0 = plano[0];
    if (plano.length > 1) App.toast('Coladas ' + plano.length + ' células.');
    else if (p0.c === 0) App.toast('Encarregado colado: ' + p0.v.nome);
    else App.toast(p0.v.torres.length ? 'Colado: ' + App.regras().formatar(p0.v.torres, p0.a.unidade) : 'Colada uma célula vazia: as torres foram apagadas.');
  }

  // ---------- Adicionar atividade (cascata Grupo > Tópico > Atividade) ----------
  // O grupo é o primeiro número do código; os nomes vêm do nome do tópico ("GRUPO - TÓPICO").
  function partes(a) {
    var i = a.nomeTopico.indexOf(' - ');
    return i >= 0 ? { grupo: a.nomeTopico.slice(0, i), topico: a.nomeTopico.slice(i + 3) } : { grupo: a.nomeTopico, topico: a.nomeTopico };
  }
  // atividades que podem ser adicionadas (as desativadas no catálogo ficam de fora)
  function catalogo() { return App.atividadesDoTrecho().filter(function (a) { return a.ativa !== false; }); }
  function grupos() {
    var saida = [];
    catalogo().forEach(function (a) {
      var g = a.topico.split('.')[0];
      if (!saida.some(function (x) { return x.id === g; })) saida.push({ id: g, nome: partes(a).grupo });
    });
    return saida;
  }
  function topicos(g) {
    var saida = [];
    catalogo().forEach(function (a) {
      if (a.topico.split('.')[0] === g && !saida.some(function (x) { return x.id === a.topico; })) saida.push({ id: a.topico, nome: partes(a).topico });
    });
    return saida;
  }
  function proximoCodigo(topico) {
    var maior = 0;
    App.atividadesDoTrecho().forEach(function (a) {
      var resto = a.codigo.slice(topico.length + 1);
      if (a.topico === topico && /^\d+$/.test(resto)) maior = Math.max(maior, +resto);
    });
    return topico + '.' + (maior + 1);
  }
  function desenharAdd() {
    var box = $('addp'), E = App.E, A = E.add;
    var aberto = E.addAberto && E.canteiro !== App.TODOS && App.podeEditar();
    box.hidden = !aberto;
    if (!aberto) { box.innerHTML = ''; return; }
    var tops = A.g ? topicos(A.g) : [];
    var ativs = catalogo().filter(function (a) { return a.topico === A.t; });
    var unidades = [];
    App.atividadesDoTrecho().forEach(function (a) { if (unidades.indexOf(a.unidade) < 0) unidades.push(a.unidade); });
    var h = '<label for="ad-g">Grupo</label><select id="ad-g"><option value="">Escolha…</option>' + grupos().map(function (g) {
      return '<option value="' + esc(g.id) + '"' + (A.g === g.id ? ' selected' : '') + '>' + esc(g.id + ' ' + g.nome) + '</option>';
    }).join('') + '</select>' +
      '<label for="ad-t">Tópico</label><select id="ad-t"' + (A.g ? '' : ' disabled') + '><option value="">Escolha…</option>' + tops.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (A.t === t.id ? ' selected' : '') + '>' + esc(t.id + ' ' + t.nome) + '</option>';
      }).join('') + '</select>';
    if (!A.avulsa) {
      h += '<label for="ad-a">Atividade</label><select id="ad-a"' + (A.t ? '' : ' disabled') + '><option value="">Escolha…</option>' + ativs.map(function (a) {
        var ja = App.visivel(E.canteiro, a.id);
        return '<option value="' + a.id + '"' + (ja ? ' disabled' : '') + (String(A.a) === String(a.id) ? ' selected' : '') + '>' +
          esc(a.codigo + ' ' + a.nome) + (ja ? ' (já na planilha)' : '') + '</option>';
      }).join('') + '</select>';
    } else {
      h += '<label for="ad-n">Nova atividade' + (A.t ? ' ' + proximoCodigo(A.t) : '') + '</label><input type="text" id="ad-n" placeholder="Nome da atividade avulsa"' + (A.t ? '' : ' disabled') + '>' +
        '<select id="ad-u" aria-label="Unidade">' + unidades.map(function (u) { return '<option>' + esc(u) + '</option>'; }).join('') + '</select>';
    }
    h += '<label class="ck"><input type="checkbox" id="ad-av"' + (A.avulsa ? ' checked' : '') + '> Atividade avulsa (fora da lista)</label>' +
      '<button class="rb main" id="ad-ok">Adicionar</button><button class="rb" id="ad-x">Fechar</button>';
    box.innerHTML = h;
  }
  function adicionar() {
    var E = App.E, A = E.add, c = E.canteiro;
    if (!App.podeEditar()) return;
    function poe(aid) {
      var a = App.ativ(aid);
      App.gravarVisibilidade(c, aid, true);
      A.a = ''; E.sel = null;
      App.render();
      var r = -1;
      E.nav.forEach(function (n, i) { if (r < 0 && n.aid === aid) r = i; });
      if (r >= 0) Planilha.seleciona(r, 1);
      App.toast(a.codigo + ' ' + a.nome + ' adicionada à planilha.');
    }
    if (A.avulsa) {
      var nome = ($('ad-n') && $('ad-n').value || '').trim();
      if (!A.t || !nome) { App.toast('Escolha o grupo e o tópico e dê um nome para a atividade avulsa.'); return; }
      App.criarAvulsa(A.t, nome, $('ad-u').value).then(function (nova) { if (nova) poe(nova.id); })
        .catch(function (err) { App.toast(err.message); });
      return;
    }
    if (!A.a) { App.toast('Escolha o grupo, o tópico e a atividade.'); return; }
    poe(+A.a);
  }

  // ---------- teclado e listas do painel ----------
  document.addEventListener('change', function (ev) {
    var t = ev.target, A = App.E.add;
    if (t.id === 'ad-g') { A.g = t.value; A.t = ''; A.a = ''; desenharAdd(); $('ad-t').focus(); }
    else if (t.id === 'ad-t') { A.t = t.value; A.a = ''; desenharAdd(); var n = $('ad-a') || $('ad-n'); if (n) n.focus(); }
    else if (t.id === 'ad-a') { A.a = t.value; }
    else if (t.id === 'ad-av') { A.avulsa = t.checked; A.a = ''; desenharAdd(); }
    else if (t.dataset && t.dataset.pt) {
      marcadas = [].slice.call(document.querySelectorAll('#pane input[data-pt]'))
        .filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.pt; }).join('');
    }
  });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target, k = ev.key;
    if (t.id === 'ad-n' && k === 'Enter') { ev.preventDefault(); $('ad-ok').click(); return; }
    if (!(t.closest && t.closest('#pane'))) return;
    if (k === 'Escape') { t.blur(); return; }
    if (k !== 'Enter' || ev.shiftKey) return;
    if (t.id === 'cm') { ev.preventDefault(); salvar(); redesenhaTudo(); App.toast('Comentário salvo.'); }
    else if (t.id === 'p-t') { ev.preventDefault(); $('p-add-t').click(); }
    else if (t.id === 'p-de') { ev.preventDefault(); $('p-ate').focus(); }
    else if (t.id === 'p-ate') { ev.preventDefault(); $('p-add-i').click(); }
    else if (t.id === 'p-enc') { ev.preventDefault(); salvar(); redesenhaTudo(); Planilha.move(1, 0); }
  });

  return { desenhar: desenhar, desenharAdd: desenharAdd, salvar: salvar, foco: foco, apagar: apagar, clique: clique, copiar: copiar, colar: colar };
})();
