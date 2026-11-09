#!/usr/bin/env python3
"""
Criptografa os meses processados e gera os arquivos que o dashboard lê.

    dados/processado/DDD-AAAA-MM.json  (texto puro, fora do git)
        -> site/data/DDD-AAAA-MM.bin    (AES-256-GCM, gzip antes de cifrar)
        -> site/data/meses.json     (manifesto: lista de meses + parâmetros do KDF)

Credencial = login + senha (DASH_LOGIN / DASH_SENHA, ou pedidos no terminal).
O login é normalizado (sem espaços, minúsculo). Nada disso é gravado no repositório.

Uso:
    DASH_LOGIN='nome@claro.com.br' DASH_SENHA='...' python3 scripts/publicar.py            # publica/atualiza
    DASH_LOGIN=... DASH_SENHA=... python3 scripts/publicar.py --extrair  # .bin -> dados/processado
    DASH_LOGIN=... DASH_SENHA=... [NOVO_LOGIN=...] NOVA_SENHA=... python3 scripts/publicar.py --trocar-senha

Formato do .bin: IV (12 bytes) || ciphertext+tag. AAD = id ("14-2026-10"),
o que impede trocar o arquivo de um mês/DDD pelo de outro.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import getpass
import gzip
import json
import os
import secrets
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.exceptions import InvalidTag
except ImportError:  # pragma: no cover
    sys.exit("Instale o pacote cryptography:  pip install cryptography")

RAIZ = Path(__file__).resolve().parent.parent
PROCESSADO = RAIZ / "dados" / "processado"
SITE_DATA = RAIZ / "site" / "data"
MANIFESTO = SITE_DATA / "meses.json"
ITERACOES = 600_000
SENHA_MIN = 6        # mínimo absoluto
SENHA_FORTE = 12     # abaixo disso, avisa
CREDENCIAL = "login+senha"


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def credencial(login: str, senha: str) -> str:
    """Espelha credencial() em site/assets/js/cripto.js."""
    return f"{login.strip().lower()}\n{senha}"


def derivar(segredo: str, salt: bytes, iteracoes: int) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iteracoes)
    return kdf.derive(segredo.encode("utf-8"))


def cifrar(chave: bytes, mes: str, dados: dict) -> bytes:
    bruto = gzip.compress(json.dumps(dados, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9, mtime=0)
    iv = secrets.token_bytes(12)
    return iv + AESGCM(chave).encrypt(iv, bruto, mes.encode())


def decifrar(chave: bytes, mes: str, blob: bytes) -> dict:
    bruto = AESGCM(chave).decrypt(blob[:12], blob[12:], mes.encode())
    return json.loads(gzip.decompress(bruto))


def ler_manifesto() -> dict | None:
    return json.loads(MANIFESTO.read_text(encoding="utf-8")) if MANIFESTO.exists() else None


def pedir_credencial(var_login: str, var_senha: str, rotulo: str, confirmar: bool, login_padrao: str | None = None) -> str:
    login = os.environ.get(var_login) or login_padrao or input(f"Login ({rotulo}): ").strip()
    if not login:
        sys.exit("Informe o login.")
    senha = pedir_senha(var_senha, f"Senha ({rotulo})", confirmar)
    if len(senha) < SENHA_MIN:
        sys.exit(f"Use uma senha com pelo menos {SENHA_MIN} caracteres.")
    if len(senha) < SENHA_FORTE:
        print(f"AVISO: senha fraca (< {SENHA_FORTE} caracteres). Quem obtiver o .bin consegue quebrá-la offline. "
              "Use só temporariamente e NÃO versione site/data/ no git.")
    return credencial(login, senha)


def pedir_senha(var: str, rotulo: str, confirmar: bool) -> str:
    senha = os.environ.get(var)
    if not senha:
        senha = getpass.getpass(f"{rotulo}: ")
        if confirmar and getpass.getpass("Confirme: ") != senha:
            sys.exit("As senhas não conferem.")
    return senha


def chave_do_manifesto(man: dict, segredo: str) -> bytes:
    kdf = man["kdf"]
    if kdf.get("credencial") != CREDENCIAL:  # manifesto antigo: só senha
        segredo = segredo.split("\n", 1)[-1]
    chave = derivar(segredo, base64.b64decode(kdf["salt"]), kdf["iter"])
    # valida contra um mês já publicado: evita cifrar meses novos com outra senha
    for item in man["meses"]:
        arq = SITE_DATA / item["arquivo"]
        if arq.exists():
            try:
                decifrar(chave, item.get("id", item["mes"]), arq.read_bytes())
                return chave
            except InvalidTag:
                sys.exit("Login/senha incorretos para os meses já publicados. Nada foi alterado.")
    return chave


def gravar_manifesto(salt: bytes, iteracoes: int, meses: list[dict]):
    meses = sorted(meses, key=lambda m: (str(m.get("ddd", "")), m["mes"]))
    MANIFESTO.write_text(json.dumps({
        "versao": 1,
        "kdf": {"alg": "PBKDF2-SHA256", "iter": iteracoes, "salt": b64(salt), "credencial": CREDENCIAL},
        "cifra": "AES-256-GCM (gzip); arquivo = iv(12) || ct; AAD = id",
        "atualizado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "meses": meses,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def publicar():
    fontes = sorted(PROCESSADO.glob("*.json"))
    if not fontes:
        sys.exit(f"Nada em {PROCESSADO.relative_to(RAIZ)}. Rode antes: python3 scripts/processar.py planilha.xlsx")
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    man = ler_manifesto()
    senha = pedir_credencial("DASH_LOGIN", "DASH_SENHA", "dashboard", confirmar=man is None)
    if man:
        salt, iteracoes = base64.b64decode(man["kdf"]["salt"]), man["kdf"]["iter"]
        chave = chave_do_manifesto(man, senha)
        meses = {m.get("id", m["mes"]): m for m in man["meses"]}
    else:
        salt, iteracoes = secrets.token_bytes(16), ITERACOES
        chave = derivar(senha, salt, iteracoes)
        meses = {}
    for f in fontes:
        dados = json.loads(f.read_text(encoding="utf-8"))
        ident = dados.get("id", dados["mes"])
        blob = cifrar(chave, ident, dados)
        (SITE_DATA / f"{ident}.bin").write_bytes(blob)
        meses[ident] = {"id": ident, "ddd": dados.get("ddd"), "mes": dados["mes"], "rotulo": dados["rotulo"],
                        "arquivo": f"{ident}.bin", "visitas": len(dados["registros"])}
        print(f"OK  {ident}  {len(dados['registros'])} visitas  ->  site/data/{ident}.bin ({len(blob) / 1024:.1f} KB)")
    gravar_manifesto(salt, iteracoes, list(meses.values()))
    print("Manifesto atualizado: site/data/meses.json")


def extrair():
    man = ler_manifesto() or sys.exit("Sem manifesto publicado.")
    chave = chave_do_manifesto(man, pedir_credencial("DASH_LOGIN", "DASH_SENHA", "dashboard", False))
    PROCESSADO.mkdir(parents=True, exist_ok=True)
    for item in man["meses"]:
        ident = item.get("id", item["mes"])
        dados = decifrar(chave, ident, (SITE_DATA / item["arquivo"]).read_bytes())
        (PROCESSADO / f"{ident}.json").write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
        print(f"OK  {ident} -> dados/processado/{ident}.json")


def trocar_senha():
    man = ler_manifesto() or sys.exit("Sem manifesto publicado.")
    atual = pedir_credencial("DASH_LOGIN", "DASH_SENHA", "ATUAL", False)
    antiga = chave_do_manifesto(man, atual)
    nova = pedir_credencial("NOVO_LOGIN", "NOVA_SENHA", "NOVA", True, login_padrao=atual.split("\n", 1)[0])
    salt = secrets.token_bytes(16)
    chave = derivar(nova, salt, ITERACOES)
    for item in man["meses"]:
        arq = SITE_DATA / item["arquivo"]
        ident = item.get("id", item["mes"])
        arq.write_bytes(cifrar(chave, ident, decifrar(antiga, ident, arq.read_bytes())))
        print(f"OK  {ident} recriptografado")
    gravar_manifesto(salt, ITERACOES, man["meses"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--extrair", action="store_true", help="decifra site/data/*.bin para dados/processado/")
    g.add_argument("--trocar-senha", action="store_true", help="recriptografa todos os meses com nova senha")
    a = ap.parse_args()
    extrair() if a.extrair else trocar_senha() if a.trocar_senha else publicar()
