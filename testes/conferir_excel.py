"""Abre com openpyxl o arquivo Excel que o app gera, para conferir que ele é lido fora do navegador.

Uso:
  python testes/conferir_excel.py

O que faz:
  1. Roda testes/teste-excel.html no Chrome sem janela (dados FICTÍCIOS da semana de exemplo).
  2. Pega o arquivo que a página deixa em base64 e salva em testes/saida/teste-exportacao.xlsx.
  3. Abre com openpyxl e confere abas, cabeçalho, fontes, cores, mesclas, fórmulas e impressão.
O arquivo salvo pode ser aberto no Excel para ver como ficou.
"""
import base64
import html
import os
import re
import sys
import warnings
import zipfile

import openpyxl

warnings.filterwarnings("ignore", message="DrawingML support is incomplete")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rodar import RAIZ, executa, url  # noqa: E402

falhas = 0


def confere(nome, cond, valor=None):
    global falhas
    if not cond:
        falhas += 1
    print(("  OK    " if cond else "  FALHA ") + nome + ("" if valor is None else " -> " + repr(valor)))


def main():
    dom = executa(["--dump-dom", url(os.path.join(RAIZ, "testes", "teste-excel.html"))])
    # só caracteres de base64: o texto "<pre id=xlsx>" também aparece num comentário da própria página
    achados = re.findall(r'<pre id="xlsx">([A-Za-z0-9+/=\s]+)</pre>', dom)
    if not achados:
        sys.exit("A página não gerou o arquivo.")
    saida = os.path.join(RAIZ, "testes", "saida")
    os.makedirs(saida, exist_ok=True)
    arq = os.path.join(saida, "teste-exportacao.xlsx")
    with open(arq, "wb") as f:
        f.write(base64.b64decode(html.unescape(achados[-1])))
    print("Arquivo salvo em", os.path.relpath(arq, RAIZ))

    wb = openpyxl.load_workbook(arq)
    confere("abas", wb.sheetnames == ["X1 AAA-BBB", "X2 BBB-CCC"], wb.sheetnames)
    ws = wb["X1 AAA-BBB"]
    confere("título e LT", ws["G2"].value == "RELATÓRIO DE PROGRAMAÇÃO SEMANAL" and ws["G3"].value == "LT EXEMPLO AAA - BBB")
    confere("data da semana", ws["Q5"].value is not None and ws["Q5"].value.strftime("%d/%m/%Y") == "16/11/2026", ws["Q5"].value)
    confere("fonte Calibri 26", ws["C9"].font.name == "Calibri" and ws["C9"].font.sz == 26)
    confere("laranja do cabeçalho", ws["K9"].fill.fgColor.rgb == "FFF47C00", ws["K9"].fill.fgColor.rgb)
    confere("mesclas do cabeçalho", {"G2:P2", "C9:C12", "D9:H9", "H10:H12"} <= {str(r) for r in ws.merged_cells.ranges})
    confere("largura da coluna K", abs(ws.column_dimensions["K"].width - 110.66) < 0.01, ws.column_dimensions["K"].width)
    confere("sem linhas de grade", ws.sheet_view.showGridLines is False)
    confere("paisagem, A3, ajustar à largura", ws.page_setup.orientation == "landscape" and str(ws.page_setup.paperSize) == "8"
            and ws.sheet_properties.pageSetUpPr.fitToPage, (ws.page_setup.orientation, ws.page_setup.paperSize))
    confere("área de impressão", str(ws.print_area).replace("'", "").replace("$", "").endswith("C2:V" + str(ws.max_row)), ws.print_area)
    formulas = [c.value for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("=")]
    confere("fórmulas de QUANT. FALTA e % EXEC.", any(re.match(r"^=S\d+-T\d+$", f) for f in formulas)
            and any(f.startswith("=IF(T") for f in formulas), formulas[:2])
    confere("nenhuma coluna além da V", ws.max_column <= 23, ws.max_column)
    # imagens: conferidas dentro do .xlsx (zip), porque o openpyxl só as carrega com a biblioteca Pillow
    with zipfile.ZipFile(arq) as z:
        midias = [n for n in z.namelist() if n.startswith("xl/media/")]
        desenhos = [z.read(n).decode("utf-8") for n in z.namelist() if re.match(r"xl/drawings/drawing\d+\.xml$", n)]
    figuras = [d.count("<xdr:pic>") for d in desenhos]
    confere("dois logotipos em cada aba", len(midias) >= 1 and figuras == [2, 2], (midias, figuras))
    confere("colunas estreitas alargadas", ws.column_dimensions["H"].width == 16 and ws.column_dimensions["R"].width == 24,
            (ws.column_dimensions["H"].width, ws.column_dimensions["R"].width))
    print("\nTudo certo." if not falhas else "\nHÁ FALHAS.")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
