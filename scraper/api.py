import sqlite3
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Fábrica Inmobiliaria API", version="1.0")

def get_db_connection():
    conn = sqlite3.connect("properties.db")
    conn.row_factory = sqlite3.Row  # Allows dictionary-like access to rows
    return conn

@app.get("/")
def read_root():
    return {"message": "Welcome to Fábrica Inmobiliaria Integration Layer 🚀"}

@app.get("/properties")
def get_properties(limit: int = 10):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM properties LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    # Convert rows to a list of dicts
    properties = [dict(row) for row in rows]
    return {"count": len(properties), "data": properties}
