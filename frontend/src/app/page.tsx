'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import ComparisonView from '@/components/ComparisonView';
import UploadModal from '@/components/UploadModal';
import TreeViewer from '@/components/TreeViewer';
import VectorChunksViewer from '@/components/VectorChunksViewer';

interface DocInfo {
    doc_id: string;
    doc_name: string;
    status: string;
    processing_time?: number;
    total_tokens?: number;
    num_sections?: number;
}

interface Message {
    role: 'user' | 'bot';
    content: string;
    sections?: { node_id: string; title: string; start_index?: number; end_index?: number }[];
    chunks?: any[];
    tokens?: number;
    time?: number;
}

interface VRAGStatus {
    doc_id: string;
    status: string;
    num_chunks: number;
    num_pages: number;
    embedding_dim: number;
    total_text_tokens: number;
    total_chunk_tokens: number;
    processing_time?: number;
    extract_time?: number;
    chunk_time?: number;
    embed_time?: number;
}

export default function Home() {
    const [documents, setDocuments] = useState<DocInfo[]>([]);
    const [activeDoc, setActiveDoc] = useState<DocInfo | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

    // PageIndex state
    const [piMessages, setPiMessages] = useState<Message[]>([]);
    const [piIsThinking, setPiIsThinking] = useState(false);
    const [piStats, setPiStats] = useState({ totalTokens: 0, totalTime: 0 });

    // Vector RAG state
    const [vragMessages, setVragMessages] = useState<Message[]>([]);
    const [vragIsThinking, setVragIsThinking] = useState(false);
    const [vragStatus, setVragStatus] = useState<VRAGStatus | null>(null);
    const [vragStats, setVragStats] = useState({ totalTokens: 0, totalTime: 0 });

    // Tree Viewer states
    const [showTreeViewer, setShowTreeViewer] = useState(false);
    const [treeData, setTreeData] = useState<any[] | null>(null);
    const [isLoadingTree, setIsLoadingTree] = useState(false);

    // Chunks Viewer states
    const [showChunksViewer, setShowChunksViewer] = useState(false);
    const [chunksData, setChunksData] = useState<any[]>([]);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const vragPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch existing documents on load
    useEffect(() => {
        const fetchDocs = async () => {
            try {
                const res = await fetch('/api/documents');
                if (res.ok) {
                    const data = await res.json();
                    setDocuments(data);
                }
            } catch (err) {
                console.error('Failed to fetch documents', err);
            }
        };
        fetchDocs();
    }, []);

    // Poll PageIndex status
    const pollStatus = useCallback(async (docId: string) => {
        try {
            const res = await fetch(`/api/status/${docId}`);
            const data: DocInfo = await res.json();
            setDocuments(prev => prev.map(d => (d.doc_id === docId ? { ...d, ...data } : d)));
            if (data.status === 'completed' || data.status === 'error') {
                if (pollRef.current) clearInterval(pollRef.current);
                if (data.status === 'completed') {
                    setActiveDoc(data);
                    setPiMessages([
                        {
                            role: 'bot',
                            content: `**${data.doc_name}** processed successfully!\n\n🌳 I have indexed **${data.num_sections} sections** from your document using PageIndex tree structure.`,
                        },
                    ]);
                } else if (data.status === 'error') {
                    setPiMessages([
                        {
                            role: 'bot',
                            content: `❌ **Error:** Failed to process ${data.doc_name} with PageIndex. Please try uploading again.`,
                        },
                    ]);
                }
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, []);

    // Poll Vector RAG status
    const pollVragStatus = useCallback(async (docId: string) => {
        try {
            const res = await fetch(`/api/vector-rag/status/${docId}`);
            const data: VRAGStatus = await res.json();
            setVragStatus(data);
            if (data.status === 'completed' || data.status === 'error') {
                if (vragPollRef.current) clearInterval(vragPollRef.current);
                if (data.status === 'completed') {
                    setVragMessages([
                        {
                            role: 'bot',
                            content: `🔮 **Vector RAG** ready!\n\nI've created **${data.num_chunks} chunks** with **${data.embedding_dim}d** embeddings from your document.`,
                        },
                    ]);
                } else if (data.status === 'error') {
                    setVragMessages([
                        {
                            role: 'bot',
                            content: `❌ **Error:** Failed to process with Vector RAG. Please try uploading again.`,
                        },
                    ]);
                }
            }
        } catch (err) {
            console.error('VRAG Poll error:', err);
        }
    }, []);

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Upload failed');

            setShowUpload(false);
            setDocuments(prev => [...prev, data]);
            setActiveDoc(data);

            setPiMessages([
                {
                    role: 'bot',
                    content: `**${data.doc_name}** uploaded.\n\n🌳 **PageIndex:** Extracting document structure and indexing content...`,
                },
            ]);
            setVragMessages([
                {
                    role: 'bot',
                    content: `**${data.doc_name}** uploaded.\n\n🔮 **Vector RAG:** Creating chunks and generating embeddings...`,
                },
            ]);
            setVragStatus({ doc_id: data.doc_id, status: 'processing', num_chunks: 0, num_pages: 0, embedding_dim: 0, total_text_tokens: 0, total_chunk_tokens: 0 });

            // Start polling both
            pollRef.current = setInterval(() => pollStatus(data.doc_id), 3000);
            vragPollRef.current = setInterval(() => pollVragStatus(data.doc_id), 3000);
        } catch (err: any) {
            alert(`Error uploading file: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Send question to BOTH engines simultaneously
    const handleSend = async (question: string) => {
        if (!activeDoc || activeDoc.status !== 'completed') return;

        // Add user message to both panels
        const userMsg: Message = { role: 'user', content: question };
        setPiMessages(prev => [...prev, userMsg]);
        setVragMessages(prev => [...prev, userMsg]);
        setPiIsThinking(true);
        setVragIsThinking(true);

        // Fire both requests in parallel
        const piPromise = fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_id: activeDoc.doc_id, question }),
        });

        const vragPromise = fetch('/api/vector-rag/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_id: activeDoc.doc_id, question }),
        });

        // Handle PageIndex response
        piPromise.then(async (res) => {
            try {
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Chat failed');
                setPiStats(prev => ({
                    totalTokens: prev.totalTokens + data.tokens_used,
                    totalTime: prev.totalTime + data.response_time,
                }));
                setPiMessages(prev => [
                    ...prev,
                    {
                        role: 'bot',
                        content: data.answer,
                        sections: data.relevant_sections,
                        tokens: data.tokens_used,
                        time: data.response_time,
                    },
                ]);
            } catch (err: any) {
                setPiMessages(prev => [...prev, { role: 'bot', content: `❌ Error: ${err.message}` }]);
            } finally {
                setPiIsThinking(false);
            }
        }).catch((err) => {
            setPiMessages(prev => [...prev, { role: 'bot', content: `❌ Network error: ${err.message}` }]);
            setPiIsThinking(false);
        });

        // Handle Vector RAG response
        vragPromise.then(async (res) => {
            try {
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Chat failed');
                setVragStats(prev => ({
                    totalTokens: prev.totalTokens + data.tokens_used,
                    totalTime: prev.totalTime + data.response_time,
                }));
                setVragMessages(prev => [
                    ...prev,
                    {
                        role: 'bot',
                        content: data.answer,
                        chunks: data.relevant_chunks,
                        tokens: data.tokens_used,
                        time: data.response_time,
                    },
                ]);
            } catch (err: any) {
                setVragMessages(prev => [...prev, { role: 'bot', content: `❌ Error: ${err.message}` }]);
            } finally {
                setVragIsThinking(false);
            }
        }).catch((err) => {
            setVragMessages(prev => [...prev, { role: 'bot', content: `❌ Network error: ${err.message}` }]);
            setVragIsThinking(false);
        });
    };

    const handleSelectDoc = async (doc: DocInfo) => {
        if (activeDoc?.doc_id === doc.doc_id) return;

        setActiveDoc(doc);
        setPiMessages([]);
        setVragMessages([]);
        setPiStats({ totalTokens: 0, totalTime: 0 });
        setVragStats({ totalTokens: 0, totalTime: 0 });
        setVragStatus(null);

        if (doc.status === 'completed') {
            const piMsg: Message = {
                role: 'bot',
                content: `**${doc.doc_name}** is loaded and ready.\n\n🌳 **PageIndex** — ${doc.num_sections} sections indexed.`,
            };
            setPiMessages([piMsg]);

            // Fetch Vector RAG status
            try {
                const vragRes = await fetch(`/api/vector-rag/status/${doc.doc_id}`);
                const vragData: VRAGStatus = await vragRes.json();
                setVragStatus(vragData);

                if (vragData.status === 'completed') {
                    setVragMessages([{
                        role: 'bot',
                        content: `**${doc.doc_name}** is loaded and ready.\n\n🔮 **Vector RAG** — ${vragData.num_chunks} chunks embedded.`,
                    }]);
                } else if (vragData.status === 'processing') {
                    setVragMessages([{
                        role: 'bot',
                        content: `🔮 **Vector RAG** is still processing this document...`,
                    }]);
                    vragPollRef.current = setInterval(() => pollVragStatus(doc.doc_id), 3000);
                } else {
                    setVragMessages([{
                        role: 'bot',
                        content: `🔮 **Vector RAG** data not available for this document.`,
                    }]);
                }
            } catch (err) {
                console.error('Failed to fetch VRAG status:', err);
            }

            // Fetch PageIndex chat history
            try {
                const piHistRes = await fetch(`/api/chat/history/${doc.doc_id}`);
                if (piHistRes.ok) {
                    const piHistory: Message[] = await piHistRes.json();
                    if (piHistory && piHistory.length > 0) {
                        setPiMessages([piMsg, ...piHistory]);
                        let tTokens = 0, tTime = 0;
                        piHistory.forEach(msg => {
                            if (msg.role === 'bot') {
                                tTokens += msg.tokens || 0;
                                tTime += msg.time || 0;
                            }
                        });
                        setPiStats({ totalTokens: tTokens, totalTime: Math.round(tTime * 100) / 100 });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch PI chat history:', err);
            }

            // Fetch Vector RAG chat history
            try {
                const vragHistRes = await fetch(`/api/vector-rag/chat/history/${doc.doc_id}`);
                if (vragHistRes.ok) {
                    const vragHistory: Message[] = await vragHistRes.json();
                    if (vragHistory && vragHistory.length > 0) {
                        setVragMessages(prev => {
                            const initialMsg = prev.length > 0 ? [prev[0]] : [];
                            return [...initialMsg, ...vragHistory];
                        });
                        let tTokens = 0, tTime = 0;
                        vragHistory.forEach(msg => {
                            if (msg.role === 'bot') {
                                tTokens += msg.tokens || 0;
                                tTime += msg.time || 0;
                            }
                        });
                        setVragStats({ totalTokens: tTokens, totalTime: Math.round(tTime * 100) / 100 });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch VRAG chat history:', err);
            }

        } else if (doc.status === 'processing') {
            setPiMessages([{
                role: 'bot',
                content: `**${doc.doc_name}** is currently being processed. Please wait...`,
            }]);
            setVragMessages([{
                role: 'bot',
                content: `🔮 **Vector RAG** is processing this document...`,
            }]);
            setVragStatus({ doc_id: doc.doc_id, status: 'processing', num_chunks: 0, num_pages: 0, embedding_dim: 0, total_text_tokens: 0, total_chunk_tokens: 0 });
            if (pollRef.current) clearInterval(pollRef.current);
            if (vragPollRef.current) clearInterval(vragPollRef.current);
            pollRef.current = setInterval(() => pollStatus(doc.doc_id), 3000);
            vragPollRef.current = setInterval(() => pollVragStatus(doc.doc_id), 3000);
        }
    };

    const handleViewDoc = (docId: string) => {
        window.open(`/api/documents/${docId}/view`, '_blank');
    };

    const handleViewTree = async () => {
        if (!activeDoc) return;
        setIsLoadingTree(true);
        try {
            const res = await fetch(`/api/documents/${activeDoc.doc_id}/tree`);
            if (res.ok) {
                const data = await res.json();
                setTreeData(data.result);
                setShowTreeViewer(true);
            } else {
                alert('Failed to load document structure tree');
            }
        } catch (err) {
            console.error('Tree loading error:', err);
            alert('Error loading document structure');
        } finally {
            setIsLoadingTree(false);
        }
    };

    const handleViewChunks = async () => {
        if (!activeDoc) return;
        try {
            const res = await fetch(`/api/vector-rag/chunks/${activeDoc.doc_id}`);
            if (res.ok) {
                const data = await res.json();
                setChunksData(data);
                setShowChunksViewer(true);
            } else {
                alert('Failed to load chunks data');
            }
        } catch (err) {
            console.error('Chunks loading error:', err);
            alert('Error loading chunks');
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm('Are you sure you want to delete this document and all its data (PageIndex + Vector RAG)?')) return;

        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.doc_id !== docId));
                if (activeDoc?.doc_id === docId) {
                    setActiveDoc(null);
                    setPiMessages([]);
                    setVragMessages([]);
                    setPiStats({ totalTokens: 0, totalTime: 0 });
                    setVragStats({ totalTokens: 0, totalTime: 0 });
                    setVragStatus(null);
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (vragPollRef.current) clearInterval(vragPollRef.current);
                }
            } else {
                alert('Failed to delete document');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Error deleting document');
        }
    };

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (vragPollRef.current) clearInterval(vragPollRef.current);
        };
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50/50">
            <Sidebar
                documents={documents}
                activeDoc={activeDoc}
                onSelectDoc={handleSelectDoc}
                onUploadClick={() => setShowUpload(true)}
                onDeleteDoc={handleDeleteDoc}
                onViewDoc={handleViewDoc}
                piStats={piStats}
                vragStats={vragStats}
                vragStatus={vragStatus}
            />
            <ComparisonView
                activeDoc={activeDoc}
                piMessages={piMessages}
                piIsThinking={piIsThinking}
                piOnViewTree={handleViewTree}
                vragMessages={vragMessages}
                vragIsThinking={vragIsThinking}
                vragStatus={vragStatus}
                onSend={handleSend}
                onViewChunks={handleViewChunks}
            />
            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUpload={handleUpload}
                    isUploading={isUploading}
                />
            )}
            {showTreeViewer && treeData && (
                <TreeViewer
                    treeData={treeData}
                    onClose={() => setShowTreeViewer(false)}
                    docName={activeDoc?.doc_name || 'Document'}
                />
            )}
            {showChunksViewer && (
                <VectorChunksViewer
                    chunks={chunksData}
                    vragStatus={vragStatus}
                    onClose={() => setShowChunksViewer(false)}
                    docName={activeDoc?.doc_name || 'Document'}
                />
            )}
        </div>
    );
}
