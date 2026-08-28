from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import get_db, engine
import models

# Ensure tables exist (redundant safeguard alongside init_db.py)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Valley-Metrix & Mastermind API",
    version="1.0.0",
    description="Integration gateway for Mastermind task planning and regional data intelligence."
)

# --- Pydantic Schemas for Request/Response Validation ---

class TaskCreate(BaseModel):
    objective: str
    priority: Optional[int] = 1
    discussion_id: Optional[int] = None

class TaskResponse(TaskCreate):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DiscussionCreate(BaseModel):
    source_id: int
    title: str
    url: str
    url_hash: str
    text: Optional[str] = None
    engagement_metrics: Optional[dict] = None

# --- API Endpoints ---

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "Mastermind-ValleyMetrix Gateway"}

@app.post("/api/v1/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """
    Ingest a new task from the Mastermind planner into the PostgreSQL database.
    """
    db_task = models.Task(
        objective=task.objective,
        priority=task.priority,
        discussion_id=task.discussion_id,
        status="pending"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/v1/tasks", response_model=List[TaskResponse])
def list_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all tasks managed by the Mastermind planner.
    """
    tasks = db.query(models.Task).offset(skip).limit(limit).all()
    return tasks

@app.post("/api/v1/discussions")
def create_discussion(discussion: DiscussionCreate, db: Session = Depends(get_db)):
    """
    Allow scraping workers to commit scraped discussions back to the database.
    """
    db_discussion = models.Discussion(
        source_id=discussion.source_id,
        title=discussion.title,
        url=discussion.url,
        url_hash=discussion.url_hash,
        text=discussion.text,
        engagement_metrics=discussion.engagement_metrics
    )
    existing = db.query(models.Discussion).filter(models.Discussion.url_hash == discussion.url_hash).first()
    if existing:
        return existing

    db.add(db_discussion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(models.Discussion).filter(models.Discussion.url_hash == discussion.url_hash).one()
    db.refresh(db_discussion)
    return db_discussion