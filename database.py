import os
import logging
from dotenv import load_dotenv
import motor.motor_asyncio
from typing import TypedDict, List, Optional

# Load environment variables from .env
load_dotenv()

# Setup Logger
logger = logging.getLogger("PageIndexAPI")
logger.setLevel(logging.INFO)
# Prevent duplicate logs if handler exists
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# Get MONGO_URI from .env
MONGO_URI = os.getenv("MONGO_URI")

# Define schema types for clarity
class ChatHistoryEntry(TypedDict):
    doc_id: str
    user_query: str
    bot_response: str
    relevant_sections: List[dict]
    tokens_used: int
    response_time: float
    timestamp: float

class DocumentEntry(TypedDict):
    doc_id: str
    doc_name: str
    pdf_path: str
    status: str
    processing_time: Optional[float]
    total_tokens: Optional[int]
    num_sections: Optional[int]
    tree_data: Optional[dict]
    node_map: Optional[dict]

# MongoDB Connection State
db_client = None
db = None
chat_collection = None
doc_collection = None

# Vector RAG Collections
vrag_doc_collection = None
vrag_chunks_collection = None
vrag_chat_collection = None

def init_db():
    global db_client, db, chat_collection, doc_collection
    global vrag_doc_collection, vrag_chunks_collection, vrag_chat_collection
    if not MONGO_URI:
        logger.error("MONGO_URI not found in environment variables.")
        return False
        
    try:
        db_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = db_client["PageindexVSRag"]
        
        # PageIndex collections (unchanged)
        chat_collection = db["pageindexchathistory"]
        doc_collection = db["pageindexdocuments"]
        
        # Vector RAG collections
        vrag_doc_collection = db["vectorrag_documents"]
        vrag_chunks_collection = db["vectorrag_chunks"]
        vrag_chat_collection = db["vectorrag_chathistory"]
        
        logger.info("Connected to MongoDB successfully!")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return False

# Initialize DB when module is imported
init_db()

def get_chat_collection():
    return chat_collection

def get_doc_collection():
    return doc_collection

def get_vrag_doc_collection():
    return vrag_doc_collection

def get_vrag_chunks_collection():
    return vrag_chunks_collection

def get_vrag_chat_collection():
    return vrag_chat_collection

def get_logger():
    return logger
