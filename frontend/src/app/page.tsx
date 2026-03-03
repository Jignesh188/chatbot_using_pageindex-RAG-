'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import UploadModal from '@/components/UploadModal';

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
    tokens?: number;
    time?: number;
}

export default function Home() {
    const [documents, setDocuments] = useState<DocInfo[]>([]);
    const [activeDoc, setActiveDoc] = useState<DocInfo | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [chatStats, setChatStats] = useState({ totalTokens: 0, totalTime: 0 });
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const pollStatus = useCallback(async (docId: string) => {
        try {
            const res = await fetch(`/api/status/${docId}`);
            const data: DocInfo = await res.json();
            setDocuments(prev => prev.map(d => (d.doc_id === docId ? { ...d, ...data } : d)));
            if (data.status === 'completed' || data.status === 'error') {
                if (pollRef.current) clearInterval(pollRef.current);
                if (data.status === 'completed') {
                    setActiveDoc(data);
                    setMessages([
                        {
                            role: 'bot',
                            content: `**${data.doc_name}** processed successfully!\n\nI have indexed ${data.num_sections} sections from your document. You can now ask me questions about it, and I will find the most relevant information to answer them.`,
                        },
                    ]);
                } else if (data.status === 'error') {
                    setMessages([
                        {
                            role: 'bot',
                            content: `❌ **Error:** Failed to process ${data.doc_name}. Please try uploading again.`,
                        },
                    ]);
                }
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, []);

    const handleUpload = async (file: File) => {
        // Keep the modal open during upload, but show loading state
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Upload failed');

            // Close modal only on successful submit
            setShowUpload(false);
            setDocuments(prev => [...prev, data]);
            setActiveDoc(data);
            setMessages([
                {
                    role: 'bot',
                    content: `**${data.doc_name}** uploaded.\n\nExtracting document structure and indexing content. This usually takes a few seconds...`,
                },
            ]);
            pollRef.current = setInterval(() => pollStatus(data.doc_id), 3000);
        } catch (err: any) {
            alert(`Error uploading file: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = async (question: string) => {
        if (!activeDoc || activeDoc.status !== 'completed') return;
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setIsThinking(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_id: activeDoc.doc_id, question }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Chat failed');

            setChatStats(prev => ({
                totalTokens: prev.totalTokens + data.tokens_used,
                totalTime: prev.totalTime + data.response_time,
            }));
            setMessages(prev => [
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
            setMessages(prev => [...prev, { role: 'bot', content: `❌ Error connecting to server: ${err.message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSelectDoc = (doc: DocInfo) => {
        if (activeDoc?.doc_id === doc.doc_id) return; // Prevent unnecessary re-renders

        setActiveDoc(doc);
        setMessages([]);
        setChatStats({ totalTokens: 0, totalTime: 0 });
        if (doc.status === 'completed') {
            setMessages([
                {
                    role: 'bot',
                    content: `**${doc.doc_name}** is loaded and ready.\n\nWhat would you like to know about this document?`,
                },
            ]);
        } else if (doc.status === 'processing') {
            setMessages([
                {
                    role: 'bot',
                    content: `**${doc.doc_name}** is currently being processed. Please wait...`,
                },
            ]);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(() => pollStatus(doc.doc_id), 3000);
        }
    };

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50/50">
            <Sidebar
                documents={documents}
                activeDoc={activeDoc}
                onSelectDoc={handleSelectDoc}
                onUploadClick={() => setShowUpload(true)}
                chatStats={chatStats}
            />
            <ChatArea
                activeDoc={activeDoc}
                messages={messages}
                isThinking={isThinking}
                onSend={handleSend}
            />
            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUpload={handleUpload}
                    isUploading={isUploading}
                />
            )}
        </div>
    );
}
