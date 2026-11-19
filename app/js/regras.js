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
// Uso:
//   var r = Regras.criar(trecho.torres);      // torres: [[codigo, familia, tipo, vaoM], ...] na ordem da linha
//   r.existe('5/1')                           -> true/false
//   r.lerTorre(' 05 / 1 ')                    -> '5/1' (o código como está no trecho), ou null se não for torre
//   r.intervalo('5/1', '6/2', unidade)        -> ['5/1','5/2','6/1','6/2']   inclui as pontas (TORRE e KM)
//   r.ordenar(codigos)                        -> na ordem do trecho, sem repetição
//   r.sequencias(codigos, unidade)            -> [ { codigos: [...], texto: '5/1 a 6/2' }, ... ]  (etiquetas do painel)
//   r.formatar(codigos, unidade)              -> '5/1 a 6/2, 10/1, 13/1 a 15/2'
//   r.ler(texto, unidade)                     -> { codigos: [...], invalidas: [...], resto: '...' }
//   r.total(listas, unidade)                  -> nº de torres diferentes, ou km dos vãos diferentes
//   r.uniao(listas)                           -> torres de todas as listas, uma vez cada (consolidado)
//   r.emComum(listas)                         -> torres que aparecem em mais de uma lista (conflito)
//   Regras.formatarTotal(valor, unidade)      -> '12' ou '3,45' (vazio quando zero)
//
// Qualquer unidade que não seja 'KM' segue a regra de TORRE.
var Regras = (function () {
  // número, barra, número e, opcionalmente, uma letra no fim (existem torres como 7/1A)
  var PADRAO_TORRE = /^'?\s*(\d+)\s*\/\s*(\d+)\s*([A-Za-z]?)\s*$/;
  // "A a B", "A até B", "A - B"
  var PADRAO_INTERVALO = /^(.+?)(?:\s+(?:a|à|até|ao)\s+|\s*[-–]\s*)(.+)$/i;

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

  function criar(torres) {
    var codigos = torres.map(function (t) { return t[0]; });
    var vaos = torres.map(function (t) { return Number(t[3]) || 0; });
    var indice = {};
    codigos.forEach(function (c, i) { indice[normalizar(c) || c] = i; });

    // posição da torre na linha, ou -1 se não existe no trecho
    function posicao(codigo) {
      var n = normalizar(codigo);
      return n !== null && Object.prototype.hasOwnProperty.call(indice, n) ? indice[n] : -1;
    }

    // posições das torres existentes, em ordem e sem repetição
    function posicoes(lista) {
      var vistas = {}, saida = [];
      (lista || []).forEach(function (c) {
        var i = posicao(c);
        if (i >= 0 && !vistas[i]) { vistas[i] = true; saida.push(i); }
      });
      return saida.sort(function (a, b) { return a - b; });
    }

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

    function existe(codigo) { return posicao(codigo) >= 0; }

    function lerTorre(texto) {
      var n = normalizar(texto);
      if (n === null) return null;
      var i = posicao(n);
      return i >= 0 ? codigos[i] : n;
    }

    // inclui as duas pontas, em TORRE e em KM (em KM, cada torre vale o vão à frente dela);
    // null se alguma das pontas não existe no trecho. A unidade fica no parâmetro por compatibilidade.
    function intervalo(de, ate) {
      var i = posicao(de), j = posicao(ate);
      if (i < 0 || j < 0) return null;
      if (i > j) { var x = i; i = j; j = x; }
      return codigos.slice(i, j + 1);
    }

    function ordenar(lista) {
      return posicoes(lista).map(function (i) { return codigos[i]; });
    }

    function sequencias(lista, unidade) {
      var km = ehKm(unidade);
      return blocos(posicoes(lista)).map(function (b) {
        return { codigos: codigos.slice(b[0], b[1] + 1), texto: textoBloco(b[0], b[1], km) };
      });
    }

    function formatar(lista, unidade) {
      return sequencias(lista, unidade).map(function (s) { return s.texto; }).join(', ');
    }

    // Lê um texto no formato que formatar() produz. Torres que não existem vão para "invalidas";
    // o que não for torre nem intervalo vai para "resto". A célula só aceita o texto se os dois vierem vazios.
    function ler(texto, unidade) {
      var achadas = [], invalidas = [], resto = [];
      String(texto == null ? '' : texto).split(/[,;]/).forEach(function (item) {
        item = item.trim();
        if (!item) return;
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
    // Cada torre (ou vão) conta uma vez só.
    function total(listas, unidade) {
      var pos = posicoes([].concat.apply([], listas || []));
      if (!ehKm(unidade)) return pos.length;
      var metros = pos.reduce(function (s, i) { return s + vaos[i]; }, 0);
      return Math.round(metros * 1000) / 1e6; // km, sem resíduo de vírgula flutuante
    }

    function uniao(listas) {
      return ordenar([].concat.apply([], listas || []));
    }

    function emComum(listas) {
      var vezes = {};
      (listas || []).forEach(function (l) {
        posicoes(l).forEach(function (i) { vezes[i] = (vezes[i] || 0) + 1; });
      });
      return Object.keys(vezes).filter(function (i) { return vezes[i] > 1; })
        .map(Number).sort(function (a, b) { return a - b; })
        .map(function (i) { return codigos[i]; });
    }

    return {
      existe: existe, lerTorre: lerTorre, intervalo: intervalo, ordenar: ordenar, sequencias: sequencias,
      formatar: formatar, ler: ler, total: total, uniao: uniao, emComum: emComum
    };
  }

  return { criar: criar, normalizar: normalizar, formatarTotal: formatarTotal };
})();
