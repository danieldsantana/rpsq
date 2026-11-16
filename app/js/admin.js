// FUNÇÕES DO ADMINISTRADOR: tela de usuários e cópia de segurança (etapa 5 do plano).
// Especificação: seção 14. Os botões ficam na faixa de comandos e só aparecem para o papel 'admin'.
//
// Usuários: a pessoa precisa ter login no projeto do Supabase (criado no painel, em Authentication > Users).
// Aqui o administrador só põe ou tira essa pessoa da lista do RPSQ e escolhe o papel.
// Cópia de segurança: baixa todas as tabelas do RPSQ num arquivo JSON.
var Admin = (function () {
  var lista = null, erro = '';
  var PAPEIS = [
    ['consulta', 'consulta: vê tudo e exporta'],
    ['edita', 'edita: lança e altera em qualquer canteiro'],
    ['admin', 'admin: tudo, mais abrir semana, revisão, usuários e cópia de segurança']
  ];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return App.esc(s); }

  // baixa um arquivo gerado no navegador (separado para os testes poderem trocar)
  function baixar(nome, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ---------- tela de usuários ----------
  function abrirUsuarios() {
    App.E.tela = 'usuarios';
    lista = null; erro = '';
    App.render();
    desenhar();
    return carregar();
  }
  function carregar() {
    return Dados.listarUsuarios().then(function (l) { lista = l; erro = ''; desenhar(); })
      .catch(function (err) { erro = err.message; desenhar(); });
  }
  function opcoesPapel(atual) {
    return PAPEIS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === atual ? ' selected' : '') + '>' + p[0] + '</option>'; }).join('');
  }
  function desenhar() {
    var h = '<div class="head"><h1>USUÁRIOS DO RPSQ</h1>' +
      '<p>Para incluir uma pessoa, crie antes o login dela no painel do Supabase (Authentication &gt; Users) e depois informe aqui o mesmo e-mail.</p>' +
      '<p>' + PAPEIS.map(function (p) { return esc(p[1]); }).join(' · ') + '</p></div>';
    h += '<table class="sheet usuarios" style="width:960px"><colgroup><col style="width:260px"><col style="width:300px"><col style="width:140px"><col style="width:80px"><col style="width:180px"></colgroup>' +
      '<thead><tr><th>NOME</th><th>E-MAIL</th><th>PAPEL</th><th>ATIVO</th><th></th></tr></thead><tbody>';
    if (!lista) h += '<tr><td class="vazio" colspan="5">' + (erro ? esc(erro) : 'Carregando…') + '</td></tr>';
    else {
      lista.forEach(function (u, i) {
        h += '<tr><td class="in"><input type="text" id="u-nome-' + i + '" aria-label="Nome" value="' + esc(u.nome) + '"></td>' +
          '<td class="l">' + esc(u.email) + '</td>' +
          '<td class="in"><select id="u-papel-' + i + '" aria-label="Papel">' + opcoesPapel(u.papel) + '</select></td>' +
          '<td><input type="checkbox" id="u-ativo-' + i + '" aria-label="Ativo"' + (u.ativo ? ' checked' : '') + '></td>' +
          '<td><button class="rb" data-salva-u="' + i + '">Salvar</button></td></tr>';
      });
      h += '<tr><td class="in"><input type="text" id="u-nome-novo" aria-label="Nome da pessoa nova" placeholder="Nome"></td>' +
        '<td class="in"><input type="text" id="u-email-novo" aria-label="E-mail da pessoa nova" placeholder="e-mail do login" autocomplete="off"></td>' +
        '<td class="in"><select id="u-papel-novo" aria-label="Papel da pessoa nova">' + opcoesPapel('edita') + '</select></td>' +
        '<td><input type="checkbox" id="u-ativo-novo" aria-label="Ativo" checked></td>' +
        '<td><button class="rb main" id="u-incluir">Incluir</button></td></tr>';
    }
    h += '</tbody></table><div class="foot"><span class="erro-adm" id="u-erro" role="alert">' + (lista && erro ? esc(erro) : '') + '</span>' +
      '<button class="rb" id="u-voltar">Voltar à planilha</button></div>';
    $('paper').innerHTML = h;
  }
  function grava(u) {
    erro = '';
    return Dados.gravarUsuario(u).then(function () {
      App.toast('Usuário ' + u.email + ' gravado.');
      return carregar();
    }).catch(function (err) { erro = err.message; desenhar(); });
  }

  // ---------- cópia de segurança ----------
  function copia() {
    App.toast('Preparando a cópia de segurança…');
    return Dados.copiaDeSeguranca().then(function (dados) {
      var hoje = new Date(), nome = 'rpsq-copia-' + hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
        String(hoje.getDate()).padStart(2, '0') + '.json';
      api.baixar(nome, new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
      App.toast('Cópia de segurança baixada: ' + nome + '. Guarde o arquivo num lugar seguro.');
    }).catch(function (err) { App.toast('Não foi possível gerar a cópia: ' + err.message); });
  }

  function clique(b) {
    var d = b.dataset;
    if (b.id === 'b-usuarios') { abrirUsuarios(); return true; }
    if (b.id === 'b-copia') { copia(); return true; }
    if (b.id === 'u-voltar') { App.E.tela = 'planilha'; App.render(); return true; }
    if (d.salvaU !== undefined) {
      var i = +d.salvaU, u = lista[i];
      grava({ email: u.email, nome: $('u-nome-' + i).value.trim(), papel: $('u-papel-' + i).value, ativo: $('u-ativo-' + i).checked });
      return true;
    }
    if (b.id === 'u-incluir') {
      var email = $('u-email-novo').value.trim(), nome = $('u-nome-novo').value.trim();
      if (!email || !nome) { erro = 'Informe o nome e o e-mail da pessoa.'; $('u-erro').textContent = erro; return true; }
      grava({ email: email, nome: nome, papel: $('u-papel-novo').value, ativo: $('u-ativo-novo').checked });
      return true;
    }
    return false;
  }

  var api = { desenhar: desenhar, abrirUsuarios: abrirUsuarios, copia: copia, clique: clique, baixar: baixar };
  return api;
})();
