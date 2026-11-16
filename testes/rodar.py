"""Roda páginas de teste no Chrome sem janela e mostra o resultado.

Uso:
  python testes/rodar.py                 roda todas as páginas teste-*.html de testes/ e de privado/testes/
  python testes/rodar.py teste-carga     roda só essa página (procura nas duas pastas)
  python testes/rodar.py --foto app/index.html     salva uma captura de tela em testes/saida/

testes/          testes públicos, que usam só os dados fictícios de base-exemplo.js
privado/testes/  testes com dados reais; a pasta não vai para o repositório e pode não existir

Como escrever uma página de teste: veja testes/teste-base-exemplo.html. Para testar a tela inteira, veja
testes/teste-tela.html: ela abre app/index.html num quadro (iframe); por isso o Chrome roda com
--allow-file-access-from-files. Em resumo, a página carrega apoio.js e os scripts do app, e depois chama as funções `confere` e `fim`. Cada conferência vira uma
linha "OK" ou "FALHA". Erros de carga da página também aparecem aqui.

O comando termina com código 1 se alguma conferência falhar ou se a página der erro.
"""
import glob
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTAS = [os.path.join(RAIZ, "testes"), os.path.join(RAIZ, "privado", "testes")]
CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def chrome():
    for c in CHROMES:
        if os.path.exists(c):
            return c
    sys.exit("Não achei o Chrome nem o Edge nesta máquina.")


def url(caminho):
    return "file:///" + os.path.abspath(caminho).replace("\\", "/").replace(" ", "%20")


def executa(args):
    perfil = tempfile.mkdtemp(prefix="rpsq-chrome-")
    try:
        cmd = [chrome(), "--headless=new", "--disable-gpu", "--no-first-run",
               "--user-data-dir=" + perfil, "--allow-file-access-from-files", "--virtual-time-budget=6000", "--window-size=1700,950"] + args
        r = subprocess.run(cmd, capture_output=True, timeout=120)
        return r.stdout.decode("utf-8", errors="replace")
    finally:
        shutil.rmtree(perfil, ignore_errors=True)


def roda_teste(pagina):
    dom = executa(["--dump-dom", url(pagina)])
    erros = [html.unescape(x) for x in re.findall(r'<pre id="erro">(.*?)</pre>', dom, re.S)]
    res = re.search(r'<pre id="res">(.*?)</pre>', dom, re.S)
    linhas = html.unescape(res.group(1)).splitlines() if res else []
    print("==", os.path.relpath(pagina, RAIZ))
    for e in erros:
        print("  ERRO DE CARGA:", e)
    for linha in linhas:
        print("  " + linha)
    falhas = sum(1 for linha in linhas if linha.startswith("FALHA") or linha.startswith("EXCEÇÃO"))
    terminou = any(linha.startswith("FIM") for linha in linhas)
    if not terminou:
        print("  A página não chegou ao fim do roteiro (faltou chamar fim(), ou houve erro no meio).")
    return not erros and falhas == 0 and terminou


def foto(pagina):
    saida = os.path.join(RAIZ, "testes", "saida")
    os.makedirs(saida, exist_ok=True)
    arq = os.path.join(saida, os.path.splitext(os.path.basename(pagina))[0] + ".png")
    executa(["--screenshot=" + arq, url(pagina)])
    print("Captura salva em", os.path.relpath(arq, RAIZ))


def acha(nome):
    nome = nome if nome.endswith(".html") else nome + ".html"
    for pasta in PASTAS:
        p = os.path.join(pasta, nome)
        if os.path.exists(p):
            return p
    return None


def main():
    args = sys.argv[1:]
    if args and args[0] == "--foto":
        if len(args) < 2:
            sys.exit("Informe a página: python testes/rodar.py --foto app/index.html")
        foto(os.path.join(RAIZ, args[1]))
        return
    ok = True
    if args:
        paginas = []
        for a in args:
            p = acha(a)
            if p:
                paginas.append(p)
            else:
                print("== não achei o teste:", a)
                ok = False
    else:
        paginas = [p for pasta in PASTAS for p in sorted(glob.glob(os.path.join(pasta, "teste-*.html")))]
    if not paginas and ok:
        sys.exit("Nenhuma página de teste encontrada.")
    for p in paginas:
        ok = roda_teste(p) and ok
    print("\nTudo certo." if ok else "\nHÁ FALHAS.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
