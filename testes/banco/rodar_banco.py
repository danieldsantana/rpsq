"""Testa os scripts de banco/ num Postgres LOCAL e descartável. Não toca no Supabase.

Uso:
  python testes/banco/rodar_banco.py

O que faz:
  1. Cria um banco temporário (pasta temporária, porta 55432) com o PostgreSQL instalado na máquina.
  2. Roda supabase_simulado.sql (imita o que o Supabase já tem), depois banco/0*.sql em ordem
     e, por fim, teste_estrutura.sql.
  3. Desliga o banco e apaga a pasta temporária.

Precisa do PostgreSQL instalado (procura em C:/Program Files/PostgreSQL/*/bin e no PATH).
Os scripts de carga com dados reais ficam fora de banco/ e não são rodados aqui.
"""
import glob
import os
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
PORTA = "55432"


def pasta_postgres():
    for p in sorted(glob.glob(r"C:/Program Files/PostgreSQL/*/bin"), reverse=True):
        if os.path.exists(os.path.join(p, "psql.exe")):
            return p
    psql = shutil.which("psql")
    if psql:
        return os.path.dirname(psql)
    sys.exit("Não achei o PostgreSQL instalado. Sem ele não dá para testar os scripts localmente.")


def main():
    pg = pasta_postgres()
    exe = lambda nome: os.path.join(pg, nome)
    tmp = tempfile.mkdtemp(prefix="rpsq_banco_")
    dados = os.path.join(tmp, "dados")
    env = dict(os.environ, PGCLIENTENCODING="UTF8")
    psql = [exe("psql"), "-h", "localhost", "-p", PORTA, "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"]
    ligado = False
    try:
        subprocess.run([exe("initdb"), "-D", dados, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # saída em arquivo, para o processo do servidor não prender este script
        subprocess.run([exe("pg_ctl"), "-D", dados, "-o", "-p " + PORTA, "-l", os.path.join(tmp, "log.txt"),
                        "-w", "start"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ligado = True
        subprocess.run(psql + ["-c", "create database rpsq_teste"], check=True, env=env)

        roteiro = [os.path.join(AQUI, "supabase_simulado.sql")]
        roteiro += sorted(glob.glob(os.path.join(RAIZ, "banco", "0*.sql")))
        roteiro += [os.path.join(AQUI, "teste_estrutura.sql")]
        saida = ""
        for arq in roteiro:
            print("rodando", os.path.relpath(arq, RAIZ))
            r = subprocess.run(psql + ["-d", "rpsq_teste", "-f", arq], env=env,
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            saida += r.stdout
            erros = [l for l in r.stderr.splitlines() if "ERROR" in l or "ERRO" in l]
            if r.returncode != 0 or erros:
                print(r.stdout[-3000:])
                print(r.stderr)
                sys.exit("\nFALHOU em " + os.path.relpath(arq, RAIZ))
        if "TODOS OS TESTES DO BANCO PASSARAM" not in saida:
            print(saida[-3000:])
            sys.exit("\nO roteiro não chegou ao fim.")
        print("\nTodos os testes do banco passaram.")
    finally:
        if ligado:
            subprocess.run([exe("pg_ctl"), "-D", dados, "-m", "fast", "stop"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
