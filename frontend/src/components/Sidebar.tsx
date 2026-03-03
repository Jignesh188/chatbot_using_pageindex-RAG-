'use client';

interface DocInfo {
    doc_id: string;
    doc_name: string;
    status: string;
    processing_time?: number;
    total_tokens?: number;
    num_sections?: number;
}

interface SidebarProps {
    documents: DocInfo[];
    activeDoc: DocInfo | null;
    onSelectDoc: (doc: DocInfo) => void;
    onUploadClick: () => void;
    onDeleteDoc: (docId: string) => void;
    onViewDoc: (docId: string) => void;
    chatStats: { totalTokens: number; totalTime: number };
}

export default function Sidebar({ documents, activeDoc, onSelectDoc, onUploadClick, onDeleteDoc, onViewDoc, chatStats }: SidebarProps) {
    return (
        <div className="w-[300px] min-w-[300px] bg-gray-50 border-r border-gray-200 flex flex-col h-screen transition-all">
            {/* Header */}
            <div className="px-6 pt-8 pb-6 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shadow-md">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">PageIndex</h1>
                </div>

                <button
                    onClick={onUploadClick}
                    className="w-full py-2.5 px-4 bg-navy text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-navy-light transition-all shadow-sm hover:shadow-md cursor-pointer group"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload Document
                </button>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-gray-50">
                <div className="flex items-center justify-between mb-3 px-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Your Documents
                    </p>
                    <span className="text-[10px] font-medium bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                        {documents.length}
                    </span>
                </div>

                <div className="space-y-1">
                    {documents.map((doc) => {
                        const isActive = activeDoc?.doc_id === doc.doc_id;
                        return (
                            <div
                                key={doc.doc_id}
                                onClick={() => onSelectDoc(doc)}
                                className={`group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive
                                    ? 'bg-white shadow-sm border border-gray-200'
                                    : 'hover:bg-white border border-transparent hover:border-gray-200'
                                    }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors ${isActive
                                        ? 'bg-navy-50 text-navy'
                                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600'
                                        }`}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>{doc.doc_name}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {doc.status === 'completed' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                        {doc.status === 'processing' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                        {doc.status === 'error' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}

                                        <p
                                            className={`text-[11px] font-medium tracking-wide ${doc.status === 'completed'
                                                ? 'text-emerald-600'
                                                : doc.status === 'processing'
                                                    ? 'text-amber-600'
                                                    : doc.status === 'error'
                                                        ? 'text-red-600'
                                                        : 'text-gray-500'
                                                }`}
                                        >
                                            {doc.status === 'completed'
                                                ? `Ready • ${doc.num_sections} sections`
                                                : doc.status === 'processing'
                                                    ? 'Processing...'
                                                    : doc.status === 'error'
                                                        ? 'Failed to process'
                                                        : doc.status}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onViewDoc(doc.doc_id); }}
                                        className="p-1.5 text-gray-400 hover:text-navy hover:bg-navy-50 rounded-md transition-colors"
                                        title="View PDF"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.doc_id); }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Delete Document"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {documents.length === 0 && (
                    <div className="text-center py-12 px-4 animate-[fade-in_0.3s_ease]">
                        <div className="w-12 h-12 bg-white rounded-xl mx-auto flex items-center justify-center border border-gray-200 mb-3 shadow-sm">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="12" y1="18" x2="12" y2="12"></line>
                                <line x1="9" y1="15" x2="15" y2="15"></line>
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900">No documents</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">Upload a PDF to start extracting answers</p>
                    </div>
                )}
            </div>

            {/* Stats Panel */}
            {activeDoc?.status === 'completed' && (
                <div className="p-4 border-t border-gray-200 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10 animate-[slide-up_0.3s_ease-out]">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900">Runtime Stats</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <StatCard label="Process Cost" value={`${activeDoc.processing_time}s`} />
                        <StatCard label="Token Setup" value={activeDoc.total_tokens?.toLocaleString() || '0'} />
                        <StatCard label="Chat Time" value={`${Math.round(chatStats.totalTime * 10) / 10}s`} />
                        <StatCard label="Chat Tokens" value={chatStats.totalTokens.toLocaleString()} />
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
            <p className="text-[10px] font-semibold tracking-wide text-gray-500 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-navy truncate">{value}</p>
        </div>
    );
}
