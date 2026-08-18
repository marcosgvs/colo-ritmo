#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Acesso de EDIÇÃO ao Google Sheets, Docs e Slides.

Reaproveita o OAuth client do projeto "Colo Ritmo" que já existe (o mesmo do
Calendar). Credencial e token vivem FORA do repo:

  ~/.config/colo-ritmo/google-client.json   (client_id + secret, modo 600)
  ~/.config/colo-ritmo/google-token.json    (token do usuário, modo 600)

Autorizar (uma vez, abre o navegador — o consentimento é do Marcos):
    python3 gsuite.py autorizar

Depois:
    python3 gsuite.py teste
    python3 gsuite.py achar "Escala UTI HCB"
"""
import json
import os
import sys

CONFIG_DIR = os.path.expanduser("~/.config/colo-ritmo")
CLIENT = os.path.join(CONFIG_DIR, "google-client.json")
TOKEN = os.path.join(CONFIG_DIR, "google-token.json")
PORTA = 8765

ESCOPOS = [
    "https://www.googleapis.com/auth/spreadsheets",   # ler e escrever células
    "https://www.googleapis.com/auth/documents",      # Docs
    "https://www.googleapis.com/auth/presentations",  # Slides
    "https://www.googleapis.com/auth/drive",          # achar, criar, converter
]


def credenciais(interativo=False):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    cred = None
    if os.path.exists(TOKEN):
        cred = Credentials.from_authorized_user_file(TOKEN, ESCOPOS)
    if cred and cred.expired and cred.refresh_token:
        cred.refresh(Request())
        _guardar(cred)
    if not cred or not cred.valid:
        if not interativo:
            raise SystemExit(
                "Sem autorização ainda. Rode:  python3 gsuite.py autorizar\n"
                "(abre o navegador — quem aprova é o Marcos, na conta dele)")
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT, ESCOPOS)
        cred = flow.run_local_server(port=PORTA, prompt="consent",
                                     authorization_prompt_message=
                                     "Abrindo o navegador para autorizar…\nSe não abrir, acesse: {url}")
        _guardar(cred)
    return cred


def _guardar(cred):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(TOKEN, "w") as f:
        f.write(cred.to_json())
    os.chmod(TOKEN, 0o600)


def _servico(nome, versao):
    from googleapiclient.discovery import build
    return build(nome, versao, credentials=credenciais(), cache_discovery=False)


def sheets():
    return _servico("sheets", "v4")


def docs():
    return _servico("docs", "v1")


def slides():
    return _servico("slides", "v1")


def drive():
    return _servico("drive", "v3")


# ------------------------------------------------------------------ Sheets
def achar(nome, tipo=None):
    """procura por nome no Drive; tipo: 'sheet' | 'doc' | 'slide' | None."""
    mime = {"sheet": "application/vnd.google-apps.spreadsheet",
            "doc": "application/vnd.google-apps.document",
            "slide": "application/vnd.google-apps.presentation"}.get(tipo)
    q = f"name contains '{nome}' and trashed = false"
    if mime:
        q += f" and mimeType = '{mime}'"
    res = drive().files().list(q=q, fields="files(id,name,mimeType,modifiedTime)",
                               pageSize=30).execute()
    return res.get("files", [])


def ler(planilha_id, intervalo):
    r = sheets().spreadsheets().values().get(
        spreadsheetId=planilha_id, range=intervalo).execute()
    return r.get("values", [])


def escrever(planilha_id, intervalo, valores):
    """valores = lista de listas. USER_ENTERED faz o Sheets interpretar fórmulas."""
    return sheets().spreadsheets().values().update(
        spreadsheetId=planilha_id, range=intervalo,
        valueInputOption="USER_ENTERED", body={"values": valores}).execute()


def abas(planilha_id):
    meta = sheets().spreadsheets().get(spreadsheetId=planilha_id,
                                       fields="sheets(properties(title,sheetId,gridProperties))").execute()
    return [s["properties"] for s in meta.get("sheets", [])]


def converter_xlsx(caminho, nome=None, pasta_id=None):
    """sobe um .xlsx JÁ CONVERTIDO em Google Sheet nativo e devolve o id."""
    from googleapiclient.http import MediaFileUpload
    corpo = {"name": nome or os.path.basename(caminho).rsplit(".", 1)[0],
             "mimeType": "application/vnd.google-apps.spreadsheet"}
    if pasta_id:
        corpo["parents"] = [pasta_id]
    midia = MediaFileUpload(
        caminho, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        resumable=True)
    f = drive().files().create(body=corpo, media_body=midia, fields="id,name,webViewLink").execute()
    return f


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "teste"
    if cmd == "autorizar":
        credenciais(interativo=True)
        print("autorizado · token em", TOKEN)
        print("escopos:", *ESCOPOS, sep="\n  ")
    elif cmd == "teste":
        d = drive().about().get(fields="user(emailAddress,displayName),storageQuota(usage)").execute()
        print("conta:", d["user"]["emailAddress"])
        for nome, svc in (("sheets", sheets), ("docs", docs), ("slides", slides)):
            try:
                svc()
                print(f"  {nome}: serviço construído ✓")
            except Exception as e:
                print(f"  {nome}: FALHOU · {type(e).__name__}: {e}")
    elif cmd == "achar":
        for f in achar(sys.argv[2] if len(sys.argv) > 2 else ""):
            print(f"{f['id']}  {f['mimeType'].split('.')[-1]:12s}  {f['name']}")
    else:
        print(__doc__)
