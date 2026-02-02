from fastapi import APIRouter, Depends, HTTPException, Body
from app.models.chat import ChatRequest, ChatResponse, HistoryResponse, ChatMessage, Session, SessionUpdate
from app.db.database import get_database
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
from app.core.config import settings
from datetime import datetime
import uuid
from typing import List

router = APIRouter()

llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", google_api_key=settings.GEMINI_API_KEY)

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db=Depends(get_database)):
    session_id = request.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        # Optional: Initialize session metadata here if we wanted default titles to be persistent immediately
        # But lazy creation is fine logic too.
    
    # 1. Save User Message
    user_msg = ChatMessage(role="user", content=request.message, timestamp=datetime.now(), session_id=session_id)
    await db.history.insert_one(user_msg.dict())

    # 2. Generate Response
    response_msg = llm.invoke([HumanMessage(content=request.message)])
    
    # 3. Save AI Response
    ai_msg = ChatMessage(role="assistant", content=response_msg.content, timestamp=datetime.now(), session_id=session_id)
    await db.history.insert_one(ai_msg.dict())

    return ChatResponse(response=response_msg.content, session_id=session_id)

@router.get("/sessions", response_model=List[Session])
async def get_sessions(db=Depends(get_database)):
    # 1. Get raw sessions from history (group by session_id)
    pipeline = [
        {"$group": {"_id": "$session_id", "created_at": {"$min": "$timestamp"}, "first_message": {"$first": "$content"}}},
        {"$sort": {"created_at": -1}}
    ]
    cursor = db.history.aggregate(pipeline)
    
    # 2. Get all persistent session metadata (titles)
    # We fetch all of them to avoid N+1 queries
    metadata_cursor = db.sessions.find({})
    metadata_map = {}
    async for doc in metadata_cursor:
        metadata_map[doc["session_id"]] = doc["title"]

    sessions = []
    async for doc in cursor:
        if doc["_id"]: # Filter out null session_ids
            sess_id = doc["_id"]
            # Logic: Use custom title if exists, else first message, else "New Chat"
            custom_title = metadata_map.get(sess_id)
            default_title = doc["first_message"][:30] + "..." if doc.get("first_message") else "New Chat"
            
            sessions.append(Session(
                session_id=sess_id, 
                created_at=doc["created_at"],
                title=custom_title or default_title
            ))
    return sessions

@router.get("/history/{session_id}", response_model=HistoryResponse)
async def get_session_history(session_id: str, db=Depends(get_database)):
    chats = []
    cursor = db.history.find({"session_id": session_id}).sort("timestamp", 1)
    async for document in cursor:
        chats.append(ChatMessage(**document))
    return HistoryResponse(chats=chats)

@router.patch("/sessions/{session_id}", response_model=Session)
async def update_session_title(session_id: str, update: SessionUpdate, db=Depends(get_database)):
    # Upsert the title in 'sessions' collection
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"title": update.title, "session_id": session_id}},
        upsert=True
    )
    # Return structure is a bit fake here since we don't fetch created_at easily, 
    # but the frontend mostly cares about success.
    # We'll just return what we updated.
    return Session(session_id=session_id, title=update.title, created_at=datetime.now())
