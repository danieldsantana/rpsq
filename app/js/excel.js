// EXPORTAÇÃO PARA EXCEL (etapa 3 do plano).
// Especificação: seção 12. Gera UM arquivo com uma aba por trecho; cada aba é a visão "Todos" do trecho
// no layout da planilha molde (larguras, alturas, cores, mesclas e moldura copiadas dela).
// Usa a biblioteca lib/exceljs.min.js (variável global ExcelJS). Os textos do cabeçalho vêm da configuração.
//
// Só entram atividades visíveis e com lançamento, com os mesmos canteiros e a mesma união de torres
// do consolidado da tela (Planilha.linhasDe). QUANT. FALTA e % EXEC. saem como fórmulas.
// Por decisão do usuário, por enquanto o arquivo sai sem logotipos.
//
// App.exportar() confere o encarregado obrigatório antes de chamar gerar().
var Exportacao = (function () {
  var C = 3, V = 22;  // a folha ocupa as colunas C a V
  var LARG = { 1: 2, 2: 10.33, 3: 15.22, 4: 27.55, 5: 27.55, 6: 27.55, 7: 27.55, 8: 7.55, 9: 58.22, 10: 76.33,
               11: 110.66, 12: 110.66, 13: 110.66, 14: 110.66, 15: 115.78, 16: 110.66, 17: 110.66,
               18: 18.66, 19: 20, 20: 20.55, 21: 18.11, 22: 21.55, 23: 2 };
  var LARANJA = 'FFF47C00', AZUL = 'FF003F87', CINZA = 'FFD9D9D9', BRANCO = 'FFFFFFFF', PRETO = 'FF000000';
  var BLOCO = { E: 'EXECUTADO', P1: 'PRIMEIRA SEMANA', P2: 'SEGUNDA SEMANA' };

  function nomeAba(t) { return (t.id + ' ' + t.sigla).replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31); }
  // data sem fuso: o Excel guarda o dia, não a hora
  function dataUtc(iso, dias) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias)); }

  // escreve uma célula com a fonte da planilha (Calibri 26) e o estilo pedido
  // est: { negrito, cor, fundo, h, v, quebra, fmt, b: { top, bottom, left, right } }
  function cel(ws, r, c, valor, est) {
    est = est || {};
    var x = ws.getCell(r, c);
    if (valor !== undefined && valor !== null && valor !== '') x.value = valor;
    x.font = { name: 'Calibri', size: 26, bold: !!est.negrito, color: { argb: est.cor || PRETO } };
    if (est.fundo) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: est.fundo } };
    x.alignment = { horizontal: est.h || 'center', vertical: est.v || 'middle', wrapText: est.quebra !== false };
    if (est.fmt) x.numFmt = est.fmt;
    if (est.b) {
      var b = {};
      ['top', 'bottom', 'left', 'right'].forEach(function (k) { if (est.b[k]) b[k] = { style: est.b[k] }; });
      x.border = b;
    }
    return x;
  }
  function faixa(ws, r, c1, c2, est) { for (var c = c1; c <= c2; c++) cel(ws, r, c, undefined, est); }
  function finas(base) { return { top: 'thin', bottom: base || 'thin', left: 'thin', right: 'thin' }; }

  // altura da linha pelo texto mais longo (a fonte 26 cabe ~0,4 caractere por unidade de largura)
  function altura(textos, minimo) {
    var linhas = 1;
    Object.keys(textos).forEach(function (c) {
      var t = String(textos[c] || ''), cabe = Math.max(4, Math.floor(LARG[c] * 0.4));
      linhas = Math.max(linhas, t.split('\n').reduce(function (s, p) { return s + Math.max(1, Math.ceil(p.length / cabe)); }, 0));
    });
    return Math.max(minimo, linhas * 34 + 12);
  }

  function cabecalho(ws, t) {
    var cfg = App.E.base.config, s = App.E.semana;
    ws.getRow(1).height = 26.25;
    ws.mergeCells(2, 7, 2, 16); ws.mergeCells(3, 7, 3, 16);
    faixa(ws, 2, C, V, { b: { top: 'medium' } });
    cel(ws, 2, 7, 'RELATÓRIO DE PROGRAMAÇÃO SEMANAL', { negrito: true, b: { top: 'medium' } });
    faixa(ws, 3, C, V, {});
    cel(ws, 3, 7, t.nomeLt, { negrito: true, v: 'top' });
    [[2, 49.5], [3, 49.35], [4, 13.5], [5, 30.6], [6, 30.6], [7, 30.6], [8, 24]].forEach(function (x) { ws.getRow(x[0]).height = x[1]; });
    faixa(ws, 5, C, V, { b: { top: 'medium' }, quebra: false });
    faixa(ws, 6, C, V, { quebra: false });
    faixa(ws, 7, C, V, { b: { bottom: 'thin' }, quebra: false });
    var esq = { h: 'left', quebra: false };
    cel(ws, 5, C, 'CONTRATANTE:', { negrito: true, h: 'left', quebra: false, b: { top: 'medium' } });
    cel(ws, 5, 6, cfg.contratante, { h: 'left', quebra: false, b: { top: 'medium' } });
    cel(ws, 5, 16, 'Data:', { h: 'right', quebra: false, b: { top: 'medium' } });
    cel(ws, 5, 17, dataUtc(s.inicio, 0), { h: 'right', quebra: false, fmt: 'dd/mm/yyyy', b: { top: 'medium' } });
    cel(ws, 6, C, 'CONTRATADA:', { negrito: true, h: 'left', quebra: false });
    cel(ws, 6, 6, cfg.contratada, esq);
    cel(ws, 7, C, 'CONTRATO Nº', { negrito: true, h: 'left', quebra: false, b: { bottom: 'thin' } });
    cel(ws, 7, 6, cfg.contrato, { h: 'left', quebra: false, b: { bottom: 'thin' } });
    cel(ws, 7, 16, 'Revisão:', { h: 'right', quebra: false, b: { bottom: 'thin' } });
    cel(ws, 7, 17, s.revisao || 0, { h: 'right', quebra: false, b: { bottom: 'thin' } });

    // cabeçalho laranja (linhas 9 a 12)
    [[9, 43.35], [10, 49.2], [11, 49.2], [12, 49.2]].forEach(function (x) { ws.getRow(x[0]).height = x[1]; });
    [[9, 3, 12, 3], [9, 4, 9, 8], [9, 9, 12, 9], [9, 10, 12, 10], [10, 4, 10, 7], [10, 8, 12, 8], [11, 4, 11, 7], [12, 4, 12, 7],
     [9, 18, 12, 18], [9, 19, 12, 19], [9, 20, 12, 20], [9, 21, 12, 21], [9, 22, 12, 22]].forEach(function (m) { ws.mergeCells(m[0], m[1], m[2], m[3]); });
    var lar = { negrito: true, cor: BRANCO, fundo: LARANJA, b: finas() };
    for (var r = 9; r <= 12; r++) faixa(ws, r, C, V, lar);
    cel(ws, 9, 3, 'ITEM', lar); cel(ws, 9, 4, 'ATIVIDADE', lar); cel(ws, 9, 9, 'TAREFA', lar); cel(ws, 9, 10, 'ENCARREGADO', lar);
    App.DIASX.forEach(function (d, i) { cel(ws, 9, 11 + i, d, lar); });
    ['TOTAL SEMANAL', 'TOTAL PREVISTO', 'ACUM. ATUAL', 'QUANT. FALTA', '% EXEC.'].forEach(function (x, i) { cel(ws, 9, 18 + i, x, lar); });
    cel(ws, 10, 8, 'UNID.', { negrito: true, cor: BRANCO, fundo: LARANJA, b: finas(), quebra: false });
    App.TIPOS.forEach(function (tp) {
      var r = 10 + tp.n;
      cel(ws, r, 4, tp.hd, lar);
      for (var i = 0; i < 7; i++) {
        cel(ws, r, 11 + i, dataUtc(s.inicio, tp.desloc + i), { cor: BRANCO, fundo: LARANJA, b: finas(), fmt: 'dd/mm/yy' });
      }
    });
  }

  // as atividades do trecho que saem no arquivo, com os blocos de cada uma (mesma regra do consolidado)
  function conteudo(t) {
    var grupos = [];
    App.atividadesDoTrecho(t).forEach(function (a) {
      var blocos = App.TIPOS.map(function (tp) { return { tp: tp, linhas: Planilha.linhasDe(a, tp, t) }; })
        .filter(function (b) { return b.linhas.length; });
      if (!blocos.length) return;
      var g = grupos[grupos.length - 1];
      if (!g || g.topico !== a.topico) { g = { topico: a.topico, nome: a.nomeTopico, ativs: [] }; grupos.push(g); }
      g.ativs.push({ a: a, blocos: blocos });
    });
    return grupos;
  }

  function corpo(ws, t, r) {
    var reg = App.regras(t.id), grupos = conteudo(t);
    if (!grupos.length) {
      ws.mergeCells(r, C, r, V);
      faixa(ws, r, C, V, {});
      cel(ws, r, C, 'Nenhum lançamento neste trecho.', { h: 'left' });
      ws.getRow(r).height = 45;
      return r + 1;
    }
    grupos.forEach(function (g) {
      faixa(ws, r, C, V, { negrito: true, cor: BRANCO, fundo: AZUL, b: { bottom: 'thin' }, quebra: false });
      cel(ws, r, C, g.topico, { negrito: true, cor: BRANCO, fundo: AZUL, h: 'right', quebra: false, b: { bottom: 'thin' } });
      cel(ws, r, 4, g.nome, { negrito: true, cor: BRANCO, fundo: AZUL, h: 'left', quebra: false, b: { bottom: 'thin' } });
      ws.getRow(r).height = 34.5;
      r++;
      g.ativs.forEach(function (it) {
        var a = it.a, km = App.ehKm(a), fmtTot = km ? '0.00' : '0', inicio = r;
        it.blocos.forEach(function (b) {
          // linha do bloco: a união dos canteiros
          var todas = [], textos = {}, encs = [];
          b.linhas.forEach(function (l) { var e = App.encarregado(l.ct.id, a.id, b.tp.k); if (e && encs.indexOf(e) < 0) encs.push(e); });
          var cinza = { fundo: CINZA, b: finas('hair') };
          faixa(ws, r, 9, 18, cinza);
          cel(ws, r, 9, BLOCO[b.tp.k], { negrito: true, fundo: CINZA, b: finas('hair') });
          cel(ws, r, 10, encs.join(' / '), cinza);
          textos[10] = encs.join(' / ');
          for (var i = 0; i < 7; i++) {
            var listas = b.linhas.map(function (l) { return l.cels[i].torres; });
            todas = todas.concat(listas);
            var u = reg.uniao(listas), txt = u.length ? reg.formatar(u, a.unidade) : (i === 6 ? 'DSR' : '');
            cel(ws, r, 11 + i, txt, cinza);
            textos[11 + i] = txt;
          }
          var tot = reg.total(todas, a.unidade);
          cel(ws, r, 18, tot || '', { fundo: CINZA, b: finas('hair'), fmt: fmtTot });
          ws.getRow(r).height = altura(textos, 60);
          r++;
          // uma linha por canteiro
          b.linhas.forEach(function (l) {
            var est = { b: { top: 'hair', bottom: 'hair', left: 'thin', right: 'thin' } }, tx = {};
            faixa(ws, r, 9, 18, est);
            cel(ws, r, 9, l.ct.nome.toUpperCase(), est);
            tx[10] = App.encarregado(l.ct.id, a.id, b.tp.k);
            cel(ws, r, 10, tx[10], est);
            l.cels.forEach(function (x, i) {
              var txt = reg.formatar(x.torres, a.unidade) || (i === 6 ? 'DSR' : '');
              cel(ws, r, 11 + i, txt, { b: est.b, fmt: '@' });
              tx[11 + i] = txt;
            });
            var tc = reg.total(l.cels.map(function (x) { return x.torres; }), a.unidade);
            cel(ws, r, 18, tc || '', { b: est.b, fmt: fmtTot });
            ws.getRow(r).height = altura(tx, 50);
            r++;
          });
        });
        // colunas da atividade, mescladas em todas as linhas dela
        var fim = r - 1, ct = App.controle(a.id), est = { b: finas() };
        [[3, 3], [4, 7], [8, 8], [19, 19], [20, 20], [21, 21], [22, 22]].forEach(function (m) {
          if (fim > inicio || m[1] > m[0]) ws.mergeCells(inicio, m[0], fim, m[1]);
          for (var rr = inicio; rr <= fim; rr++) for (var c = m[0]; c <= m[1]; c++) cel(ws, rr, c, undefined, est);
        });
        cel(ws, inicio, 3, a.codigo, est);
        cel(ws, inicio, 4, a.nome, est);
        cel(ws, inicio, 8, a.unidade, { b: finas(), quebra: false }); // coluna estreita: sem quebra, como no molde
        var num = km ? '0.00' : 'General';
        cel(ws, inicio, 19, ct.previsto, { b: finas(), fmt: num });
        cel(ws, inicio, 20, ct.acumulado, { b: finas(), fmt: num });
        if (ct.previsto != null && ct.acumulado != null) {
          cel(ws, inicio, 21, { formula: 'S' + inicio + '-T' + inicio }, { b: finas(), fmt: num });
          cel(ws, inicio, 22, { formula: 'IF(T' + inicio + '=0,"",T' + inicio + '/S' + inicio + ')' }, { b: finas(), fmt: '0.00%' });
        }
        // base fina separando as atividades
        for (var c = 9; c <= 18; c++) { var x = ws.getCell(fim, c); x.border = Object.assign({}, x.border, { bottom: { style: 'thin' } }); }
      });
    });
    return r;
  }

  function observacoes(ws, t, r) {
    var reg = App.regras(t.id), its = [];
    t.canteiros.forEach(function (ct) {
      App.visiveis(ct.id).forEach(function (a) {
        App.TIPOS.forEach(function (tp) {
          for (var i = 0; i < 7; i++) {
            var x = App.cel(ct.id, a.id, tp.k, i);
            if (!x.comentario) continue;
            var txt = reg.formatar(x.torres, a.unidade);
            its.push(a.codigo + ' ' + a.nome + ' · ' + ct.nome.toUpperCase() + ' · ' + tp.tar + ' · ' + App.DIAS[i] + ' ' +
              App.ddmm(App.data(tp.k, i)) + (txt ? ' (' + txt + ')' : '') + ': ' + x.comentario);
          }
        });
      });
    });
    ws.getRow(r).height = 24; r++;                     // linha em branco
    faixa(ws, r, C, V, {});
    cel(ws, r, C, 'OBSERVAÇÕES:', { negrito: true, h: 'left', quebra: false });
    ws.getRow(r).height = 24.75; r++;
    if (!its.length) its.push('');
    its.forEach(function (texto, k) {
      ws.mergeCells(r, C, r, V);
      var base = k === its.length - 1 ? { bottom: 'medium' } : {};
      faixa(ws, r, C, V, { b: base });
      cel(ws, r, C, texto ? (k + 1) + '. ' + texto : '', { h: 'left', b: base });
      ws.getRow(r).height = Math.max(24.75, Math.ceil(texto.length / 400) * 34 + 6);
      r++;
    });
    return r;
  }

  function rodape(ws, r) {
    faixa(ws, r, C, V, { b: { top: 'medium' }, quebra: false });
    cel(ws, r, C, 'ELABORADO:', { h: 'left', v: 'top', quebra: false, b: { top: 'medium' } });
    cel(ws, r, 13, 'GERÊNCIA DA OBRA:', { h: 'left', quebra: false, b: { top: 'medium' } });
    ws.getRow(r).height = 30; r++;
    faixa(ws, r, C, V, { b: { bottom: 'medium' }, quebra: false });
    cel(ws, r, C, 'NOME: ' + (App.E.semana.elaboradoPor || ''), { h: 'left', quebra: false, b: { bottom: 'medium' } });
    cel(ws, r, 13, 'NOME:', { h: 'left', quebra: false, b: { bottom: 'medium' } });
    ws.getRow(r).height = 33.6;
    return r;
  }

  // borda média à esquerda da coluna C e à direita da coluna V, da linha 2 até a última
  function moldura(ws, ultima) {
    for (var r = 2; r <= ultima; r++) {
      var a = ws.getCell(r, C), b = ws.getCell(r, V);
      a.border = Object.assign({}, a.border, { left: { style: 'medium' } });
      b.border = Object.assign({}, b.border, { right: { style: 'medium' } });
    }
  }

  function aba(wb, t) {
    var ws = wb.addWorksheet(nomeAba(t), {
      views: [{ state: 'frozen', xSplit: 10, ySplit: 12, zoomScale: 30, showGridLines: false }],
      pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                   margins: { left: 0.118, right: 0.118, top: 0.197, bottom: 0.197, header: 0, footer: 0 } }
    });
    Object.keys(LARG).forEach(function (c) { ws.getColumn(+c).width = LARG[c]; });
    cabecalho(ws, t);
    var r = corpo(ws, t, 13);
    r = observacoes(ws, t, r);
    var ultima = rodape(ws, r);
    moldura(ws, ultima);
    ws.pageSetup.printArea = 'C2:V' + ultima;
    return ws;
  }

  // a pasta de trabalho inteira, uma aba por trecho, com a semana aberta na tela
  function montar() {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'RPSQ';
    wb.created = new Date();
    App.E.base.trechos.forEach(function (t) { aba(wb, t); });
    return wb;
  }

  function gerar() {
    var nome = App.nomeArquivo();
    return montar().xlsx.writeBuffer().then(function (buf) {
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      App.toast('Arquivo gerado: ' + nome);
    }).catch(function (err) {
      App.toast('Não foi possível gerar o arquivo: ' + (err && err.message ? err.message : err));
    });
  }

  return { montar: montar, gerar: gerar, nomeAba: nomeAba };
})();
