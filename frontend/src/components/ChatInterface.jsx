import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendMessage } from '../api/client';
import { Send, Bot, User, Loader2 } from 'lucide-react';

const ChatInterface = ({ messages, setMessages, currentSessionId, setCurrentSessionId }) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            // Pass currentSessionId (which might be null)
            const response = await sendMessage(userMsg, currentSessionId);

            // Backend returns session_id. If we were in a new chat, update our state.
            if (!currentSessionId && response.session_id) {
                setCurrentSessionId(response.session_id);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
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
                <form onSubmit={handleSend} className="flex items-center space-x-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
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
