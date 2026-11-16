"""Confere se alguma informação da obra escapou para a parte pública do repositório.

Rode ANTES DE CADA COMMIT:
  python testes/conferir_publico.py

O que faz:
  1. Lê a lista de termos proibidos em privado/termos.txt (um por linha; linhas com # são comentários).
  2. Procura cada termo, sem diferenciar maiúsculas de minúsculas e como palavra inteira, em todos os
     arquivos de texto que NÃO estão em privado/ (nem em .git/, app/lib/ ou testes/saida/).
  3. Avisa se existir alguma planilha fora de privado/.
  4. Procura chaves secretas do Supabase (sb_secret_... ou chave service_role) em TODOS os arquivos,
     inclusive em privado/. Chave secreta não pode estar em arquivo nenhum.

A lista de termos fica em privado/ justamente porque ela mesma é informação da obra.
Termina com código 1 se achar qualquer coisa.
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGNORAR_PASTAS = {os.path.join(RAIZ, p) for p in ["privado", ".git", os.path.join("app", "lib"), os.path.join("testes", "saida")]}
TEXTO = {".html", ".css", ".js", ".json", ".md", ".py", ".sql", ".txt", ".yml", ".yaml", ".csv", ""}
PLANILHA = {".xlsx", ".xlsm", ".xls"}


def termos():
    caminho = os.path.join(RAIZ, "privado", "termos.txt")
    if not os.path.exists(caminho):
        sys.exit("Não achei privado/termos.txt. Sem a lista de termos não dá para conferir.")
    lista = []
    for linha in open(caminho, encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#"):
            lista.append(linha)
    return lista


def arquivos():
    for pasta, subpastas, nomes in os.walk(RAIZ):
        subpastas[:] = [s for s in subpastas if os.path.join(pasta, s) not in IGNORAR_PASTAS]
        for n in nomes:
            yield os.path.join(pasta, n)


# Formatos de chave secreta: a nova (sb_secret_...) e a antiga (JWT que começa com eyJ).
# A chave pública (sb_publishable_...) pode estar em app/config.js e não é procurada.
SEGREDO = re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}")


def segredos():
    """Percorre tudo, inclusive privado/, menos .git/ e app/lib/ (bibliotecas citam o prefixo)."""
    pular = {os.path.join(RAIZ, ".git"), os.path.join(RAIZ, "app", "lib")}
    achados = []
    for pasta, subpastas, nomes in os.walk(RAIZ):
        subpastas[:] = [s for s in subpastas if os.path.join(pasta, s) not in pular]
        for n in nomes:
            caminho = os.path.join(pasta, n)
            if os.path.splitext(n)[1].lower() not in TEXTO:
                continue
            try:
                texto = open(caminho, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            for m in SEGREDO.finditer(texto):
                achados.append((os.path.relpath(caminho, RAIZ), texto.count("\n", 0, m.start()) + 1))
    return achados


def main():
    chaves = segredos()
    for rel, linha in chaves:
        print(f"CHAVE SECRETA: {rel}:{linha}  ->  apague a chave do arquivo")
    if chaves:
        print("\nNÃO ENVIE. Chave secreta não pode estar em arquivo nenhum.")
        sys.exit(1)
    padroes = [(t, re.compile(r"(?<![0-9A-Za-zÀ-ÿ])" + re.escape(t) + r"(?![0-9A-Za-zÀ-ÿ])", re.I)) for t in termos()]
    achados, planilhas, lidos = [], [], 0
    for caminho in arquivos():
        rel = os.path.relpath(caminho, RAIZ)
        ext = os.path.splitext(caminho)[1].lower()
        if ext in PLANILHA:
            planilhas.append(rel)
            continue
        if ext not in TEXTO:
            continue
        try:
            texto = open(caminho, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        lidos += 1
        # o próprio caminho do arquivo também conta
        for alvo, origem in ((rel, 0), (texto, 1)):
            for termo, padrao in padroes:
                for m in padrao.finditer(alvo):
                    linha = alvo.count("\n", 0, m.start()) + 1 if origem else 0
                    achados.append((rel, linha, termo))
    for p in planilhas:
        print("PLANILHA FORA DE privado/:", p)
    for rel, linha, termo in sorted(set(achados)):
        print(f"TERMO DA OBRA: {rel}" + (f":{linha}" if linha else " (no nome do arquivo)") + f"  ->  {termo}")
    if achados or planilhas:
        print("\nNÃO ENVIE. Corrija os pontos acima antes do commit.")
        sys.exit(1)
    print(f"Nada da obra na parte pública. {lidos} arquivos conferidos contra {len(padroes)} termos.")


if __name__ == "__main__":
    main()
