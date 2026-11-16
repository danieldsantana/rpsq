# Scripts do banco

Aqui fica o script de **estrutura** do banco (tabelas, regras de acesso, funções). Ele é genérico e pode ser público.

Os scripts de **carga**, que trazem dados reais, não ficam nesta pasta nem vão para o GitHub. Eles são gerados numa pasta local, fora do controle de versão.

## Como rodar um script

1. Abra o painel do Supabase e entre no projeto do app.
2. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
3. Abra o arquivo `.sql` num editor de texto, copie tudo e cole na consulta.
4. Clique em **Run**.
5. Se aparecer erro, não rode de novo: copie a mensagem e leve para quem está construindo o app.
6. Anote a data na tabela abaixo.

## Regras

- Rode na ordem dos números, cada script uma única vez.
- Um script já rodado nunca é alterado. Uma correção vira um script novo, com o número seguinte.
- Todos os objetos do app têm o prefixo `rpsq_`. Se o projeto tiver outras tabelas, elas não devem ser tocadas.

## Registro

| Script | O que faz | Onde fica | Rodado em |
|---|---|---|---|
| `001_estrutura.sql` | Tabelas, regras de acesso, funções e tempo real | nesta pasta (a escrever) | |
| `002_dados_base.sql` | Carga inicial dos dados | pasta local, fora do Git (a gerar) | |
