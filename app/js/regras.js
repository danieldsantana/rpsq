// REGRAS DA CÉLULA. Funções puras: não tocam na tela nem no banco.
// Especificação: seção 4 (regras da célula) e seção 9 (consolidado).
//
// A célula guarda uma LISTA DE CÓDIGOS de torre (é o que vai para rpsq_celulas.torres).
// Em atividade de KM, cada código vale o vão à frente daquela torre.
// O texto mostrado na célula é sempre gerado a partir dessa lista, nunca digitado.
//
// KM (regra em vigor desde 19/11/2026, pedido do usuário): o texto mostra as torres lançadas, como se
// escreve nas planilhas da obra. Duas ou mais seguidas viram "A a B" (B = a última torre lançada), e o
// intervalo "de A até B" inclui as duas pontas, cada uma com o seu vão à frente. Antes, B era a torre
// onde o último vão terminava e o intervalo não incluía o vão de B. O que fica gravado não mudou.
//
// PARTES (fundações, pedido do usuário em 19/11/2026): o item da lista pode trazer as partes lançadas
// da torre, "20/1:AB". As partes são A, B, C e D: os pés de uma autoportante ou os estais de uma
// estaiada. Item sem partes é a torre inteira. No texto: "20/1 (Pés A e B)" na autoportante e
// "20/1 (Estai A)" na estaiada. O total em TORRE conta só as torres completas.
//
// Uso:
//   var r = Regras.criar(trecho.torres);      // torres: [[codigo, familia, tipo, vaoM], ...] na ordem da linha
//   r.existe('5/1')                           -> true/false (aceita '5/1:AB')
//   r.lerTorre(' 05 / 1 ')                    -> '5/1' (o código como está no trecho), ou null se não for torre
//   r.familia('5/1')                          -> 'A' (autoportante), 'E' (estaiada) ou null
//   r.intervalo('5/1', '6/2', unidade)        -> ['5/1','5/2','6/1','6/2']   inclui as pontas (TORRE e KM)
//   r.ordenar(codigos)                        -> na ordem do trecho, sem repetição (partes da mesma torre juntas)
//   r.partesDe(codigos, '5/1')                -> partes lançadas da torre: 'ABCD' (inteira), 'AB'..., ou ''
//   r.sequencias(codigos, unidade)            -> [ { codigos: [...], texto: '5/1 a 6/2' }, ... ]  (etiquetas do painel)
//   r.formatar(codigos, unidade)              -> '5/1 a 6/2, 10/1, 13/1 (Pés A e B)'
//   r.ler(texto, unidade)                     -> { codigos: [...], invalidas: [...], resto: '...' }
//   r.total(listas, unidade)                  -> nº de torres completas diferentes, ou km dos vãos diferentes
//   r.uniao(listas)                           -> torres de todas as listas, uma vez cada (consolidado)
//   r.emComum(listas)                         -> torres com alguma parte em mais de uma lista (conflito)
//   Regras.formatarTotal(valor, unidade)      -> '12' ou '3,45' (vazio quando zero)
//   Regras.junta('5/1', 'BA') -> '5/1:AB'     Regras.junta('5/1', 'ABCD') -> '5/1'
//   Regras.separa('5/1:AB')   -> { torre: '5/1', partes: 'AB' }   (partes null = torre inteira)
//
// Qualquer unidade que não seja 'KM' segue a regra de TORRE.
var Regras = (function () {
  // número, barra, número e, opcionalmente, uma letra no fim (existem torres como 7/1A)
  var PADRAO_TORRE = /^'?\s*(\d+)\s*\/\s*(\d+)\s*([A-Za-z]?)\s*$/;
  // "A a B", "A até B", "A - B"
  var PADRAO_INTERVALO = /^(.+?)(?:\s+(?:a|à|até|ao)\s+|\s*[-–]\s*)(.+)$/i;
  // "20/1 (Pés A e B)", "20/1 (Estai A)"
  var PADRAO_PARTES = /(\d+\s*\/\s*\d+\s*[A-Za-z]?)\s*\(\s*(?:p[ée]s?|estais?)\s+([^)]*)\)/gi;
  var PARTES = 'ABCD';

  // ' 07 / 01a ' -> '7/1A'; null se o texto não tem a forma de um código de torre
  function normalizar(texto) {
    var m = String(texto == null ? '' : texto).match(PADRAO_TORRE);
    if (!m) return null;
    return String(+m[1]) + '/' + String(+m[2]) + m[3].toUpperCase();
  }

  function ehKm(unidade) {
    return String(unidade || '').toUpperCase() === 'KM';
  }

  function formatarTotal(valor, unidade) {
    if (!valor) return '';
    if (ehKm(unidade)) return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(valor);
  }

  function separa(item) {
    var s = String(item == null ? '' : item), k = s.indexOf(':');
    return k < 0 ? { torre: s, partes: null } : { torre: s.slice(0, k), partes: s.slice(k + 1) };
  }

  // só as letras A a D, em ordem e sem repetição
  function limpaPartes(p) {
    var up = String(p || '').toUpperCase();
    return PARTES.split('').filter(function (l) { return up.indexOf(l) >= 0; }).join('');
  }

  // torre inteira (todas as partes, ou partes não informadas) fica só com o código
  function junta(torre, partes) {
    var p = partes == null ? PARTES : limpaPartes(partes);
    return !p || p === PARTES ? torre : torre + ':' + p;
  }

  function criar(torres) {
    var codigos = torres.map(function (t) { return t[0]; });
    var familias = torres.map(function (t) { return t[1]; });
    var vaos = torres.map(function (t) { return Number(t[3]) || 0; });
    var indice = {};
    codigos.forEach(function (c, i) { indice[normalizar(c) || c] = i; });

    // posição da torre na linha, ou -1 se não existe no trecho (aceita item com partes)
    function posicao(item) {
      var n = normalizar(separa(item).torre);
      return n !== null && Object.prototype.hasOwnProperty.call(indice, n) ? indice[n] : -1;
    }

    // posição -> partes lançadas ('ABCD' = inteira), juntando os itens da mesma torre
    function mapa(lista) {
      var m = {};
      (lista || []).forEach(function (item) {
        var s = separa(item), i = posicao(s.torre);
        if (i < 0) return;
        var p = s.partes == null ? PARTES : limpaPartes(s.partes);
        if (p) m[i] = limpaPartes((m[i] || '') + p);
      });
      return m;
    }
    function posicoesDe(m) { return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }); }

    // posições das torres existentes, em ordem e sem repetição
    function posicoes(lista) { return posicoesDe(mapa(lista)); }

    // agrupa posições seguidas: [3,4,5,9] -> [[3,5],[9,9]]   (o "runs" do protótipo)
    function blocos(pos) {
      var saida = [];
      pos.forEach(function (i) {
        var ult = saida[saida.length - 1];
        if (ult && i === ult[1] + 1) ult[1] = i; else saida.push([i, i]);
      });
      return saida;
    }

    function textoBloco(a, b, km) {
      if (a === b) return codigos[a];
      // KM: torres seguidas, a partir de duas, viram "A a B" (B = a última torre lançada)
      if (km) return codigos[a] + ' a ' + codigos[b];
      if (b - a >= 2) return codigos[a] + ' a ' + codigos[b];
      return codigos[a] + ', ' + codigos[b]; // duas seguidas ficam separadas por vírgula
    }

    // "20/1 (Pés A e B)": pés na autoportante, estais na estaiada
    function textoPartes(i, p) {
      var l = p.split(''), n = l.length;
      var nome = familias[i] === 'E' ? (n > 1 ? 'Estais' : 'Estai') : (n > 1 ? 'Pés' : 'Pé');
      return codigos[i] + ' (' + nome + ' ' + (n > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[n - 1] : l[0]) + ')';
    }

    function existe(item) { return posicao(item) >= 0; }

    function lerTorre(texto) {
      var n = normalizar(texto);
      if (n === null) return null;
      var i = posicao(n);
      return i >= 0 ? codigos[i] : n;
    }

    function familia(item) { var i = posicao(item); return i >= 0 ? familias[i] : null; }

    function partesDe(lista, torre) { var i = posicao(torre); return i >= 0 ? (mapa(lista)[i] || '') : ''; }

    // inclui as duas pontas, em TORRE e em KM (em KM, cada torre vale o vão à frente dela);
    // null se alguma das pontas não existe no trecho. A unidade fica no parâmetro por compatibilidade.
    function intervalo(de, ate) {
      var i = posicao(de), j = posicao(ate);
      if (i < 0 || j < 0) return null;
      if (i > j) { var x = i; i = j; j = x; }
      return codigos.slice(i, j + 1);
    }

    function ordenar(lista) {
      var m = mapa(lista);
      return posicoesDe(m).map(function (i) { return junta(codigos[i], m[i]); });
    }

    function sequencias(lista, unidade) {
      var km = ehKm(unidade);
      return blocos(posicoes(lista)).map(function (b) {
        return { codigos: codigos.slice(b[0], b[1] + 1), texto: textoBloco(b[0], b[1], km) };
      });
    }

    // torres inteiras seguidas formam blocos; torre com só algumas partes sai sozinha, com as partes
    function formatar(lista, unidade) {
      var km = ehKm(unidade), m = mapa(lista), saida = [], bloco = null;
      function fecha() { if (bloco) { saida.push(textoBloco(bloco[0], bloco[1], km)); bloco = null; } }
      posicoesDe(m).forEach(function (i) {
        if (!km && m[i] !== PARTES) { fecha(); saida.push(textoPartes(i, m[i])); return; }
        if (bloco && i === bloco[1] + 1) bloco[1] = i; else { fecha(); bloco = [i, i]; }
      });
      fecha();
      return saida.join(', ');
    }

    // Lê um texto no formato que formatar() produz. Torres que não existem vão para "invalidas";
    // o que não for torre nem intervalo vai para "resto". A célula só aceita o texto se os dois vierem vazios.
    function ler(texto, unidade) {
      var achadas = [], invalidas = [], resto = [];
      // "20/1 (Pés A e B)" -> "20/1:AB" antes de separar pelas vírgulas
      var txt = String(texto == null ? '' : texto).replace(PADRAO_PARTES, function (_, t, l) {
        return t.replace(/\s/g, '') + ':' + (limpaPartes(l.replace(/\be\b/gi, ' ')) || '?');
      });
      txt.split(/[,;]/).forEach(function (item) {
        item = item.trim();
        if (!item) return;
        var mp = item.match(/^(.+):([A-D]+)$/);
        if (mp) {
          var tp = normalizar(mp[1]);
          if (tp === null) resto.push(item);
          else if (!existe(tp)) invalidas.push(tp);
          else achadas.push(junta(lerTorre(tp), mp[2]));
          return;
        }
        var m = item.match(PADRAO_INTERVALO);
        var de = m && normalizar(m[1]), ate = m && normalizar(m[2]);
        if (de && ate) {
          var faltam = [de, ate].filter(function (c) { return !existe(c); });
          if (faltam.length) invalidas = invalidas.concat(faltam);
          else achadas = achadas.concat(intervalo(de, ate, unidade));
          return;
        }
        var t = normalizar(item);
        if (t === null) resto.push(item);
        else if (!existe(t)) invalidas.push(t);
        else achadas.push(t);
      });
      return {
        codigos: ordenar(achadas),
        invalidas: invalidas.filter(function (c, i) { return invalidas.indexOf(c) === i; }),
        resto: resto.join(', ')
      };
    }

    // listas: várias listas de códigos (os 7 dias de uma linha, ou os canteiros de um bloco).
    // Cada torre (ou vão) conta uma vez só. Em TORRE, só conta a torre completa: lançada inteira,
    // ou com as quatro partes somando as listas.
    function total(listas, unidade) {
      var m = mapa([].concat.apply([], listas || [])), pos = posicoesDe(m);
      if (!ehKm(unidade)) return pos.filter(function (i) { return m[i] === PARTES; }).length;
      var metros = pos.reduce(function (s, i) { return s + vaos[i]; }, 0);
      return Math.round(metros * 1000) / 1e6; // km, sem resíduo de vírgula flutuante
    }

    function uniao(listas) {
      return ordenar([].concat.apply([], listas || []));
    }

    // torres com alguma parte lançada em mais de uma lista (pés diferentes não são conflito)
    function emComum(listas) {
      var mapas = (listas || []).map(mapa), achou = {};
      mapas.forEach(function (ma, a) {
        Object.keys(ma).forEach(function (k) {
          for (var b = a + 1; b < mapas.length; b++) {
            var pb = mapas[b][k];
            if (pb && ma[k].split('').some(function (l) { return pb.indexOf(l) >= 0; })) achou[k] = true;
          }
        });
      });
      return posicoesDe(achou).map(function (i) { return codigos[i]; });
    }

    return {
      existe: existe, lerTorre: lerTorre, familia: familia, partesDe: partesDe, intervalo: intervalo,
      ordenar: ordenar, sequencias: sequencias, formatar: formatar, ler: ler, total: total, uniao: uniao,
      emComum: emComum
    };
  }

  return { criar: criar, normalizar: normalizar, formatarTotal: formatarTotal, separa: separa, junta: junta, PARTES: PARTES };
})();
