'use client';

import { useState } from 'react';

interface TreeNode {
    title: string;
    structure: string;
    physical_index?: number;
    start_index?: number;
    end_index?: number;
    summary?: string;
    prefix_summary?: string;
    nodes?: TreeNode[];
    node_id?: string;
}

interface TreeViewerProps {
    treeData: TreeNode[];
    onClose: () => void;
    docName: string;
}

function RecursiveTreeNode({ node, level = 0 }: { node: TreeNode; level?: number }) {
    const [isExpanded, setIsExpanded] = useState(level < 1);
    const hasChildren = node.nodes && node.nodes.length > 0;

    return (
        <div className="flex flex-col">
            <div
                className={`flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-navy-50 group transition-colors ${level === 0 ? 'mt-2' : 'mt-1'}`}
                style={{ marginLeft: `${level * 16}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="mt-0.5 p-0.5 text-gray-400 hover:text-navy hover:bg-white rounded transition-colors shrink-0"
                    >
                        <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        >
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                ) : (
                    <div className="w-[18px] shrink-0" /> // Spacer for alignment
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-navy bg-navy-50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {node.structure}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                            {node.title}
                        </h4>
                        {node.start_index !== undefined && (
                            <span className="text-[10px] font-medium text-gray-400 shrink-0">
                                p. {node.start_index} {node.end_index && node.end_index !== node.start_index ? `- ${node.end_index}` : ''}
                            </span>
                        )}
                    </div>
                    {node.summary && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                            {node.summary}
                        </p>
                    )}
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="flex flex-col">
                    {node.nodes!.map((child, idx) => (
                        <RecursiveTreeNode key={`${child.structure}-${idx}`} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TreeViewer({ treeData, onClose, docName }: TreeViewerProps) {
    if (!treeData || treeData.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col items-center justify-center p-8 animate-[scale-in_0.2s_ease-out]">
                    <p className="text-gray-500 font-medium">No tree structure available for this document.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-[scale-in_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shadow-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">Document Structure</h2>
                            <p className="text-xs font-medium text-gray-500 truncate max-w-md">{docName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin bg-white">
                    <div className="max-w-3xl mx-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                        {treeData.map((node, idx) => (
                            <RecursiveTreeNode key={`${node.structure}-${idx}`} node={node} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
