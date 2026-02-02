from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime = datetime.now()
    session_id: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

class Session(BaseModel):
    session_id: str
    created_at: datetime
    title: Optional[str] = "New Chat"

class SessionUpdate(BaseModel):
    title: str

class HistoryResponse(BaseModel):
    chats: List[ChatMessage]
