from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    base_url = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to discussions
    discussions = relationship("Discussion", back_populates="source", cascade="all, delete-orphan")


class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    title = Column(String(512), nullable=False)
    url = Column(String(1024), unique=True, nullable=False)
    url_hash = Column(String(64), unique=True, index=True, nullable=False)
    text = Column(Text, nullable=True)
    engagement_metrics = Column(JSON, nullable=True) # Upvotes, comments, shares
    crawled_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    source = relationship("Source", back_populates="discussions")
    analysis = relationship("AIAnalysis", back_populates="discussion", uselist=False, cascade="all, delete-orphan")


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id = Column(Integer, primary_key=True, index=True)
    discussion_id = Column(Integer, ForeignKey("discussions.id"), unique=True, nullable=False)
    sentiment_score = Column(Float, nullable=True)
    summary = Column(Text, nullable=True)
    intent_category = Column(String(100), nullable=True)
    processed_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to discussion
    discussion = relationship("Discussion", back_populates="analysis")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    objective = Column(String(500), nullable=False)
    status = Column(String(50), default="pending")  # pending, in-progress, completed
    priority = Column(Integer, default=1)
    discussion_id = Column(Integer, ForeignKey("discussions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to allow Mastermind to link tasks to discussions
    discussion = relationship("Discussion")