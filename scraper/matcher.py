import logging
import re
import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "properties.db"
ALERT_LOG_PATH = Path(__file__).resolve().parent / "matches.log"
DEFAULT_PRICE_CEILING = 15_000_000
LOCATION_KEYWORDS = ("metepec", "toluca", "san mateo atenco")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(ALERT_LOG_PATH, encoding="utf-8")],
)
logger = logging.getLogger("property_matcher")


def ensure_match_columns(cursor):
    for column, definition in (
        ("created_at", "TEXT"),
        ("matched_at", "TEXT"),
        ("match_score", "INTEGER"),
        ("match_status", "TEXT"),
    ):
        try:
            cursor.execute(f"ALTER TABLE properties ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError as error:
            if "duplicate column name" not in str(error).lower():
                raise


def parse_price(value):
    if not value:
        return None
    digits = re.sub(r"[^0-9.]", "", str(value).replace(",", ""))
    return float(digits) if digits else None


def calculate_match_score(property_row):
    searchable_text = " ".join(
        str(property_row.get(column) or "")
        for column in ("title", "text_content", "agency_name")
    ).lower()
    price = parse_price(property_row.get("price"))

    score = 0
    if any(keyword in searchable_text for keyword in LOCATION_KEYWORDS):
        score += 60
    if price is not None and price <= DEFAULT_PRICE_CEILING:
        score += 40
    return score


def evaluate_new_properties(database_path=DATABASE_PATH):
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()
    ensure_match_columns(cursor)
    connection.commit()

    cursor.execute(
        """
        SELECT properties.url_hash, properties.source_id, properties.title,
               properties.url, properties.price, properties.text_content,
               properties.created_at, sources.agency_name
        FROM properties
        LEFT JOIN sources ON sources.source_id = properties.source_id
        WHERE properties.matched_at IS NULL
        ORDER BY properties.created_at, properties.url_hash
        """
    )
    properties = [dict(row) for row in cursor.fetchall()]
    matches = []

    for property_row in properties:
        score = calculate_match_score(property_row)
        matched = score >= 60
        cursor.execute(
            """
            UPDATE properties
            SET matched_at = CURRENT_TIMESTAMP,
                match_score = ?,
                match_status = ?
            WHERE url_hash = ?
            """,
            (score, "matched" if matched else "reviewed", property_row["url_hash"]),
        )

        if matched:
            match = {
                "property_id": property_row["url_hash"],
                "agency_name": property_row["agency_name"] or f"Source {property_row['source_id']}",
                "title": property_row["title"],
                "price": property_row["price"],
                "match_score": score,
                "url": property_row["url"],
            }
            matches.append(match)
            logger.info(
                "HIGH-POTENTIAL MATCH | score=%s | %s | %s | %s",
                score,
                match["agency_name"],
                match["title"],
                match["url"],
            )

    connection.commit()
    connection.close()
    logger.info("Evaluated %s new properties; found %s matches.", len(properties), len(matches))
    return matches


if __name__ == "__main__":
    evaluate_new_properties()
