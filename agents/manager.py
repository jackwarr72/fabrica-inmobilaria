from database import SessionLocal
from models import Task, Discussion
from datetime import datetime

def create_task(objective: str, priority: int = 1, discussion_id: int = None):
    """
    Creates a new Mastermind task and persists it to the database.
    """
    db = SessionLocal()
    try:
        new_task = Task(
            objective=objective,
            priority=priority,
            discussion_id=discussion_id,
            status="pending"
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        print(f"[SUCCESS] Task created with ID {new_task.id}: '{new_task.objective}'")
        return new_task
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to create task: {e}")
        return None
    finally:
        db.close()

def list_tasks():
    """
    Retrieves and prints all current Mastermind tasks from the database.
    """
    db = SessionLocal()
    try:
        tasks = db.query(Task).all()
        print(f"\n--- Mastermind Active Task Registry ({len(tasks)} total) ---")
        for t in tasks:
            print(f"ID: {t.id} | Status: {t.status} | Priority: {t.priority} | Objective: {t.objective}")
        print("----------------------------------------------------------\n")
        return tasks
    finally:
        db.close()

if __name__ == "__main__":
    # Test execution to verify our operational interface
    print("Initializing Mastermind Task Manager interface...")
    create_task(objective="Bootstrap Valley-Metrix agentic data ingestion framework", priority=1)
    list_tasks()