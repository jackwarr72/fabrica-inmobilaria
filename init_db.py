import sqlite3

def init_database():
    conn = sqlite3.connect("properties.db")
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            agency_name TEXT NOT NULL,
            title TEXT NOT NULL,
            price TEXT NOT NULL,
            url TEXT NOT NULL,
            url_hash TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    print("✅ Database `properties.db` and `properties` table created successfully!")

if __name__ == "__main__":
    init_database()
