# RPSQ: Programação Semanal

App web de programação semanal de obra de linhas de transmissão. As pessoas lançam, por canteiro, o que foi executado na semana anterior e o que está programado para as duas seguintes, e o app exporta um Excel num layout padrão.

O projeto foi discutido à exaustão com o usuário antes de qualquer código. **As decisões estão tomadas; o trabalho agora é construir.**

## REPOSITÓRIO PÚBLICO: regra número um

Este repositório é público, porque o app é publicado no GitHub Pages. **Nenhuma informação da obra pode entrar em arquivo versionado.**

- Tudo o que é da obra fica em **`privado/`**, que o `.gitignore` exclui por inteiro: documentos, dados, protótipo, planilha molde, scripts de carga do banco.
- Fora de `privado/` só entra código genérico. Isso vale para comentários, nomes de variáveis, textos de tela, testes e mensagens de commit.
- **Nunca** escreva fora de `privado/`: nomes de empresas, do contrato ou das linhas; nomes de canteiros, cidades ou pessoas; listas de torres ou o catálogo real; caminhos com o nome de usuário da máquina; o nome do projeto no Supabase.
- Textos que a tela e o Excel mostram (contratante, contratada, contrato, nome da linha, código do formulário) vêm do banco, nunca do código.
- Testes e exemplos usam os dados fictícios de `testes/base-exemplo.js`.
- **Antes de cada commit, rode `python testes/conferir_publico.py`.** Ele procura os termos da obra (lista em `privado/termos.txt`) em tudo o que não está em `privado/`. Se acusar algo, corrija antes de enviar.
- Nunca use `git add -f` nem altere o `.gitignore` para incluir algo de `privado/`.
- A chave `service_role` do Supabase nunca entra em arquivo nenhum, nem em `privado/`.

## Leia antes de começar

Os documentos ficam em `privado/docs/`:

1. `privado/docs/PLANO.md`: as etapas, o que já foi feito e qual é a próxima. Comece por aqui.
2. `privado/docs/ESPECIFICACAO.md`: o que o app faz, regra por regra.
3. `privado/docs/BANCO.md`: tabelas, regras de acesso e tempo real no Supabase.
4. `privado/docs/DECISOES.md`: o que foi decidido e o que foi **rejeitado**. Não reproponha o que está na lista de rejeitados.
5. `privado/referencia/previa.html`: protótipo aprovado pelo usuário. É a referência de aparência e de comportamento da tela.

Se `privado/` não existir nesta máquina, pare e peça ao usuário: sem ela não há especificação.

## Regras de trabalho

- **Idioma:** tudo em português do Brasil, inclusive nomes no código, comentários e mensagens.
- **A tela tem de parecer a planilha do Excel.** Nada de cartões, painéis coloridos ou cara de "sistema". O usuário rejeitou isso. Na dúvida, copie o protótipo.
- **Simples, sem inventar.** Várias automações foram cortadas de propósito. Não acrescente funções que não estão na especificação; se achar que falta algo, pergunte.
- **Sem etapa de build.** HTML, CSS e JavaScript puros, com scripts clássicos (sem `import`/`export`), para o usuário conseguir manter. Não há Node na máquina dele. Bibliotecas ficam copiadas em `app/lib/`.
- **Teste antes de entregar.** Rode `python testes/rodar.py` (Chrome sem janela). Uma versão não testada já foi entregue em branco uma vez. Scripts de `banco/`: `python testes/banco/rodar_banco.py` (Postgres local descartável).
- **Você não tem acesso ao Supabase do usuário.** Os scripts SQL são escritos aqui e é ele quem roda no painel. Explique cada passo de forma concreta: ele administra o projeto, mas não é programador.
- **Ao terminar uma etapa,** marque-a em `privado/docs/PLANO.md` e anote lá o que ficou pendente.

## Onde está cada coisa

| Caminho | Vai para o GitHub? | Conteúdo |
|---|---|---|
| `app/` | sim | O app. É o que o GitHub Pages publica |
| `app/lib/` | sim | Bibliotecas copiadas. Não editar |
| `index.html` | sim | Só redireciona para `app/` |
| `banco/` | sim | Script de estrutura do banco (genérico) e o passo a passo para rodar |
| `testes/` | sim | `rodar.py`, `conferir_publico.py`, `apoio.js`, dados fictícios e as páginas de teste |
| `testes/banco/` | sim | Teste dos scripts de `banco/` num Postgres local, com uma imitação do Supabase |
| `privado/docs/` | **não** | Plano, especificação, banco, decisões, pontos a validar |
| `privado/dados/` | **não** | Torres e catálogo reais |
| `privado/referencia/` | **não** | Protótipo aprovado e planilha molde do Excel |
| `privado/ferramentas/` | **não** | Scripts que extraem os dados dos arquivos da obra |
| `privado/testes/` | **não** | Dados reais para teste (`base.js`) e testes que dependem deles |
| `privado/banco/` | **não** | Scripts de carga com dados reais |
