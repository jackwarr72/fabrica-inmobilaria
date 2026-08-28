from database import engine, Base
import models # Importing models ensures they are registered with the Base

def init_db():
    print("Starting schema initialization...")
    # This creates all tables defined in your models.py
    Base.metadata.create_all(bind=engine)
    print("Database schema initialized successfully.")

if __name__ == "__main__":
    init_db()