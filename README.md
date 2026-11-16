# RPSQ: Programação Semanal

App web de programação semanal para obras de linhas de transmissão. As equipes lançam, por canteiro, as torres executadas na semana anterior e as programadas para as duas semanas seguintes. A tela imita uma planilha, e o resultado é exportado para Excel.

**Situação:** estrutura criada; a lógica está em construção.

## Como funciona

- HTML, CSS e JavaScript puros, sem etapa de build.
- Os dados ficam num banco Supabase, com login por pessoa e atualização ao vivo entre as telas.
- O app é publicado pelo GitHub Pages, a partir da pasta `app/`.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `app/` | O app |
| `banco/` | Script de estrutura do banco e instruções |
| `testes/` | Testes, que rodam no Chrome sem janela, com dados fictícios |

## Testar

```
python testes/rodar.py
```

Precisa de Python e do Chrome (ou Edge). Não usa Node.

## Dados

Este repositório não contém dados de nenhuma obra. Os exemplos em `testes/base-exemplo.js` são fictícios. Os dados reais ficam no banco, protegidos por login.
