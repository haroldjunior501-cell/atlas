"""Pont DEVOID / FastAPI → ATLAS LLM.

ATLAS_URL=http://localhost:3000
ATLAS_BRIDGE_TOKEN=   # même valeur que ZTC_BRIDGE_TOKEN
"""

from __future__ import annotations

import json
import os
import urllib.request

ATLAS_URL = os.environ.get("ATLAS_URL", "http://localhost:3000").rstrip("/")


def _headers() -> dict[str, str]:
    headers = {"content-type": "application/json", "accept": "application/json"}
    token = os.environ.get("ATLAS_BRIDGE_TOKEN", "").strip()
    if token:
        headers["authorization"] = f"Bearer {token}"
    return headers


def atlas_post(body: dict) -> dict:
    request = urllib.request.Request(
        f"{ATLAS_URL}/api/atlas/ztc/connect",
        data=json.dumps(body).encode("utf-8"),
        headers=_headers(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as error:  # noqa: BLE001 — pont optionnel, ne casse pas DEVOID
        return {"ok": False, "error": str(error)}


def atlas_think(desk: str, text: str) -> dict:
    """Un agent ATLAS répond avec le périmètre de son bureau."""
    return atlas_post({"op": "think", "desk": desk, "text": text})


def atlas_ingest(desk: str, source: str, facts: list[dict]) -> dict:
    """Pousse un fait observé (catalogue, ticket, santé). Pas d'estimation."""
    return atlas_post({"op": "ingest", "desk": desk, "source": source, "facts": facts})
