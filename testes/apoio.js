// Apoio para as páginas de teste. Carregue este arquivo ANTES dos scripts do app.
// Uso no roteiro:
//   confere('nome do que está sendo conferido', condição, valorParaMostrar);
//   fim();   // sempre a última linha; sem ela o teste é dado como incompleto
// O resultado vai para <pre id="res">, que testes/rodar.py lê.
var __linhas = [];

window.onerror = function (msg, origem, linha, coluna) {
  var p = document.createElement('pre');
  p.id = 'erro';
  p.textContent = msg + ' @ ' + String(origem || '').split('/').pop() + ':' + linha + ':' + coluna;
  document.documentElement.appendChild(p);
};

function confere(nome, condicao, valor) {
  __linhas.push((condicao ? 'OK    ' : 'FALHA ') + nome + (valor !== undefined ? ' -> ' + JSON.stringify(valor) : ''));
}

// roda um trecho do roteiro; se ele quebrar, registra e segue para o próximo
function bloco(nome, fn) {
  try { fn(); } catch (e) { __linhas.push('EXCEÇÃO em "' + nome + '": ' + e.message); }
}

function fim() {
  __linhas.push('FIM');
  var p = document.getElementById('res') || document.createElement('pre');
  p.id = 'res';
  p.textContent = __linhas.join('\n');
  document.documentElement.appendChild(p);
}
