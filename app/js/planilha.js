// A FOLHA: desenha a planilha, cuida da seleção, das larguras e das alturas.
// Especificação: seções 3, 6, 8, 9 e 10. Portado do protótipo aprovado, com estas diferenças:
//   - o total da linha em negrito do consolidado usa a UNIÃO das torres dos canteiros, não a soma;
//   - as abas de trecho funcionam para quantos trechos a base tiver;
//   - o cabeçalho é montado a partir da configuração e do trecho, sem texto da obra no código;
//   - larguras e alturas ficam guardadas no navegador de cada pessoa, por trecho.
var Planilha = (function () {
  var LETRAS = 'ABCDEFGHIJKLMNOPQ';
  var LIN = 0;      // número da linha na margem, contado enquanto a folha é montada
  var med = null;   // larguras e alturas do trecho aberto
  function esc(s) { return App.esc(s); }
  function $(id) { return document.getElementById(id); }

  // ---------- larguras e alturas ----------
  function medidas() {
    var id = App.E.trecho.id;
    if (med && med.trecho === id) return med;
    var salvo = null;
    try { salvo = JSON.parse(localStorage.getItem('rpsq-medidas-' + id) || 'null'); } catch (e) { salvo = null; }
    med = { trecho: id, colW: salvo && salvo.colW && salvo.colW.length === LETRAS.length ? salvo.colW : null,
            rowH: (salvo && salvo.rowH) || {} };
    return med;
  }
  function guardaMedidas() {
    var m = medidas();
    try { localStorage.setItem('rpsq-medidas-' + m.trecho, JSON.stringify({ colW: m.colW, rowH: m.rowH })); } catch (e) { /* navegador sem armazenamento */ }
  }
  // os dias dividem o espaço que sobra na tela
  function largPadrao() {
    var fix = [56, 190, 52, 112, 112, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 60];
    var area = $('area');
    var livre = ((area && area.clientWidth) || 1400) - 66 - fix.reduce(function (s, x) { return s + x; }, 0);
    var d = Math.max(100, Math.floor(livre / 7));
    return fix.map(function (x) { return x || d; });
  }
  function larg() { var m = medidas(); if (!m.colW) m.colW = largPadrao(); return m.colW; }

  // ---------- partes da folha ----------
  // abre uma linha já com o número dela na margem e a alça de altura
  function tr(chave, cls, tag) {
    tag = tag || 'td';
    var h = medidas().rowH[chave];
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + (h ? ' style="height:' + h + 'px"' : '') + '><' + tag + ' class="gut">' +
      (++LIN) + '<span class="rzr" data-rh="' + esc(chave) + '"></span></' + tag + '>';
  }
  function abreTabela() {
    LIN = 0;
    var w = larg();
    return '<table class="sheet" style="width:' + (30 + w.reduce(function (s, x) { return s + x; }, 0)) + 'px"><colgroup><col style="width:30px">' +
      w.map(function (x) { return '<col style="width:' + x + 'px">'; }).join('') + '</colgroup>' + thead();
  }
  function thead() {
    var h = '<thead><tr class="abc"><th class="gut"></th>' + LETRAS.split('').map(function (c, i) {
      return '<th>' + c + '<span class="rz" data-col="' + i + '"></span></th>';
    }).join('') + '</tr>';
    h += tr('h0', '', 'th') + '<th rowspan="4">ITEM</th><th colspan="2">ATIVIDADE</th><th rowspan="4">TAREFA</th><th rowspan="4">ENCARREGADO</th>' +
      App.DIASX.map(function (d) { return '<th>' + d + '</th>'; }).join('') +
      '<th rowspan="4">TOTAL SEMANAL</th><th rowspan="4">TOTAL PREVISTO</th><th rowspan="4">ACUM. ATUAL</th><th rowspan="4">QUANT. FALTA</th><th rowspan="4">% EXEC.</th></tr>';
    App.TIPOS.forEach(function (t) {
      h += tr('h' + (t.n + 1), '', 'th') + '<th>' + t.hd + '</th>' + (t.n === 0 ? '<th rowspan="3">UNID.</th>' : '') +
        App.DIAS.map(function (d, i) { return '<th>' + App.ddmm(App.data(t.k, i)) + '</th>'; }).join('') + '</tr>';
    });
    return h + '</thead>';
  }
  function cabecalho() {
    var cfg = App.E.base.config, s = App.E.semana, c = App.E.canteiro;
    return '<div class="head"><h1>RELATÓRIO DE PROGRAMAÇÃO SEMANAL &nbsp;·&nbsp; ' + esc(App.E.trecho.nomeLt) + '</h1>' +
      '<p><span><b>CONTRATANTE:</b> ' + esc(cfg.contratante) + '</span><span><b>CONTRATADA:</b> ' + esc(cfg.contratada) + '</span>' +
      '<span><b>CONTRATO Nº</b> ' + esc(cfg.contrato) + '</span><span><b>Data:</b> ' + App.ddmmaaaa(s.inicio) + '</span>' +
      '<span><b>Revisão:</b> ' + (s.revisao || 0) + '</span>' +
      (c !== App.TODOS ? '<span><b>Canteiro:</b> ' + esc(App.cant(c).nome.toUpperCase()) + '</span>' : '') + '</p></div>';
  }
  // TOTAL PREVISTO e ACUM. ATUAL são digitados; QUANT. FALTA e % EXEC. são calculados
  function calculados(a) {
    var c = App.controle(a.id), ok = c.previsto != null && c.acumulado != null && c.previsto > 0;
    return { falta: ok ? App.fmtNum(c.previsto - c.acumulado, a.unidade) : '', pct: ok ? Math.round(c.acumulado / c.previsto * 100) + '%' : '' };
  }
  function colControle(a, rs) {
    var c = App.controle(a.id), so = App.podeEditar() ? '' : ' readonly', k = calculados(a);
    function campo(nome, rotulo) {
      return '<td class="in" rowspan="' + rs + '"><input type="text" inputmode="decimal" aria-label="' + rotulo + ' de ' + esc(a.codigo) + '"' +
        ' data-ctl="' + a.id + '|' + nome + '" value="' + esc(App.fmtNum(c[nome], a.unidade)) + '"' + so + '></td>';
    }
    return campo('previsto', 'Total previsto') + campo('acumulado', 'Acumulado atual') +
      '<td class="calc" rowspan="' + rs + '" data-falta="' + a.id + '">' + k.falta + '</td>' +
      '<td class="calc" rowspan="' + rs + '" data-pct="' + a.id + '">' + k.pct + '</td>';
  }
  function atualizaControle(aid) {
    var a = App.ativ(aid), k = calculados(a), c = App.controle(aid);
    document.querySelectorAll('[data-falta="' + aid + '"]').forEach(function (td) { td.textContent = k.falta; });
    document.querySelectorAll('[data-pct="' + aid + '"]').forEach(function (td) { td.textContent = k.pct; });
    ['previsto', 'acumulado'].forEach(function (n) {
      var el = document.querySelector('[data-ctl="' + aid + '|' + n + '"]');
      if (el) { el.value = App.fmtNum(c[n], a.unidade); el.defaultValue = el.value; }
    });
  }
  function porTopico(ativs) {
    var m = [];
    ativs.forEach(function (a) {
      var g = m.filter(function (x) { return x.topico === a.topico; })[0];
      if (!g) { g = { topico: a.topico, nome: a.nomeTopico, ativs: [] }; m.push(g); }
      g.ativs.push(a);
    });
    return m;
  }
  function faixaTopico(g) {
    return tr('tp' + g.topico, 'tp') + '<td>' + esc(g.topico) + '</td><td colspan="16">' + esc(g.nome) + '</td></tr>';
  }
  function nomeAtividade(a, botaoOcultar) {
    return esc(a.nome) + (a.avulsa ? '<span class="tag">avulsa</span>' : '') +
      (botaoOcultar ? '<button class="hide" data-hide="' + a.id + '">ocultar</button>' : '');
  }
  function dsr(i) { return i === 6 ? '<span class="dsr">DSR</span>' : ''; }

  // ---------- folha de um canteiro (editável) ----------
  function folhaCanteiro() {
    var c = App.E.canteiro, r = App.regras(), ed = App.podeEditar(), nav = [];
    var h = abreTabela() + '<tbody>';
    var grupos = porTopico(App.visiveis(c));
    if (!grupos.length) {
      h += tr('vz') + '<td class="vazio" colspan="17">Nenhuma atividade na planilha do canteiro ' + esc(App.cant(c).nome) + '.' +
        (ed ? ' Use o botão Adicionar atividade.' : '') + '</td></tr>';
    }
    grupos.forEach(function (g) {
      h += faixaTopico(g);
      g.ativs.forEach(function (a) {
        App.TIPOS.forEach(function (tp) {
          var ri = nav.length;
          nav.push({ aid: a.id, tipo: tp.k, n: tp.n });
          h += tr(a.id + tp.k);
          if (tp.n === 0) h += '<td rowspan="3">' + esc(a.codigo) + '</td><td rowspan="3" class="l">' + nomeAtividade(a, ed) + '</td><td rowspan="3">' + esc(a.unidade) + '</td>';
          var enc = App.encarregado(c, a.id, tp.k), falta = !enc && App.temTorres(c, a.id, tp.k);
          h += '<td>' + tp.tar + '</td><td class="c' + (falta ? ' falta' : '') + '" data-r="' + ri + '" data-c="0">' +
            (falta ? '<span class="obr">obrigatório</span>' : esc(enc)) + '</td>';
          var listas = [];
          for (var i = 0; i < 7; i++) {
            var x = App.cel(c, a.id, tp.k, i), txt = Regras.celTexto(r, a, x.torres), cls = 'c';
            listas.push(x.torres);
            if (tp.k === 'E' && x.aConfirmar && x.torres.length) cls += ' pend';
            if (x.comentario) cls += ' cm';
            h += '<td class="' + cls + '" data-r="' + ri + '" data-c="' + (i + 1) + '"' + (x.comentario ? ' title="Comentário: ' + esc(x.comentario) + '"' : '') + '>' +
              (txt ? esc(txt) : dsr(i)) + '</td>';
          }
          h += '<td class="calc">' + Regras.formatarTotal(Regras.celTotal(r, a, listas), a.unidade) + '</td>';
          if (tp.n === 0) h += colControle(a, 3);
          h += '</tr>';
        });
      });
    });
    App.E.nav = nav;
    return h + '</tbody></table>';
  }

  // ---------- folha consolidada (todos os canteiros, só leitura) ----------
  // canteiros com lançamento (torres ou comentário) numa linha de uma atividade.
  // Usada também pela exportação (excel.js), com o trecho de cada aba.
  function linhasDe(a, tp, trecho) {
    return App.canteirosDoTrecho(trecho).map(function (ct) {
      if (!App.visivel(ct.id, a.id)) return null;
      var cels = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return App.cel(ct.id, a.id, tp.k, i); });
      if (!cels.some(function (x) { return x.torres.length || x.comentario; })) return null;
      return { ct: ct, cels: cels };
    }).filter(Boolean);
  }
  function folhaTodos() {
    var r = App.regras(), algum = false;
    App.E.nav = [];
    var h = abreTabela() + '<tbody>';
    porTopico(App.atividadesDoTrecho()).forEach(function (g) {
      var marca = LIN, cab = faixaTopico(g), corpo = '';
      g.ativs.forEach(function (a) {
        var blocos = App.TIPOS.map(function (tp) { return { tp: tp, linhas: linhasDe(a, tp) }; })
          .filter(function (b) { return b.linhas.length; });
        if (!blocos.length) return;
        var nRows = blocos.reduce(function (s, b) { return s + 1 + b.linhas.length; }, 0), primeiro = true;
        blocos.forEach(function (b) {
          var dias = [], todas = [];
          for (var i = 0; i < 7; i++) {
            var listas = b.linhas.map(function (l) { return l.cels[i].torres; });
            todas = todas.concat(listas);
            var u = Regras.celUniao(r, a, listas);
            dias.push(u.length ? Regras.celTexto(r, a, u) : (i === 6 ? 'DSR' : ''));
          }
          var encs = [];
          b.linhas.forEach(function (l) { var e = App.encarregado(l.ct.id, a.id, b.tp.k); if (e && encs.indexOf(e) < 0) encs.push(e); });
          corpo += tr('T' + a.id + b.tp.k, 'blk');
          if (primeiro) corpo += '<td class="pl" rowspan="' + nRows + '">' + esc(a.codigo) + '</td><td rowspan="' + nRows + '" class="l pl">' + nomeAtividade(a, false) + '</td><td class="pl" rowspan="' + nRows + '">' + esc(a.unidade) + '</td>';
          corpo += '<td>' + b.tp.xl + '</td><td>' + esc(encs.join(' / ')) + '</td>' +
            dias.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') +
            '<td class="calc">' + Regras.formatarTotal(Regras.celTotal(r, a, todas), a.unidade) + '</td>';
          if (primeiro) { corpo += colControle(a, nRows); primeiro = false; }
          corpo += '</tr>';
          b.linhas.forEach(function (l) {
            var enc = App.encarregado(l.ct.id, a.id, b.tp.k);
            var falta = !enc && l.cels.some(function (x) { return x.torres.length; });
            corpo += tr('T' + a.id + b.tp.k + 'c' + l.ct.id) + '<td>' + esc(l.ct.nome.toUpperCase()) + '</td>' +
              (falta ? '<td class="c ro falta"><span class="obr">obrigatório</span></td>' : '<td>' + esc(enc) + '</td>');
            l.cels.forEach(function (x, i) {
              // aviso de conflito: a mesma torre (ou a mesma parte dela) lançada por outro canteiro no mesmo dia
              var dicas = [], quem = {};
              b.linhas.forEach(function (o) {
                if (o === l) return;
                r.emComum([x.torres, o.cels[i].torres]).forEach(function (t) { (quem[t] = quem[t] || []).push(o.ct.nome); });
              });
              r.ordenar(Object.keys(quem)).forEach(function (t) {
                dicas.push('Conferir: a torre ' + t + ' também está lançada por ' + quem[t].join(', '));
              });
              var conflito = dicas.length > 0;
              if (x.comentario) dicas.push('Comentário: ' + x.comentario);
              var sk = l.ct.id + '|' + a.id + '|' + b.tp.k + '|' + i, txt = Regras.celTexto(r, a, x.torres);
              corpo += '<td class="c ro' + (conflito ? ' w' : '') + (x.comentario ? ' cm' : '') + (App.E.ssel === sk ? ' sel' : '') + '" data-sk="' + sk + '"' +
                (dicas.length ? ' title="' + esc(dicas.join(' | ')) + '"' : '') + '>' + (txt ? esc(txt) : dsr(i)) + '</td>';
            });
            corpo += '<td class="calc">' + Regras.formatarTotal(Regras.celTotal(r, a, l.cels.map(function (x) { return x.torres; })), a.unidade) + '</td></tr>';
          });
        });
      });
      if (corpo) { algum = true; h += cab + corpo; } else LIN = marca;
    });
    if (!algum) h += tr('vz') + '<td class="vazio" colspan="17">Nenhum lançamento nos canteiros.</td></tr>';
    return h + '</tbody></table>';
  }

  // ---------- Observações, rodapé e abas ----------
  function observacoes() {
    var todos = App.E.canteiro === App.TODOS, r = App.regras(), ed = App.podeEditar(), its = [];
    var cants = todos ? App.canteirosDoTrecho() : [App.cant(App.E.canteiro)];
    cants.forEach(function (ct) {
      App.visiveis(ct.id).forEach(function (a) {
        App.TIPOS.forEach(function (tp) {
          for (var i = 0; i < 7; i++) {
            var x = App.cel(ct.id, a.id, tp.k, i);
            if (!x.comentario) continue;
            var txt = Regras.celTexto(r, a, x.torres);
            its.push('<li><b>' + esc(a.codigo + ' ' + a.nome) + '</b> · ' + (todos ? esc(ct.nome) + ' · ' : '') + tp.tar + ' · ' +
              App.DIAS[i] + ' ' + App.ddmm(App.data(tp.k, i)) + (txt ? ' (' + esc(txt) + ')' : '') + ': ' + esc(x.comentario) +
              (ed ? ' <button class="rm" data-rmcom="' + ct.id + '|' + a.id + '|' + tp.k + '|' + i + '">remover</button>' : '') + '</li>');
          }
        });
      });
    });
    return '<div class="obs"><b>OBSERVAÇÕES:</b>' + (its.length ? '<ol>' + its.join('') + '</ol>' : '') + '</div>';
  }
  function rodape() {
    var pode = App.ehAdmin() && App.E.conectado;
    return '<div class="foot"><span><b>ELABORADO:</b> <input type="text" id="f-elab" aria-label="Elaborado por" value="' +
      esc(App.E.semana.elaboradoPor || '') + '"' + (pode ? '' : ' readonly') + '></span><span><b>GERÊNCIA DA OBRA:</b></span></div>';
  }
  function abas() {
    var h = App.E.base.trechos.map(function (t) {
      return '<button data-trecho="' + esc(t.id) + '" aria-pressed="' + (t === App.E.trecho) + '">' + esc(t.id + ' ' + t.sigla) + '</button>';
    }).join('');
    var oc = 0, c = App.E.canteiro;
    if (c !== App.TODOS && App.E.semana) {
      App.atividadesDoTrecho().forEach(function (a) {
        if (!App.visivel(c, a.id) && App.TIPOS.some(function (tp) { return App.temTorres(c, a.id, tp.k); })) oc++;
      });
    }
    h += '<span class="lg">' + (oc ? '<span>' + oc + (oc === 1 ? ' atividade oculta' : ' atividades ocultas') + ' com lançamentos (não saem no Excel)</span>' : '') +
      '<span><i class="sw" style="background:#FFF2CC"></i>a confirmar</span><span><i class="sw" style="background:#F2F2F2"></i>calculado</span>' +
      '<span><i class="tri" style="border-top-color:#C00000;border-right:0;border-left:8px solid transparent"></i>comentário</span>' +
      '<span><i class="tri"></i>mesma torre em dois canteiros</span></span>';
    $('tabs').innerHTML = h;
  }

  // ---------- desenho ----------
  function desenhar() {
    var E = App.E;
    if (!E.semana) {
      $('paper').innerHTML = '<div class="head"><h1>RELATÓRIO DE PROGRAMAÇÃO SEMANAL</h1></div><p class="vazio-geral">Nenhuma semana aberta.' +
        (App.ehAdmin() ? ' Use o botão Abrir semana nova.' : ' O administrador precisa abrir a primeira semana.') + '</p>';
      abas();
      return;
    }
    // a seleção é guardada pela linha da planilha; se as linhas mudarem, ela acompanha a mesma atividade
    var antes = E.sel && E.nav[E.sel.r], antesFim = E.sel && E.selFim && E.nav[E.selFim.r];
    $('paper').innerHTML = cabecalho() + (E.canteiro === App.TODOS ? folhaTodos() : folhaCanteiro()) + observacoes() + rodape();
    if (antes) {
      var r = -1;
      E.nav.forEach(function (n, i) { if (r < 0 && n.aid === antes.aid && n.tipo === antes.tipo) r = i; });
      E.sel = r >= 0 ? { r: r, c: E.sel.c } : null;
    }
    if (antesFim && E.sel) {
      var rf = -1;
      E.nav.forEach(function (n, i) { if (rf < 0 && n.aid === antesFim.aid && n.tipo === antesFim.tipo) rf = i; });
      E.selFim = rf >= 0 ? { r: rf, c: E.selFim.c } : null;
    } else E.selFim = null;
    abas();
    aplicaSel();
    marcaCopia();
  }
  // borda tracejada em volta das células copiadas (Ctrl+C), como no Excel; some com Esc ou com uma nova cópia
  function marcaCopia() {
    var E = App.E, k = E.copiada, paper = $('paper');
    var velha = document.querySelector('.marca-copia');
    if (velha) velha.parentNode.removeChild(velha);
    if (!k || !E.semana || k.semana !== E.semana.inicio || !paper) return;
    var a = null, b = null;
    if (E.canteiro === App.TODOS) {
      if (k.linhas.length === 1 && k.c1 === k.c2 && k.c1 > 0) {
        a = b = document.querySelector('td[data-sk="' + k.c + '|' + k.linhas[0].aid + '|' + k.linhas[0].tipo + '|' + (k.c1 - 1) + '"]');
      }
    } else if (E.canteiro === k.c) {
      var rs = k.linhas.map(function (l) {
        var r = -1;
        E.nav.forEach(function (n, i) { if (r < 0 && n.aid === l.aid && n.tipo === l.tipo) r = i; });
        return r;
      });
      if (rs.every(function (r) { return r >= 0; })) {
        var r1 = Math.min.apply(null, rs), r2 = Math.max.apply(null, rs);
        a = document.querySelector('td[data-r="' + r1 + '"][data-c="' + k.c1 + '"]');
        b = document.querySelector('td[data-r="' + r2 + '"][data-c="' + k.c2 + '"]');
      }
    }
    if (!a || !b) return;
    var pr = paper.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var m = document.createElement('div');
    m.className = 'marca-copia';
    m.style.left = (ra.left - pr.left - paper.clientLeft) + 'px';
    m.style.top = (ra.top - pr.top - paper.clientTop) + 'px';
    m.style.width = (rb.right - ra.left) + 'px';
    m.style.height = (rb.bottom - ra.top) + 'px';
    paper.appendChild(m);
  }
  function redesenhar() {
    var area = $('area'), x = area.scrollLeft, y = area.scrollTop;
    desenhar();
    area.scrollLeft = x; area.scrollTop = y;
  }

  // ---------- seleção ----------
  // E.sel é a célula ativa (a do painel); E.selFim, quando existe, é o outro canto de uma seleção de
  // várias células (Shift+clique, Shift+setas ou arrastar com o mouse), como no Excel.
  function selTd() {
    var s = App.E.sel;
    return s ? document.querySelector('td[data-r="' + s.r + '"][data-c="' + s.c + '"]') : null;
  }
  function faixaSel() {
    var E = App.E, s = E.sel;
    if (!s || E.canteiro === App.TODOS) return null;
    var f = E.selFim || s;
    return { r1: Math.min(s.r, f.r), r2: Math.max(s.r, f.r), c1: Math.min(s.c, f.c), c2: Math.max(s.c, f.c) };
  }
  function aplicaSel() {
    document.querySelectorAll('td.c.sel[data-r], td.rng').forEach(function (t) { t.classList.remove('sel'); t.classList.remove('rng'); });
    var td = selTd(), f = faixaSel(), E = App.E;
    if (f && (f.r1 !== f.r2 || f.c1 !== f.c2)) {
      for (var r = f.r1; r <= f.r2; r++) for (var c = f.c1; c <= f.c2; c++) {
        var x = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
        if (x) x.classList.add('rng');
      }
    }
    if (td) td.classList.add('sel');
    var ver = E.selFim ? document.querySelector('td[data-r="' + E.selFim.r + '"][data-c="' + E.selFim.c + '"]') : td;
    if (ver) { try { ver.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* navegador antigo */ } }
  }
  // estender = true: muda só o outro canto da seleção
  function seleciona(r, c, estender) {
    var E = App.E;
    if (estender && E.sel) E.selFim = (r === E.sel.r && c === E.sel.c) ? null : { r: r, c: c };
    else { E.sel = { r: r, c: c }; E.selFim = null; }
    aplicaSel(); App.faixa();
  }
  function selecionaFaixa(r1, c1, r2, c2) {
    App.E.sel = { r: r1, c: c1 };
    App.E.selFim = (r1 === r2 && c1 === c2) ? null : { r: r2, c: c2 };
  }
  function move(dr, dc, estender) {
    var E = App.E, s = E.sel, n = E.nav.length;
    if (!s || !n) return;
    var base = estender && E.selFim ? E.selFim : s;
    seleciona(Math.max(0, Math.min(n - 1, base.r + dr)), Math.max(0, Math.min(7, base.c + dc)), estender);
  }

  // dois cliques na borda da letra: largura da coluna pelo maior conteúdo
  function autoLargura(i) {
    var t = document.querySelector('table.sheet');
    if (!t) return;
    var alvo = i + 1, max = 30, ocup = [];
    var cv = autoLargura.cv || (autoLargura.cv = document.createElement('canvas').getContext('2d'));
    Array.prototype.forEach.call(t.rows, function (row, ri) {
      var col = 0;
      Array.prototype.forEach.call(row.cells, function (cell) {
        while (ocup[col] > ri) col++;
        var cs = cell.colSpan || 1, rs = cell.rowSpan || 1;
        for (var k = 0; k < cs; k++) ocup[col + k] = ri + rs;
        if (col === alvo && cs === 1 && !row.classList.contains('abc')) {
          var inp = cell.querySelector('input');
          var txt = inp ? inp.value : (cell.children.length && cell.firstChild && cell.firstChild.nodeType === 3 ? cell.firstChild.textContent : cell.textContent);
          var st = getComputedStyle(cell);
          cv.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
          max = Math.max(max, Math.ceil(cv.measureText((txt || '').trim()).width) + 14);
        }
        col += cs;
      });
    });
    larg()[i] = Math.min(520, max);
    guardaMedidas();
    redesenhar();
  }

  // ---------- eventos da folha ----------
  function clique(b) {
    var d = b.dataset;
    if (d.trecho) { App.trocarTrecho(d.trecho); return true; }
    if (d.hide) {
      var a = App.ativ(+d.hide);
      App.gravarVisibilidade(App.E.canteiro, a.id, false);
      App.E.sel = null;
      redesenhar(); App.faixa();
      App.toast(a.codigo + ' ocultada. Para trazer de volta, use Adicionar atividade.');
      return true;
    }
    if (d.rmcom) {
      var p = d.rmcom.split('|');
      App.gravarCelula(+p[0], +p[1], p[2], +p[3], { comentario: '' });
      redesenhar(); App.faixa();
      App.toast('Comentário removido.');
      return true;
    }
    return false;
  }
  var arrastando = false;
  document.addEventListener('mousedown', function (ev) {
    var td = ev.target.closest && ev.target.closest('td[data-r]');
    if (td && App.E.canteiro !== App.TODOS) {
      Painel.salvar();
      seleciona(+td.dataset.r, +td.dataset.c, ev.shiftKey && !!App.E.sel);
      arrastando = ev.button === 0;
      return;
    }
    var sk = ev.target.closest && ev.target.closest('td[data-sk]');
    if (sk) {
      App.E.ssel = sk.dataset.sk;
      document.querySelectorAll('td.c.sel').forEach(function (t) { t.classList.remove('sel'); });
      sk.classList.add('sel');
      App.faixa();
    }
  });
  // arrastar com o botão apertado estende a seleção
  document.addEventListener('mouseover', function (ev) {
    if (!arrastando) return;
    if (!(ev.buttons & 1)) { arrastando = false; return; }
    var td = ev.target.closest && ev.target.closest('td[data-r]'), E = App.E;
    if (!td || !E.sel) return;
    var r = +td.dataset.r, c = +td.dataset.c, f = E.selFim || E.sel;
    if (r !== f.r || c !== f.c) seleciona(r, c, true);
  });
  document.addEventListener('mouseup', function () { arrastando = false; });
  document.addEventListener('dblclick', function (ev) {
    if (ev.target.closest && ev.target.closest('td[data-r]') && App.E.canteiro !== App.TODOS) Painel.foco();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.getAttribute('data-ctl')) {
      var p = t.getAttribute('data-ctl').split('|'), aid = +p[0], v = App.num(t.value);
      if (v === undefined) { App.toast('Digite um número, por exemplo 12,5.'); t.value = t.defaultValue; return; }
      App.gravarControle(aid, p[1], v);
      atualizaControle(aid);
    } else if (t.id === 'f-elab') {
      t.defaultValue = t.value;
      App.gravarSemana({ elaboradoPor: t.value.trim() });
    }
  });

  // arrastar as bordas: largura das colunas e altura das linhas
  var DRAG = null, ULT = { k: '', t: 0 };
  document.addEventListener('pointerdown', function (ev) {
    var z = ev.target.closest && ev.target.closest('.rz,.rzr');
    if (!z) return;
    ev.preventDefault();
    // dois cliques na borda: ajuste automático
    var chave = z.classList.contains('rz') ? 'c' + z.dataset.col : 'r' + z.dataset.rh, agora = Date.now();
    if (ULT.k === chave && agora - ULT.t < 450) {
      ULT = { k: '', t: 0 }; DRAG = null; document.body.style.cursor = '';
      if (chave[0] === 'c') autoLargura(+z.dataset.col);
      else { delete medidas().rowH[z.dataset.rh]; guardaMedidas(); redesenhar(); }
      return;
    }
    ULT = { k: chave, t: agora };
    if (z.classList.contains('rz')) { var i = +z.dataset.col; DRAG = { t: 'c', i: i, x: ev.clientX, w: larg()[i] }; }
    else { var linha = z.closest('tr'); DRAG = { t: 'r', key: z.dataset.rh, linha: linha, y: ev.clientY, h: linha.getBoundingClientRect().height }; }
    document.body.style.cursor = DRAG.t === 'c' ? 'col-resize' : 'row-resize';
  });
  document.addEventListener('pointermove', function (ev) {
    if (!DRAG) return;
    if (DRAG.t === 'c') {
      var w = Math.max(30, Math.round(DRAG.w + ev.clientX - DRAG.x)), cw = larg();
      cw[DRAG.i] = w;
      var cols = document.querySelectorAll('table.sheet col');
      if (cols[DRAG.i + 1]) cols[DRAG.i + 1].style.width = w + 'px';
      var t = document.querySelector('table.sheet');
      if (t) t.style.width = (30 + cw.reduce(function (s, x) { return s + x; }, 0)) + 'px';
    } else {
      var h = Math.max(18, Math.round(DRAG.h + ev.clientY - DRAG.y));
      medidas().rowH[DRAG.key] = h;
      DRAG.linha.style.height = h + 'px';
    }
  });
  function soltar() { if (DRAG) { DRAG = null; document.body.style.cursor = ''; guardaMedidas(); } }
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);

  return {
    desenhar: desenhar, redesenhar: redesenhar, seleciona: seleciona, move: move, selTd: selTd,
    faixaSel: faixaSel, selecionaFaixa: selecionaFaixa,
    clique: clique, atualizaControle: atualizaControle, linhasDe: linhasDe, marcaCopia: marcaCopia
  };
})();
