#!/usr/bin/env python3
"""
Converte a planilha mensal de visitas técnicas (xlsx) em JSON normalizado.

Uso:
    python3 scripts/processar.py planilha.xlsx                 # processa TODAS as abas válidas
    python3 scripts/processar.py planilha.xlsx --aba DDD14out  # só uma aba
        [--mes 2026-10] [--ddd 14] [--base-total 16000]
        [--base-regiao "AREA BIRIGUI=5200" --base-regiao "AREA ANDRADINA=4100"]

Cada aba vira dados/processado/<DDD>-<AAAA-MM>.json (DDD e mês detectados nas colunas
DDD e Data da Agenda). NUNCA commitar — contém dados de cliente.

Este script NÃO classifica motivos: só lê, valida e normaliza. A classificação
(motivo raiz, família, flags) roda no navegador, em site/assets/js/regras.js,
para que uma mudança de regra não exija reprocessar planilhas antigas.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("Instale o openpyxl:  pip install openpyxl")

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "dados" / "processado"

MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
            "agosto", "setembro", "outubro", "novembro", "dezembro"]

# campo interno -> nomes de coluna aceitos (comparados já normalizados)
COLUNAS: dict[str, list[str]] = {
    "obs": ["observacao", "observacoes", "obs"],
    "fato": ["fato"],
    "causa": ["causa"],
    "subfalha": ["subfalha", "sub falha"],
    "acao": ["acao"],
    "rx": ["rx"],
    "data_baixa": ["barr", "data baixa", "dt baixa", "data execucao", "data da baixa"],
    "data_agenda": ["data da agenda", "data agenda", "dt agenda"],
    "regiao": ["regiao", "area"],
    "contrato": ["num contrato", "contrato", "numero contrato"],
    "fechamento": ["fechamento"],
    "tipo_os": ["tipo ord srv", "tipo ord serv", "tipo os"],
    "log": ["log"],
    "bx": ["bx", "cod baixa", "codigo baixa", "codigo de baixa"],
    "bx1": ["bx1"], "bx2": ["bx2"], "bx3": ["bx3"], "bx4": ["bx4"],
    "nap": ["nap"],
    "endereco": ["end completo", "endereco", "endereco completo"],
    "parceira": ["parceira", "empresa"],
    "ddd": ["ddd"],
}
OBRIGATORIAS = ["bx", "regiao", "obs", "data_agenda"]


def norm(txt) -> str:
    """minúsculas, sem acento, '_' vira espaço, espaços colapsados."""
    if txt is None:
        return ""
    s = unicodedata.normalize("NFD", str(txt))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("_", " ")
    return re.sub(r"\s+", " ", s).strip()


def limpa(v):
    """Texto limpo (espaços colapsados) ou None."""
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def inteiro(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        return int(float(str(v).replace(",", ".")))
    except ValueError:
        return None


def data_iso(v, com_hora=False):
    if v is None:
        return None
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%dT%H:%M") if com_hora else v.strftime("%Y-%m-%d")
    if isinstance(v, dt.date):
        return v.isoformat()
    s = str(v).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            d = dt.datetime.strptime(s, fmt)
            return d.strftime("%Y-%m-%dT%H:%M") if com_hora else d.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def mapear_colunas(cabecalho: list) -> tuple[dict[str, int], list[str]]:
    avisos, mapa = [], {}
    normalizados = [norm(c) for c in cabecalho]
    for campo, aliases in COLUNAS.items():
        idx = [i for i, n in enumerate(normalizados) if n in aliases]
        if idx:
            mapa[campo] = idx[0]
            if len(idx) > 1:
                avisos.append(f"Coluna '{cabecalho[idx[0]]}' aparece {len(idx)}x — usei a primeira.")
    faltando = [c for c in OBRIGATORIAS if c not in mapa]
    if faltando:
        raise SystemExit(f"Colunas obrigatórias não encontradas: {faltando}\nCabeçalho lido: {cabecalho}")
    ignoradas = [c for i, c in enumerate(cabecalho) if c and i not in mapa.values()]
    if ignoradas:
        avisos.append(f"Colunas ignoradas: {ignoradas}")
    return mapa, avisos


def processar(caminho: Path, ws, mes_forcado: str | None, ddd_forcado: str | None,
              base_total: int | None, base_regiao: dict[str, int]) -> dict:
    linhas = ws.iter_rows(values_only=True)
    cabecalho = list(next(linhas))
    mapa, avisos = mapear_colunas(cabecalho)

    def g(row, campo):
        i = mapa.get(campo)
        return row[i] if i is not None and i < len(row) else None

    registros, meses, ddds, vazias = [], Counter(), Counter(), 0
    for n, row in enumerate(linhas, start=2):
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            vazias += 1
            continue
        bx = inteiro(g(row, "bx"))
        if bx is None:
            avisos.append(f"Linha {n}: sem código de baixa (BX) — ignorada.")
            continue
        rx_bruto = g(row, "rx")
        rx = inteiro(rx_bruto)
        agenda = data_iso(g(row, "data_agenda"))
        if agenda:
            meses[agenda[:7]] += 1
        if inteiro(g(row, "ddd")):
            ddds[inteiro(g(row, "ddd"))] += 1
        registros.append({
            "linha": n,
            "agenda": agenda,
            "baixa": data_iso(g(row, "data_baixa"), com_hora=True),
            "regiao": limpa(g(row, "regiao")) or "SEM REGIAO",
            "contrato": limpa(inteiro(g(row, "contrato")) or g(row, "contrato")),
            "endereco": limpa(g(row, "endereco")),
            "nap": limpa(g(row, "nap")),
            "parceira": (limpa(g(row, "parceira")) or "").upper() or None,
            "tipo_os": limpa(g(row, "tipo_os")),
            "fechamento": limpa(g(row, "fechamento")),
            "fato": limpa(g(row, "fato")),
            "causa": limpa(g(row, "causa")),
            "subfalha": limpa(g(row, "subfalha")),
            "acao": limpa(g(row, "acao")),
            "rx": rx,
            "rx_off": rx is None and norm(rx_bruto) == "off",
            "log": inteiro(g(row, "log")) or 0,
            "bx": bx,
            "bx_hist": [inteiro(g(row, c)) for c in ("bx1", "bx2", "bx3", "bx4")],
            "obs": limpa(g(row, "obs")),
        })

    if not registros:
        raise SystemExit("Nenhum registro válido encontrado.")

    mes = mes_forcado or meses.most_common(1)[0][0]
    ddd = ddd_forcado or (str(ddds.most_common(1)[0][0]) if ddds else None)
    if not ddd:
        raise SystemExit(f"Aba {ws.title!r}: DDD não encontrado — use --ddd.")
    if len(ddds) > 1:
        avisos.append(f"Mais de um DDD na aba: {dict(ddds)} — usei {ddd}.")
    fora = sum(v for k, v in meses.items() if k != mes)
    if fora:
        avisos.append(f"{fora} linha(s) com Data da Agenda fora de {mes} (mantidas).")
    nao_exec = sum(1 for r in registros if r["fechamento"] and norm(r["fechamento"]) != "executado")
    if nao_exec:
        avisos.append(f"{nao_exec} linha(s) com FECHAMENTO diferente de EXECUTADO (mantidas).")
    if vazias:
        avisos.append(f"{vazias} linha(s) vazia(s) ignorada(s).")

    ano, m = int(mes[:4]), int(mes[5:7])
    return {
        "versao": 2,
        "id": f"{ddd}-{mes}",
        "ddd": ddd,
        "mes": mes,
        "rotulo": f"{MESES_PT[m - 1].capitalize()} de {ano}",
        "fonte": caminho.name,
        "aba": ws.title,
        "gerado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "total_linhas": len(registros),
        "base_assinantes": {"total": base_total, "por_regiao": base_regiao},
        "avisos": avisos,
        "registros": registros,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("planilha", type=Path)
    ap.add_argument("--mes", help="força o mês (AAAA-MM); padrão: mês mais frequente da Data da Agenda")
    ap.add_argument("--aba", action="append", help="aba a processar (repetível); padrão: todas as válidas")
    ap.add_argument("--ddd", help="força o DDD; padrão: valor mais frequente da coluna DDD")
    ap.add_argument("--base-total", type=int, help="base de assinantes do DDD no mês")
    ap.add_argument("--base-regiao", action="append", default=[], metavar="REGIAO=N",
                    help="base por região, exatamente como escrito na coluna REGIAO (repetível)")
    args = ap.parse_args()

    if args.mes and not re.fullmatch(r"\d{4}-\d{2}", args.mes):
        raise SystemExit("--mes deve ser AAAA-MM")
    base_regiao = {}
    for item in args.base_regiao:
        nome, _, valor = item.rpartition("=")
        if not nome or not valor.isdigit():
            raise SystemExit(f"--base-regiao inválido: {item!r} (use 'AREA X=1234')")
        base_regiao[nome.strip()] = int(valor)

    wb = openpyxl.load_workbook(args.planilha, data_only=True, read_only=True)
    abas = [wb[a] for a in args.aba] if args.aba else wb.worksheets
    SAIDA.mkdir(parents=True, exist_ok=True)
    gerados = {}
    for ws in abas:
        cab = next(ws.iter_rows(values_only=True, max_row=1), None) or []
        if not all(any(norm(c) in COLUNAS[o] for c in cab) for o in OBRIGATORIAS):
            print(f"--  aba {ws.title!r} ignorada (não tem as colunas obrigatórias)")
            continue
        dados = processar(args.planilha, ws, args.mes, args.ddd, args.base_total, base_regiao)
        if dados["id"] in gerados:
            raise SystemExit(f"As abas {gerados[dados['id']]!r} e {ws.title!r} são ambas DDD {dados['ddd']} / {dados['mes']}. "
                             "Use --aba para escolher uma.")
        gerados[dados["id"]] = ws.title
        destino = SAIDA / f"{dados['id']}.json"
        destino.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        regs = dados["registros"]
        print(f"OK  aba {ws.title!r}: DDD {dados['ddd']} · {dados['rotulo']}  ->  {destino.relative_to(RAIZ)}")
        print(f"    {len(regs)} visitas | {len({r['contrato'] for r in regs})} contratos | "
              f"{len({r['regiao'] for r in regs})} regiões | {len({r['bx'] for r in regs})} códigos de baixa")
        print("    Top códigos:", ", ".join(f"{c} ({n})" for c, n in Counter(r["bx"] for r in regs).most_common(6)))
        for a in dados["avisos"]:
            print("    aviso:", a)
    if not gerados:
        raise SystemExit("Nenhuma aba válida encontrada.")


if __name__ == "__main__":
    main()
