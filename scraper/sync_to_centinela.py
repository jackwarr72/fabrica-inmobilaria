import json
import os
import sqlite3
from pathlib import Path

import requests


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(__file__).resolve().parent / "properties.db"
CENTINELA_ENV_PATH = PROJECT_ROOT / "centinela" / ".env"
DEFAULT_INGEST_URL = "http://localhost:3000/api/ingest/scraper"


def load_local_env():
    values = {}
    if not CENTINELA_ENV_PATH.is_file():
        return values

    for raw_line in CENTINELA_ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_properties():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        sources = {
            row["source_id"]: row["agency_name"]
            for row in connection.execute("SELECT source_id, agency_name FROM sources")
        }
        rows = connection.execute(
            """
            SELECT source_id, title, price, url, text_content, created_at, match_score, match_status
            FROM properties
            ORDER BY created_at DESC
            """
        ).fetchall()
    finally:
        connection.close()

    properties = []
    for row in rows:
        source_id = row["source_id"]
        item = {
            "sourceId": source_id,
            "agencyName": sources.get(source_id, f"Fuente {source_id}"),
            "sourceUrl": row["url"] or "",
            "title": row["title"] or "Propiedad sin título",
            "price": row["price"] or None,
            "textContent": row["text_content"] or None,
            "matchScore": row["match_score"],
            "matchStatus": row["match_status"],
        }
        if row["created_at"]:
            item["createdAt"] = row["created_at"]
        properties.append(item)
    return properties


def main():
    local_env = load_local_env()
    ingest_url = os.environ.get("CENTINELA_INGEST_URL", DEFAULT_INGEST_URL)
    token = os.environ.get("INGEST_TOKEN") or local_env.get("INGEST_TOKEN")
    if not token:
        raise SystemExit("Falta INGEST_TOKEN. Configúralo en centinela/.env o en la sesión actual.")

    properties = load_properties()
    if not properties:
        print("No hay propiedades en properties.db para sincronizar.")
        return

    response = requests.post(
        ingest_url,
        headers={"Authorization": f"Bearer {token}"},
        json={"properties": properties},
        timeout=60,
    )
    response.raise_for_status()
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
