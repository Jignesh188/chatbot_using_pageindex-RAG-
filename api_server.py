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

app = FastAPI(title="PageIndex API", version="1.0.0")

# Allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for processed documents
documents = {}

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

    # Mark as processing
    documents[doc_id] = {
        "doc_id": doc_id,
        "doc_name": file.filename,
        "pdf_path": str(pdf_path),
        "status": "processing",
        "processing_time": None,
        "total_tokens": None,
        "num_sections": None,
        "tree_data": None,
        "node_map": None,
    }

    # Process in background
    asyncio.create_task(_process_pdf(doc_id, str(pdf_path), model))

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

        # Update document store
        documents[doc_id].update({
            "status": "completed",
            "processing_time": processing_time,
            "total_tokens": total_tokens,
            "num_sections": len(node_map),
            "tree_data": tree_data,
            "node_map": node_map,
        })

        print(f"\n{'='*60}")
        print(f"📄 Document processed: {os.path.basename(pdf_path)}")
        print(f"⏱️  Processing time: {processing_time}s")
        print(f"🔢 Tokens used: {total_tokens}")
        print(f"📑 Sections found: {len(node_map)}")
        print(f"{'='*60}\n")

    except Exception as e:
        documents[doc_id]["status"] = "error"
        documents[doc_id]["error"] = str(e)
        print(f"❌ Error processing {doc_id}: {e}")


@app.get("/api/status/{doc_id}", response_model=DocumentInfo)
async def get_status(doc_id: str):
    """Check processing status of a document."""
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = documents[doc_id]
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
    """List all processed documents."""
    return [
        DocumentInfo(
            doc_id=doc["doc_id"],
            doc_name=doc["doc_name"],
            status=doc["status"],
            processing_time=doc.get("processing_time"),
            total_tokens=doc.get("total_tokens"),
            num_sections=doc.get("num_sections"),
        )
        for doc in documents.values()
    ]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Chat with a processed document using tree search + answer generation."""
    if req.doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = documents[req.doc_id]
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
    answer_prompt = f"""Answer the question based on the context below.
If the answer cannot be found in the context, say so clearly.

Question: {req.question}
Context: {relevant_content}

Provide a clear, concise answer based only on the context provided."""

    tokens_used += count_tokens(answer_prompt, model=req.model)
    answer = await Ollama_API_async(req.model, answer_prompt)
    tokens_used += count_tokens(answer, model=req.model)

    response_time = round(time.time() - start_time, 2)

    print(f"💬 Chat: \"{req.question[:50]}...\" → {tokens_used} tokens, {response_time}s")

    return ChatResponse(
        answer=answer,
        relevant_sections=relevant_sections,
        thinking=thinking,
        tokens_used=tokens_used,
        response_time=response_time,
    )


if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting PageIndex API server on http://localhost:8000")
    print("📖 API docs at http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
