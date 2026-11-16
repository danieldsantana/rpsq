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
  function exemploTorre() {
    var t = App.E.trecho.torres;
    return t.length ? t[Math.floor(t.length / 2)][0] : '';
  }

  // ---------- desenho ----------
  function desenhar() {
    var pn = $('pane'), E = App.E;
    if (E.canteiro === App.TODOS || !E.semana) { pn.hidden = true; pn.innerHTML = ''; return; }
    pn.hidden = false;
    var s = sel(), ed = App.podeEditar(), motivo = App.motivoSoLeitura();
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
    if (ed) {
      h += '<div class="sec"><label for="p-t"><b>Adicionar torre individual</b></label><div class="lin"><input type="text" id="p-t" list="dl-torres" autocomplete="off" placeholder="' + esc(ex) + '">' +
        '<button class="rb" id="p-add-t">Adicionar</button></div>' + (km ? '<p class="dica">Em KM, uma torre sozinha conta o vão à frente dela.</p>' : '') + '</div>';
      h += '<div class="sec"><b>Adicionar um intervalo de torres</b><div class="lin"><label for="p-de">De</label><input type="text" id="p-de" list="dl-torres" autocomplete="off" placeholder="' + esc(ex) + '">' +
        '<label for="p-ate">até</label><input type="text" id="p-ate" list="dl-torres" autocomplete="off"><button class="rb" id="p-add-i">Adicionar</button></div>' +
        (km ? '<p class="dica">Em KM, o intervalo conta os vãos de uma torre até a outra.</p>' : '') + '</div>';
      h += '<div class="erro" id="p-erro" role="alert"></div>';
    }
    var chips = km
      ? r.sequencias(x.torres, 'KM').map(function (sq) {
          return '<span class="chip">' + esc(sq.texto) + (ed ? '<button data-rmr="' + esc(sq.codigos.join(',')) + '" aria-label="Remover o intervalo">×</button>' : '') + '</span>';
        }).join('')
      : r.ordenar(x.torres).map(function (t) {
          return '<span class="chip">' + esc(t) + (ed ? '<button data-rmt="' + esc(t) + '" aria-label="Remover a torre ' + esc(t) + '">×</button>' : '') + '</span>';
        }).join('');
    var n = x.torres.length;
    var q = km ? (n ? Regras.formatarTotal(r.total([x.torres], 'KM'), 'KM') + ' km' : '') : (n ? n + (n === 1 ? ' torre' : ' torres') : '');
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
    var s = sel();
    if (!s || !App.podeEditar()) return;
    if (s.col === 0) App.gravarEncarregado(s.c, s.a.id, s.tipo, '');
    else App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { torres: [] });
    redesenhaTudo();
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
        mudaTorres(x.torres.concat([T]));
        return true;
      }
      if (b.id === 'p-add-i') {
        var A = r.lerTorre($('p-de').value), B = r.lerTorre($('p-ate').value);
        if (!A || !B) return erro('Preencha as duas torres do intervalo, por exemplo ' + exemploTorre() + '.');
        var ruins = [A, B].filter(function (c) { return !r.existe(c); });
        if (ruins.length) return erro(ruins.length === 1 ? 'A torre ' + ruins[0] + ' não existe no trecho ' + App.E.trecho.id + '.' : 'As torres ' + ruins.join(' e ') + ' não existem no trecho ' + App.E.trecho.id + '.');
        mudaTorres(x.torres.concat(r.intervalo(A, B, s.a.unidade)));
        return true;
      }
      if (d.rmt !== undefined) { mudaTorres(x.torres.filter(function (t) { return t !== d.rmt; })); return true; }
      if (d.rmr) { var tira = d.rmr.split(','); mudaTorres(x.torres.filter(function (t) { return tira.indexOf(t) < 0; })); return true; }
      if (b.id === 'p-limpa') { mudaTorres([]); return true; }
      if (b.id === 'p-cm-ok') { redesenhaTudo(); App.toast('Comentário salvo.'); return true; }
      if (b.id === 'p-cm-rm') { App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { comentario: '' }); redesenhaTudo(); return true; }
      if (d.conf) { App.gravarCelula(s.c, s.a.id, s.tipo, s.dia, { aConfirmar: false }); redesenhaTudo(); return true; }
    }
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

  return { desenhar: desenhar, desenharAdd: desenharAdd, salvar: salvar, foco: foco, apagar: apagar, clique: clique };
})();
