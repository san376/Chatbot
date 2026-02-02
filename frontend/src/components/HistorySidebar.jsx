import React, { useEffect, useState } from 'react';
import { getSessions, updateSessionTitle, deleteSession } from '../api/client';
import { MessageSquare, Plus, Clock, Pencil, Check, X, Trash2 } from 'lucide-react';

const HistorySidebar = ({ onSessionClick, onNewChat }) => {
    const [sessions, setSessions] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchSessions = async () => {
        try {
            const data = await getSessions();
            setSessions(data);
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
        }
    };

    const startEditing = (e, session) => {
        e.stopPropagation();
        setEditingId(session.session_id);
        setEditTitle(session.title || "New Chat");
    };

    const saveTitle = async (e) => {
        e.stopPropagation();
        try {
            await updateSessionTitle(editingId, editTitle);
            setEditingId(null);
            fetchSessions();
        } catch (error) {
            console.error("Failed to update title", error);
        }
    };

    const cancelEditing = (e) => {
        e.stopPropagation();
        setEditingId(null);
    };

    const handleDelete = async (e, sessionId) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this chat?")) {
            try {
                await deleteSession(sessionId);
                fetchSessions(); // Refresh list
            } catch (error) {
                console.error("Failed to delete session", error);
            }
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-white h-full flex flex-col border-r border-gray-800">
            {/* Header with New Chat Button */}
            <div className="p-4 border-b border-gray-800 space-y-4">
                <h2 className="font-semibold text-lg flex items-center">
                    <Clock size={20} className="mr-2 text-blue-400" />
                    History
                </h2>
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
                >
                    <Plus size={18} />
                    <span>New Chat</span>
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sessions.length === 0 && (
                    <div className="text-gray-500 text-sm text-center mt-10">
                        No chats yet
                    </div>
                )}
                {sessions.map((session) => (
                    <div
                        key={session.session_id}
                        onClick={() => onSessionClick(session.session_id)}
                        className="group p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition cursor-pointer flex items-center justify-between"
                        title={new Date(session.created_at).toLocaleString()}
                    >
                        <div className="flex items-center min-w-0 flex-1 mr-2">
                            <MessageSquare size={16} className="text-gray-400 mr-2 flex-shrink-0" />

                            {editingId === session.session_id ? (
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-gray-700 text-white text-sm rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                />
                            ) : (
                                <div className="truncate text-sm text-gray-300">
                                    {session.title || "New Chat"}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                            {editingId === session.session_id ? (
                                <>
                                    <button onClick={saveTitle} className="p-1 hover:text-green-400 text-gray-400"><Check size={14} /></button>
                                    <button onClick={cancelEditing} className="p-1 hover:text-red-400 text-gray-400"><X size={14} /></button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={(e) => startEditing(e, session)}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-white text-gray-500 transition-opacity"
                                        title="Rename"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, session.session_id)}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500 transition-opacity"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HistorySidebar;
