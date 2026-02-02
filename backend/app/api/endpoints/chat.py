from fastapi import APIRouter, Depends, HTTPException, Body
from app.models.chat import ChatRequest, ChatResponse, HistoryResponse, ChatMessage, Session, SessionUpdate
from app.db.database import get_database
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
from app.core.config import settings
from datetime import datetime
import uuid
from typing import List
import base64
import io
import pypdf

router = APIRouter()

llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", google_api_key=settings.GEMINI_API_KEY)

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db=Depends(get_database)):
    session_id = request.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Process Attachments
    content_parts = []
    
    # Add text message if present
    if request.message:
        content_parts.append({"type": "text", "text": request.message})
        
    for attachment in (request.attachments or []):
        try:
            file_data = base64.b64decode(attachment.data)
            
            if attachment.content_type == "application/pdf":
                # Extract text from PDF
                pdf_reader = pypdf.PdfReader(io.BytesIO(file_data))
                text_content = ""
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
                
                content_parts.append({"type": "text", "text": f"\n\n[Content from PDF {attachment.filename}]:\n{text_content}"})
            
            elif attachment.content_type.startswith("image/"):
                # Pass image to Gemini
                # LangChain Google GenAI expects image_url with data uri for base64 images
                # Format: data:image/jpeg;base64,...
                # We need to reconstruct the data uri or pass it directly if supported.
                # ChatGoogleGenerativeAI supports {"type": "image_url", "image_url": "data:..."}
                
                # Ensure we have the full data URI
                data_uri = f"data:{attachment.content_type};base64,{attachment.data}"
                content_parts.append({
                    "type": "image_url", 
                    "image_url": {"url": data_uri}
                })
                
        except Exception as e:
            print(f"Error processing attachment {attachment.filename}: {e}")
            content_parts.append({"type": "text", "text": f"[Error reading {attachment.filename}]"})

    # 1. Save User Message
    # For storage, we'll store the text representation. Storing large base64 strings in MongoDB history might bloat it.
    # For now we will store the text message + a note about attachments.
    # Ideally we'd store attachments separately or in GridFS, but for this simple app simpler is better.
    # We will strip the base64 data from the saved history to avoid DB explosion.
    
    saved_attachments = []
    if request.attachments:
        for att in request.attachments:
            saved_attachments.append({
                "filename": att.filename, 
                "content_type": att.content_type, 
                "data": "<base64_content_omitted>" # Don't save heavy data to history
            })

    user_msg_content = request.message
    if request.attachments:
         user_msg_content += f" [Attached {len(request.attachments)} file(s)]"

    user_msg = ChatMessage(
        role="user", 
        content=user_msg_content, 
        timestamp=datetime.now(), 
        session_id=session_id,
        attachments=saved_attachments # This relies on the model allowing this structure, which we updated.
    )
    # Note: We need to cast our "saved_attachments" dict back to Attachment model or just dict?
    # Our DB insert accepts dict. The Pydantic model expects Attachment objects.
    # We should probably just relax the DB insert or create proper objects with empty data.
    # Let's just insert as dict.
    await db.history.insert_one(user_msg.dict())

    # 2. Generate Response
    try:
        response_msg = llm.invoke([HumanMessage(content=content_parts)])
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
    
    # 3. Save AI Response
    ai_content = response_msg.content
    if isinstance(ai_content, list):
        # Extract text from list of content parts
        ai_content = "\n".join([item.get("text", "") for item in ai_content if isinstance(item, dict) and item.get("type") == "text"])
    elif not isinstance(ai_content, str):
        ai_content = str(ai_content)

    ai_msg = ChatMessage(role="assistant", content=ai_content, timestamp=datetime.now(), session_id=session_id)
    await db.history.insert_one(ai_msg.dict())

    return ChatResponse(response=ai_content, session_id=session_id)

@router.get("/sessions", response_model=List[Session])
async def get_sessions(db=Depends(get_database)):
    # 1. Get raw sessions from history (group by session_id)
    pipeline = [
        {"$group": {"_id": "$session_id", "created_at": {"$min": "$timestamp"}, "first_message": {"$first": "$content"}}},
        {"$sort": {"created_at": -1}}
    ]
    cursor = db.history.aggregate(pipeline)
    
    # 2. Get all persistent session metadata (titles)
    metadata_cursor = db.sessions.find({})
    metadata_map = {}
    async for doc in metadata_cursor:
        metadata_map[doc["session_id"]] = doc["title"]

    sessions = []
    async for doc in cursor:
        if doc["_id"]: 
            sess_id = doc["_id"]
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
        # Handle potential missing attachments field in old documents
        if "attachments" not in document:
            document["attachments"] = None
        chats.append(ChatMessage(**document))
    return HistoryResponse(chats=chats)

@router.patch("/sessions/{session_id}", response_model=Session)
async def update_session_title(session_id: str, update: SessionUpdate, db=Depends(get_database)):
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"title": update.title, "session_id": session_id}},
        upsert=True
    )
    return Session(session_id=session_id, title=update.title, created_at=datetime.now())
