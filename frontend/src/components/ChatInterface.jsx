import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendMessage } from '../api/client';
import { Send, Bot, User, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

const ChatInterface = ({ messages, setMessages, currentSessionId, setCurrentSessionId }) => {
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newAttachments = [];
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newAttachments.push({
                    filename: file.name,
                    content_type: file.type,
                    data: e.target.result.split(',')[1] // Extract base64 part
                });
                if (newAttachments.length === files.length) {
                    setAttachments(prev => [...prev, ...newAttachments]);
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if ((!input.trim() && attachments.length === 0) || loading) return;

        const userMsg = input;
        const currentAttachments = [...attachments];

        setInput('');
        setAttachments([]);
        setLoading(true);

        // Optimistic UI update
        // We simulate the message to show immediately
        const optimistContent = userMsg + (currentAttachments.length > 0 ? ` [Attached ${currentAttachments.length} file(s)]` : "");
        setMessages(prev => [...prev, { role: 'user', content: optimistContent }]);

        try {
            const response = await sendMessage(userMsg, currentSessionId, currentAttachments);

            if (!currentSessionId && response.session_id) {
                setCurrentSessionId(response.session_id);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = error.response?.data?.detail || "Sorry, I encountered an error. Please try again.";
            setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                    <Bot className="text-blue-500" />
                    <h1 className="text-xl font-bold text-gray-800">AI Assistant</h1>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`flex max-w-[80%] ${msg.role === 'user'
                                ? 'flex-row-reverse'
                                : 'flex-row'
                                }`}
                        >
                            <div
                                className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mx-2 ${msg.role === 'user' ? 'bg-green-100' : 'bg-blue-100'
                                    }`}
                            >
                                {msg.role === 'user' ? <User size={16} className="text-green-600" /> : <Bot size={16} className="text-blue-600" />}
                            </div>
                            <div
                                className={`p-4 rounded-2xl shadow-sm text-sm ${msg.role === 'user'
                                    ? 'bg-green-500 text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                                    }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex flex-row mx-2">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <Bot size={16} className="text-blue-600" />
                            </div>
                            <div className="ml-2 bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex items-center">
                                <Loader2 className="animate-spin text-gray-400" size={16} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
                {/* File Previews */}
                {attachments.length > 0 && (
                    <div className="flex space-x-2 mb-2 overflow-x-auto pb-2">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="relative group bg-gray-100 border border-gray-300 rounded-md p-2 flex items-center space-x-2 w-40 flex-shrink-0">
                                {att.content_type.startsWith('image/') ? (
                                    <ImageIcon size={20} className="text-purple-500" />
                                ) : (
                                    <FileText size={20} className="text-orange-500" />
                                )}
                                <span className="text-xs truncate text-gray-700 flex-1">{att.filename}</span>
                                <button
                                    onClick={() => removeAttachment(idx)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSend} className="flex items-center space-x-2 max-w-4xl mx-auto">
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        accept="image/*,.pdf"
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:text-gray-700 transition hover:bg-gray-100 rounded-lg"
                        title="Attach files"
                    >
                        <Paperclip size={20} />
                    </button>

                    <input
                        type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || (!input.trim() && attachments.length === 0)}
                        className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatInterface;
