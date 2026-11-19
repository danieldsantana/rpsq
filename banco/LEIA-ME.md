# Scripts do banco

Aqui fica o script de **estrutura** do banco (tabelas, regras de acesso, funções). Ele é genérico e pode ser público.

Os scripts de **carga**, que trazem dados reais, não ficam nesta pasta nem vão para o GitHub. Eles são gerados numa pasta local, fora do controle de versão.

## Como rodar um script

1. Abra o painel do Supabase e entre no projeto do app.
2. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
3. Abra o arquivo `.sql` num editor de texto, copie tudo e cole na consulta.
4. Clique em **Run**. Se o Supabase avisar que o script tem operações destrutivas ou que cria objetos, confirme.
5. Se aparecer erro, não rode de novo: copie a mensagem e leve para quem está construindo o app. O script roda numa transação, então um erro desfaz tudo o que ele tinha feito.
6. Anote a data na tabela abaixo.

## Depois do 001: primeiro administrador

O `001_estrutura.sql` termina com um comando comentado para incluir o primeiro administrador. Rode-o numa consulta nova, com o seu nome e o e-mail do seu login no projeto. Os demais usuários são incluídos depois pela tela de usuários do app.

## Regras

- Rode na ordem dos números, cada script uma única vez.
- Um script já rodado nunca é alterado. Uma correção vira um script novo, com o número seguinte.
- Todos os objetos do app têm o prefixo `rpsq_`. Se o projeto tiver outras tabelas, elas não devem ser tocadas.
- Antes de entregar um script novo, teste-o localmente: `python testes/banco/rodar_banco.py` (precisa do PostgreSQL instalado na máquina; não toca no Supabase).

## Registro

| Script | O que faz | Onde fica | Rodado em |
|---|---|---|---|
| `001_estrutura.sql` | Tabelas, regras de acesso, funções e tempo real | nesta pasta | 16/11/2026 |
| `002_dados_base.sql` | Carga inicial dos dados | pasta local, fora do Git | 16/11/2026 |
| `003_cabecalho_excel.sql` | Imagens e identificação do cabeçalho do Excel (configuração); pode ser rodado de novo | pasta local, fora do Git | 16/11/2026 |
| `004_identificacao_formulario.sql` | Correção do texto de identificação do formulário no Excel | pasta local, fora do Git | 16/11/2026 |
| `005_limpeza_e_semana_09_11.sql` | Apaga os lançamentos de teste e grava a primeira semana a partir das planilhas antigas | pasta local, fora do Git | 16/11/2026 |
| `006_partes_fundacao.sql` | Partes das fundações: coluna `partes` nas atividades, torre com pés/estais nas células e na consulta `rpsq_registros`; pode ser rodado de novo | nesta pasta | 19/11/2026 |
