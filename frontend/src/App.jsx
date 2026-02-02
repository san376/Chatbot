import React, { useState } from 'react';
import HistorySidebar from './components/HistorySidebar';
import ChatInterface from './components/ChatInterface';
import { getSessionHistory } from './api/client';

function App() {
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const handleSessionClick = async (sessionId) => {
    setCurrentSessionId(sessionId);
    try {
      const data = await getSessionHistory(sessionId);
      setMessages(data.chats);
    } catch (error) {
      console.error("Failed to load session history", error);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 font-sans">
      {/* Sidebar */}
      <div className="hidden md:block h-full">
        <HistorySidebar
          onSessionClick={handleSessionClick}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 h-full">
        <ChatInterface
          messages={messages}
          setMessages={setMessages}
          currentSessionId={currentSessionId}
          setCurrentSessionId={setCurrentSessionId}
        />
      </div>
    </div>
  );
}

export default App;
