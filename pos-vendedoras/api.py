"""Cliente HTTP para la API del backend ComTec."""
import json
import requests
from pathlib import Path

_CONFIG = None
_SESSION = {"token": None, "user": None}


def load_config():
    """Carga config.json y lo cachea."""
    global _CONFIG
    if _CONFIG is None:
        path = Path(__file__).parent / "config.json"
        with open(path, "r", encoding="utf-8") as f:
            _CONFIG = json.load(f)
    return _CONFIG


def base_url() -> str:
    return load_config()["api_url"].rstrip("/")


def set_session(token: str, user: dict):
    _SESSION["token"] = token
    _SESSION["user"] = user


def get_user() -> dict:
    return _SESSION.get("user") or {}


def get_token() -> str:
    return _SESSION.get("token") or ""


def clear_session():
    _SESSION["token"] = None
    _SESSION["user"] = None


def _headers():
    h = {"Content-Type": "application/json"}
    if _SESSION["token"]:
        h["Authorization"] = "Bearer " + _SESSION["token"]
    return h


def _check(resp):
    """Lanza Exception con el mensaje del servidor si la respuesta no es OK."""
    try:
        data = resp.json()
    except Exception:
        data = None
    if not resp.ok:
        msg = (data or {}).get("error") or f"HTTP {resp.status_code}"
        raise ApiError(msg, resp.status_code)
    return data


class ApiError(Exception):
    def __init__(self, mensaje, status=0):
        super().__init__(mensaje)
        self.status = status


# ---------- Auth ----------
def login(email: str, password: str):
    r = requests.post(base_url() + "/api/auth/login",
                      json={"email": email, "password": password},
                      headers=_headers(), timeout=30)
    data = _check(r)
    set_session(data["token"], data["user"])
    return data["user"]


def me():
    r = requests.get(base_url() + "/api/auth/me", headers=_headers(), timeout=20)
    return _check(r)


# ---------- Inventario ----------
def inventario(categoria: str | None = None, q: str | None = None):
    params = {}
    if categoria: params["categoria"] = categoria
    if q: params["q"] = q
    r = requests.get(base_url() + "/api/inventory", params=params, headers=_headers(), timeout=30)
    return _check(r)


# ---------- Ventas / Proformas / Notas (unificado) ----------
def listar_documentos(tipo: str | None = None, desde: str | None = None, hasta: str | None = None):
    params = {}
    if tipo:  params["tipo"] = tipo
    if desde: params["desde"] = desde
    if hasta: params["hasta"] = hasta
    r = requests.get(base_url() + "/api/sales", params=params, headers=_headers(), timeout=30)
    return _check(r)


def documento_detalle(id_: int):
    r = requests.get(base_url() + f"/api/sales/{id_}", headers=_headers(), timeout=30)
    return _check(r)


def crear_documento(payload: dict):
    """payload: tipo, cliente_nombre, cliente_dni, cliente_tel, metodo_pago, notas,
                items[{inventory_id, descripcion, cantidad, precio_unit, es_externo}], valido_hasta?"""
    r = requests.post(base_url() + "/api/sales", json=payload, headers=_headers(), timeout=30)
    return _check(r)


# ---------- Dashboard ----------
def dashboard_stats():
    r = requests.get(base_url() + "/api/dashboard/stats", headers=_headers(), timeout=30)
    return _check(r)


def mis_ventas_resumen():
    uid = get_user().get("id")
    if not uid: raise ApiError("Sin sesión")
    r = requests.get(base_url() + f"/api/users/{uid}/ventas-resumen", headers=_headers(), timeout=30)
    return _check(r)
