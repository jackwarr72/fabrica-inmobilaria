import sqlite3
import hashlib
import os

class APISyncPipeline:
    def open_spider(self, spider):
        # Locate properties.db in the parent project root folder
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(current_dir)
        db_path = os.path.join(root_dir, "properties.db")

        self.connection = sqlite3.connect(db_path)
        self.cursor = self.connection.cursor()
        spider.logger.info(f"🔗 Connected to SQLite database at {db_path}")

    def close_spider(self, spider):
        self.connection.commit()
        self.connection.close()
        spider.logger.info("🔌 Closed connection to SQLite database.")

    def process_item(self, item, spider):
        # Generate unique SHA-256 hash for deduplication based on URL
        url = item.get("url", "")
        url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()

        try:
            self.cursor.execute('''
                INSERT OR IGNORE INTO properties (source_id, agency_name, title, price, url, url_hash)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                item.get("source_id"),
                item.get("agency_name"),
                item.get("title"),
                item.get("price"),
                url,
                url_hash
            ))
            self.connection.commit()
        except Exception as e:
            spider.logger.error(f"❌ Error inserting item into database: {e}")

        return item