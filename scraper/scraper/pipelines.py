import hashlib

import json
import os
import sqlite3


class APISyncPipeline:
    def open_spider(self, spider):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(current_dir)
        self.db_path = os.path.join(root_dir, "properties.db")
        sources_path = os.path.join(root_dir, "sources.json")

        self.connection = sqlite3.connect(self.db_path)
        self.cursor = self.connection.cursor()
        self._ensure_schema()
        self._sync_sources(sources_path)
        spider.logger.info(f"🔗 Connected to SQLite database at {self.db_path}")

    def close_spider(self, spider):
        self.connection.commit()
        self.connection.close()
        spider.logger.info("🔌 Closed connection to SQLite database.")

    def _ensure_schema(self):
        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS properties (
                url_hash TEXT PRIMARY KEY,
                source_id INTEGER,
                title TEXT,
                url TEXT,
                price TEXT,
                text_content TEXT,
                created_at TEXT,
                matched_at TEXT,
                match_score INTEGER,
                match_status TEXT
            )
            """
        )
        for column, definition in (
            ("text_content", "TEXT"),
            ("created_at", "TEXT"),
            ("matched_at", "TEXT"),
            ("match_score", "INTEGER"),
            ("match_status", "TEXT"),
        ):
            try:
                self.cursor.execute(f"ALTER TABLE properties ADD COLUMN {column} {definition}")
            except sqlite3.OperationalError as error:
                if "duplicate column name" not in str(error).lower():
                    raise
        self.connection.commit()

    def _sync_sources(self, sources_path):
        if not os.path.isfile(sources_path):
            return

        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                source_id INTEGER PRIMARY KEY,
                agency_name TEXT NOT NULL,
                start_url TEXT NOT NULL,
                enabled INTEGER NOT NULL
            )
            """
        )
        with open(sources_path, "r", encoding="utf-8") as source_file:
            sources = json.load(source_file)

        for source in sources:
            self.cursor.execute(
                """
                INSERT INTO sources (source_id, agency_name, start_url, enabled)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source_id) DO UPDATE SET
                    agency_name = excluded.agency_name,
                    start_url = excluded.start_url,
                    enabled = excluded.enabled
                """,
                (
                    source["source_id"],
                    source["agency_name"],
                    source["start_url"],
                    int(source.get("enabled", True)),
                ),
            )
        self.connection.commit()

    def process_item(self, item, spider):
        url = item.get("url", "")
        url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()
        engagement = item.get("engagement_metrics") or {}
        price = item.get("price") or engagement.get("price") or "N/A"
        text_content = item.get("text_content") or item.get("text") or ""

        try:
            self.cursor.execute(
                """
                INSERT OR IGNORE INTO properties (
                    source_id, title, price, url, url_hash, text_content, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    item.get("source_id"),
                    item.get("title"),
                    price,
                    url,
                    url_hash,
                    text_content,
                ),
            )
            self.connection.commit()
        except Exception as error:
            spider.logger.error(f"❌ Error inserting item into database: {error}")

        return item