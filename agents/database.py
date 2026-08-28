import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database connection parameters mapping to your docker-compose setup
# Host is localhost because your Python script runs on the host machine talking to port 5432
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "development_password_change_me")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "real_estate_db")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Initialize SQLAlchemy engine optimized for PostgreSQL
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Session factory for database transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your ORM models
Base = declarative_base()

def get_db():
    """
    Dependency generator that yields a database session 
    and ensures it closes properly after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()