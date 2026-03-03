"""
PageIndex API Server
====================
FastAPI backend that wraps existing PageIndex functions.
Provides endpoints for PDF upload, document chat, and processing stats.
"""

import os
import json
import time
import copy
import uuid
import asyncio
import shutil
from pathlib import Path
from types import SimpleNamespace as config

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Import existing PageIndex functions (no modifications to these)
from pageindex.page_index import page_index_main
from pageindex.utils import (
    Ollama_API_async, extract_json, remove_fields,
    count_tokens, structure_to_list, ConfigLoader
)

from fastapi.responses import FileResponse
from database import get_logger, get_chat_collection, get_doc_collection

logger = get_logger()
app = FastAPI(title="PageIndex API", version="1.0.0")

# Allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("./uploads")
RESULTS_DIR = Path("./results")
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)


# ─── Request / Response models ───────────────────────────────────────────────

class ChatRequest(BaseModel):
    doc_id: str
    question: str
    model: str = "gpt-oss:120b-cloud"


class ChatResponse(BaseModel):
    answer: str
    relevant_sections: list
    thinking: str
    tokens_used: int
    response_time: float


class DocumentInfo(BaseModel):
    doc_id: str
    doc_name: str
    status: str
    processing_time: Optional[float] = None
    total_tokens: Optional[int] = None
    num_sections: Optional[int] = None


# ─── Helper functions ────────────────────────────────────────────────────────

def create_node_mapping(tree):
    """Build a flat mapping of node_id -> node for quick lookup."""
    mapping = {}
    def traverse(nodes):
        if isinstance(nodes, list):
            for node in nodes:
                if isinstance(node, dict):
                    if 'node_id' in node:
                        mapping[node['node_id']] = node
                    if 'nodes' in node:
                        traverse(node['nodes'])
    traverse(tree)
    return mapping

def print_tree(nodes, level=0):
    """Recursively print the tree structure to the terminal."""
    if not isinstance(nodes, list):
        return
    for node in nodes:
        indent = "  " * level
        structure = node.get('structure', '')
        title = node.get('title', 'Unknown')
        print(f"{indent}- [{structure}] {title}")
        if 'nodes' in node and node['nodes']:
            print_tree(node['nodes'], level + 1)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/api/upload", response_model=DocumentInfo)
async def upload_pdf(file: UploadFile = File(...), model: str = "gpt-oss:120b-cloud"):
    """Upload a PDF and process it with PageIndex."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    doc_id = str(uuid.uuid4())[:8]
    pdf_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"

    # Save uploaded file
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Insert into MongoDB
    doc_collection = get_doc_collection()
    if doc_collection is not None:
        await doc_collection.insert_one({
            "doc_id": doc_id,
            "doc_name": file.filename,
            "pdf_path": str(pdf_path),
            "status": "processing",
            "processing_time": None,
            "total_tokens": None,
            "num_sections": None,
            "tree_data": None,
            "node_map": None,
            "timestamp": time.time()
        })
    else:
        logger.error("DB Not initialized. Upload failed.")
        raise HTTPException(status_code=500, detail="Database not connected")

    # Process in background
    asyncio.create_task(_process_pdf(doc_id, str(pdf_path), model))

    print(f"Document Submitted: {doc_id}")

    return DocumentInfo(
        doc_id=doc_id,
        doc_name=file.filename,
        status="processing",
    )


async def _process_pdf(doc_id: str, pdf_path: str, model: str):
    """Background task: run PageIndex on the uploaded PDF."""
    start_time = time.time()
    try:
        opt = config(
            model=model,
            toc_check_page_num=20,
            max_page_num_each_node=10,
            max_token_num_each_node=20000,
            if_add_node_id="yes",
            if_add_node_summary="yes",
            if_add_doc_description="no",
            if_add_node_text="no",
        )

        # Run the existing PageIndex pipeline (no changes to it)
        tree_data = await asyncio.to_thread(page_index_main, pdf_path, opt)

        processing_time = round(time.time() - start_time, 2)

        # Extract the structure
        if isinstance(tree_data, dict) and 'structure' in tree_data:
            tree_nodes = tree_data['structure']
        elif isinstance(tree_data, list):
            tree_nodes = tree_data
        else:
            tree_nodes = tree_data

        node_map = create_node_mapping(tree_nodes)

        # Count total tokens in all summaries
        total_tokens = 0
        for node in node_map.values():
            summary = node.get("summary", "")
            total_tokens += count_tokens(summary, model=model)

        # Save to results
        pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
        output_file = RESULTS_DIR / f"{pdf_name}_structure.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(tree_data, f, indent=2)

        # Update document store in MongoDB
        doc_collection = get_doc_collection()
        if doc_collection is not None:
            await doc_collection.update_one(
                {"doc_id": doc_id},
                {"$set": {
                    "status": "completed",
                    "processing_time": processing_time,
                    "total_tokens": total_tokens,
                    "num_sections": len(node_map),
                    "tree_data": tree_data,
                    "node_map": node_map
                }}
            )

        print("\nSimplified Tree Structure of the Document:")
        print_tree(tree_nodes)
        print() # Empty line for cleaner logs

        logger.info(f"📄 Document processed: {os.path.basename(pdf_path)} - {processing_time}s - {total_tokens} tokens - {len(node_map)} sections")

    except Exception as e:
        logger.error(f"❌ Error processing {doc_id}: {e}")
        doc_collection = get_doc_collection()
        if doc_collection is not None:
            await doc_collection.update_one(
                {"doc_id": doc_id},
                {"$set": {"status": "error", "error": str(e)}}
            )


@app.get("/api/status/{doc_id}", response_model=DocumentInfo)
async def get_status(doc_id: str):
    """Check processing status of a document from MongoDB."""
    doc_collection = get_doc_collection()
    if doc_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    doc = await doc_collection.find_one({"doc_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return DocumentInfo(
        doc_id=doc["doc_id"],
        doc_name=doc["doc_name"],
        status=doc["status"],
        processing_time=doc.get("processing_time"),
        total_tokens=doc.get("total_tokens"),
        num_sections=doc.get("num_sections"),
    )


@app.get("/api/documents")
async def list_documents():
    """List all processed documents from MongoDB."""
    doc_collection = get_doc_collection()
    if doc_collection is None:
        return []
        
    cursor = doc_collection.find().sort("timestamp", -1)
    docs = await cursor.to_list(length=1000)
    
    return [
        DocumentInfo(
            doc_id=doc["doc_id"],
            doc_name=doc["doc_name"],
            status=doc["status"],
            processing_time=doc.get("processing_time"),
            total_tokens=doc.get("total_tokens"),
            num_sections=doc.get("num_sections"),
        )
        for doc in docs
    ]

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document, its chat history, and physical files."""
    doc_collection = get_doc_collection()
    chat_collection = get_chat_collection()
    if doc_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    doc = await doc_collection.find_one({"doc_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete from MongoDB
    await doc_collection.delete_one({"doc_id": doc_id})
    if chat_collection is not None:
        await chat_collection.delete_many({"doc_id": doc_id})
        
    # Delete physical PDF if exists
    pdf_path = doc.get("pdf_path")
    if pdf_path and os.path.exists(pdf_path):
        os.remove(pdf_path)
    
    # Delete result JSON if exists
    pdf_name = os.path.splitext(os.path.basename(doc.get("doc_name", "")))[0]
    result_path = RESULTS_DIR / f"{doc_id}_{pdf_name}_structure.json" # Not always this format, but we'll try to clean up what we can.
    # Actually, tree results are saved as:
    pdf_name_actual_file = os.path.splitext(os.path.basename(pdf_path))[0]
    result_path_actual = RESULTS_DIR / f"{pdf_name_actual_file}_structure.json"
    if os.path.exists(result_path_actual):
        os.remove(result_path_actual)
        
    logger.info(f"🗑️ Deleted document {doc_id} successfully")
    return {"status": "success", "message": "Document deleted"}

@app.get("/api/documents/{doc_id}/view")
async def view_document(doc_id: str):
    """Serve the PDF file directly for viewing."""
    doc_collection = get_doc_collection()
    if doc_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    doc = await doc_collection.find_one({"doc_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    pdf_path = doc.get("pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")
        
    return FileResponse(pdf_path, media_type="application/pdf", filename=doc["doc_name"])


@app.get("/api/documents/{doc_id}/tree")
async def get_document_tree(doc_id: str):
    """Fetch the generated PageIndex tree structure for a document."""
    doc_collection = get_doc_collection()
    if doc_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    doc = await doc_collection.find_one({"doc_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Document tree not ready yet")

    tree_data = doc.get("tree_data")
    if isinstance(tree_data, dict) and 'structure' in tree_data:
        return {"result": tree_data['structure']}
    return {"result": tree_data}


@app.get("/api/chat/history/{doc_id}")
async def get_chat_history(doc_id: str):
    """Fetch chat history for a document from MongoDB."""
    chat_collection = get_chat_collection()
    if chat_collection is None:
        return []
    try:
        cursor = chat_collection.find({"doc_id": doc_id}).sort("timestamp", 1)
        history = await cursor.to_list(length=100)
        
        formatted_history = []
        for entry in history:
            formatted_history.append({
                "role": "user",
                "content": entry.get("user_query", "")
            })
            formatted_history.append({
                "role": "bot",
                "content": entry.get("bot_response", ""),
                "sections": entry.get("relevant_sections", []),
                "tokens": entry.get("tokens_used", 0),
                "time": entry.get("response_time", 0)
            })
        return formatted_history
    except Exception as e:
        print(f"❌ Error fetching chat history: {e}")
        return []


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Chat with a processed document using tree search + answer generation."""
    doc_collection = get_doc_collection()
    if doc_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    doc = await doc_collection.find_one({"doc_id": req.doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] != "completed":
        raise HTTPException(status_code=400, detail="Document is still processing")

    start_time = time.time()
    tokens_used = 0
    node_map = doc["node_map"]

    # Get tree without text for search prompt
    tree_data = doc["tree_data"]
    if isinstance(tree_data, dict) and 'structure' in tree_data:
        tree_nodes = tree_data['structure']
    else:
        tree_nodes = tree_data

    tree_for_search = remove_fields(copy.deepcopy(tree_nodes), fields=['text'])

    # ─── Step 1: LLM Tree Search ─────────────────────────────────────────
    search_prompt = f"""You are given a question and a tree structure of a document.
Each node contains a node_id, title, and summary.
Your task is to find all nodes that are likely to contain the answer to the question.

Question: {req.question}

Document tree structure:
{json.dumps(tree_for_search, indent=2)}

Reply in the following JSON format:
{{
    "thinking": "<your reasoning about which nodes are relevant>",
    "node_list": ["node_id_1", "node_id_2"]
}}
Directly return the final JSON structure. Do not output anything else."""

    tokens_used += count_tokens(search_prompt, model=req.model)
    search_response = await Ollama_API_async(req.model, search_prompt)
    tokens_used += count_tokens(search_response, model=req.model)

    search_result = extract_json(search_response)
    node_list = search_result.get("node_list", [])
    thinking = search_result.get("thinking", "")

    relevant_sections = []
    for nid in node_list:
        if nid in node_map:
            node = node_map[nid]
            relevant_sections.append({
                "node_id": nid,
                "title": node.get("title", "Unknown"),
                "start_index": node.get("start_index"),
                "end_index": node.get("end_index"),
            })

    # ─── Step 2: Context Extraction ──────────────────────────────────────
    relevant_content = "\n\n".join(
        node_map[nid].get("text", node_map[nid].get("summary", ""))
        for nid in node_list if nid in node_map
    )

    if not relevant_content.strip():
        return ChatResponse(
            answer="I couldn't find relevant information in the document for your question.",
            relevant_sections=relevant_sections,
            thinking=thinking,
            tokens_used=tokens_used,
            response_time=round(time.time() - start_time, 2),
        )

    # ─── Step 3: Answer Generation ───────────────────────────────────────
    answer_prompt = f"""You are a helpful, conversational, and expert AI assistant.
Your task is to answer the user's question clearly, naturally, and warmly, using ONLY the information provided in the Context below.

Guidelines:
1. Speak in a natural, human-like, and friendly tone.
2. Structure your answer beautifully (using paragraphs or bullet points if it helps readability).
3. If the answer cannot be found in the context, politely inform the user that the document doesn't contain that information, rather than making things up.
4. Do not mention that you are reading from a "context" or "provided text" - just answer the question directly as if you are the knowledgeable author of the document.

Context:
{relevant_content}

User Question: {req.question}

Please provide your conversational and helpful answer:"""

    tokens_used += count_tokens(answer_prompt, model=req.model)
    answer = await Ollama_API_async(req.model, answer_prompt)
    tokens_used += count_tokens(answer, model=req.model)

    response_time = round(time.time() - start_time, 2)

    logger.info(f"💬 Chat: \"{req.question[:50]}...\" → {tokens_used} tokens, {response_time}s")

    # ─── Save to MongoDB ─────────────────────────────────────────────────
    chat_collection = get_chat_collection()
    if chat_collection is not None:
        try:
            chat_entry = {
                "session_id": str(uuid.uuid4()),
                "doc_id": req.doc_id,
                "user_query": req.question,
                "bot_response": answer,
                "relevant_sections": relevant_sections,
                "tokens_used": tokens_used,
                "response_time": response_time,
                "timestamp": time.time()
            }
            await chat_collection.insert_one(chat_entry)
            print(f"💾 Chat history saved to MongoDB for doc_id {req.doc_id}")
        except Exception as e:
            print(f"⚠️ Failed to save chat history to MongoDB: {e}")

    return ChatResponse(
        answer=answer,
        relevant_sections=relevant_sections,
        thinking=thinking,
        tokens_used=tokens_used,
        response_time=response_time,
    )


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting PageIndex API server on http://localhost:8000")
    logger.info("📖 API docs at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
