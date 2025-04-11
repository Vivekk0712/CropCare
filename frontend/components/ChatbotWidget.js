import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';

// Styled components for chatbot
const ChatbotContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
`;

const FloatingButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #3498db;
  color: white;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  font-size: 24px;
`;

// Component that handles chatbot communication
const ChatbotMessage = ({ message, language, onResponse }) => {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  const timeoutRef = useRef(null);

  useEffect(() => {
    const fetchChatbotResponse = async () => {
      try {
        setIsTranslating(true);
        setError(false); // Reset error state on new attempt
        
        // Log language being used
        console.log(`Sending message with language: ${language}`);
        
        // Get backend URL from environment variables
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Set timeout to handle slow responses (8 seconds)
        const timeoutPromise = new Promise((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new Error('Request timed out'));
          }, 8000);
        });
        
        // Send user message to backend with timeout
        const fetchPromise = axios.post(`${backendUrl}/chatbot`, {
          message,
          language: language || 'en-US' // Default to English if not specified
        });
        
        // Race between fetch and timeout
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Clear timeout if we got a response
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (result.data && result.data.response) {
          setResponse(result.data.response);
          setError(false);
          setRetryCount(0); // Reset retry count on success
          
          // Call the callback with the response
          if (onResponse) {
            onResponse(result.data.response, result.data.audioUrl);
          }
          
          // If audio URL is provided, play it
          if (result.data.audioUrl) {
            try {
              const audioUrl = `${backendUrl}${result.data.audioUrl}`;
              console.log(`Playing audio from: ${audioUrl}`);
              const audio = new Audio(audioUrl);
              audio.play().catch(e => console.warn('Audio playback failed:', e));
            } catch (audioErr) {
              console.warn('Error playing audio:', audioErr);
            }
          }
        } else {
          handleError(new Error('Empty response received'));
        }
      } catch (error) {
        handleError(error);
      } finally {
        setIsTranslating(false);
      }
    };
    
    const handleError = (error) => {
      console.error('Error communicating with chatbot:', error);
      setError(true);
      
      // Check if we should retry
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
        setRetryCount(prev => prev + 1);
        // Retry after a delay
        setTimeout(fetchChatbotResponse, 1000);
      } else {
        // No more retries, show error message
        const errorMessage = 'Sorry, I encountered an error. Please try again.';
        setResponse(errorMessage);
        if (onResponse) {
          onResponse(errorMessage);
        }
      }
    };

    fetchChatbotResponse();
    
    // Cleanup function for unmounting
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, language, onResponse, retryCount]);

  return (
    <div style={{ color: error ? '#e74c3c' : 'inherit' }}>
      {isTranslating ? 'Processing...' : response || 'Thinking...'}
      {error && retryCount >= MAX_RETRIES && (
        <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
          (Connection problem. Please try again)
        </div>
      )}
    </div>
  );
};

// Speech recognition component
const SpeechInput = ({ onSpeechResult, language }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = () => {
    setError(null); // Clear any previous errors
    
    if (!recognitionRef.current) {
      // Check browser support for SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError('Speech recognition not supported in your browser');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    }
    
    // Update language each time we start listening
    recognitionRef.current.lang = language || 'en-US';
    console.log(`Speech recognition using language: ${language}`);
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log(`Speech recognized: "${transcript}"`);
      onSpeechResult(transcript);
      setListening(false);
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setError(`Speech error: ${event.error}`);
      setListening(false);
    };
    
    recognitionRef.current.onend = () => {
      setListening(false);
    };
    
    // Add a timeout to stop listening after 10 seconds
    const timeout = setTimeout(() => {
      if (recognitionRef.current && listening) {
        console.log('Speech recognition timeout after 10 seconds');
        stopListening();
      }
    }, 10000);
    
    // Start listening
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition');
      clearTimeout(timeout);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && listening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
      setListening(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={listening ? stopListening : startListening} 
        style={{
          backgroundColor: listening ? '#e74c3c' : '#3498db',
          color: 'white',
          border: 'none',
          padding: '8px 15px',
          borderRadius: '20px',
          margin: '5px',
          cursor: 'pointer',
          position: 'relative'
        }}
        title={listening ? 'Stop Listening' : 'Speak to Chat'}
      >
        {listening ? 'Stop' : 'Speak'}
        {listening && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '10px',
            height: '10px',
            backgroundColor: '#e74c3c',
            borderRadius: '50%',
            animation: 'pulse 1s infinite'
          }}></span>
        )}
      </button>
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '5px',
          borderRadius: '5px',
          fontSize: '0.8em',
          marginBottom: '5px',
          whiteSpace: 'nowrap'
        }}>
          {error}
        </div>
      )}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0.5; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// Language selector component
const LanguageSelector = ({ onLanguageChange, currentLanguage }) => {
  const languages = [
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
    { code: 'ta-IN', name: 'Tamil', flag: '🇮🇳' },
    { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
    { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' }
  ];
  
  // Track last language change time to prevent rapid changes
  const lastChangeRef = useRef(0);
  
  const handleLanguageChange = (e) => {
    const now = Date.now();
    // Prevent changing language more than once every 2 seconds
    if (now - lastChangeRef.current > 2000) {
      lastChangeRef.current = now;
      onLanguageChange(e.target.value);
    } else {
      console.log('Language change throttled');
    }
  };

  return (
    <div className="language-selector">
      <label htmlFor="language-select">Language: </label>
      <select 
        id="language-select"
        value={currentLanguage} 
        onChange={handleLanguageChange}
        style={{
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          backgroundColor: '#f8f9fa',
          marginLeft: '5px',
          cursor: 'pointer'
        }}
        title="Select language for chatbot interaction"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <style jsx>{`
        .language-selector {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          padding: 0 10px;
        }
      `}</style>
    </div>
  );
};

// Main ChatbotWidget component
const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState('en-US');
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 'welcome', message: 'Hello! How can I help you with crop diseases today?', user: false }
  ]);
  const messagesEndRef = useRef(null);

  // Toggle chatbot visibility
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Handle language change
  const handleLanguageChange = (langCode) => {
    console.log(`Language changed to: ${langCode}`);
    setLanguage(langCode);
    
    // Add system message about language change
    const languageName = langCode === 'en-US' ? 'English' : 
                        langCode === 'hi-IN' ? 'Hindi' : 
                        langCode === 'te-IN' ? 'Telugu' : 
                        langCode === 'ta-IN' ? 'Tamil' : 
                        langCode === 'kn-IN' ? 'Kannada' : 
                        langCode === 'ml-IN' ? 'Malayalam' : langCode;
                        
    const systemMessage = { 
      id: Date.now().toString(), 
      message: `Switched to ${languageName}`, 
      user: false,
      isSystem: true
    };
    
    setMessages(prev => [...prev, systemMessage]);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle speech recognition result
  const handleSpeechResult = (transcript) => {
    setUserMessage(transcript);
    handleUserMessage(transcript);
  };

  // Handle user text input and add to messages
  const handleUserMessage = (text) => {
    if (!text.trim()) return;
    
    // Add user message to chat
    const newUserMessage = { 
      id: Date.now().toString(), 
      message: text, 
      user: true 
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    // Add empty bot message that will be filled by ChatbotMessage component
    const pendingBotMessageId = (Date.now() + 1).toString();
    const pendingBotMessage = { 
      id: pendingBotMessageId, 
      message: text, // Store the user's message to pass to the API
      user: false,
      pending: true 
    };
    
    setMessages(prev => [...prev, pendingBotMessage]);
    
    // Reset user input
    setUserMessage('');
  };

  // Handle bot response
  const handleBotResponse = (response, audioUrl, messageId) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, message: response, audioUrl, pending: false }
          : msg
      )
    );
  };

  // Render messages with proper styling
  const renderMessages = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    
    return messages.map(msg => (
      <div 
        key={msg.id} 
        className={`message ${msg.user ? 'user' : 'bot'} ${msg.isSystem ? 'system' : ''}`}
      >
        {msg.pending ? (
          <div className="message-content">
            <ChatbotMessage 
              message={msg.message} 
              language={language}
              onResponse={(response, audioUrl) => handleBotResponse(response, audioUrl, msg.id)} 
            />
          </div>
        ) : (
          <div className="message-content">
            {msg.message}
            {msg.audioUrl && (
              <div className="audio-controls">
                <audio src={`${backendUrl}${msg.audioUrl}`} controls />
              </div>
            )}
          </div>
        )}
      </div>
    ));
  };

  return (
    <ChatbotContainer>
      {!isOpen ? (
        <FloatingButton onClick={toggleChat}>
          <span>💬</span>
        </FloatingButton>
      ) : (
        <div style={{ 
          width: '350px',
          maxHeight: '500px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 15px',
            backgroundColor: '#3498db',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0 }}>Crop Care Assistant</h3>
            <button 
              onClick={toggleChat}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >×</button>
          </div>
          
          <LanguageSelector 
            onLanguageChange={handleLanguageChange}
            currentLanguage={language}
          />
          
          <div style={{
            padding: '10px',
            height: '300px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>
          
          <div style={{
            padding: '10px',
            borderTop: '1px solid #eee',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input 
              type="text"
              placeholder="Type a message..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUserMessage(userMessage)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid #ddd',
                outline: 'none'
              }}
            />
            <button
              onClick={() => handleUserMessage(userMessage)}
              style={{
                marginLeft: '10px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '20px',
                cursor: 'pointer'
              }}
            >
              Send
            </button>
            <SpeechInput onSpeechResult={handleSpeechResult} language={language} />
          </div>
        </div>
      )}
      
      <style jsx>{`
        .message {
          max-width: 80%;
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 10px;
          animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .user {
          align-self: flex-end;
          background-color: #3498db;
          color: white;
          border-bottom-right-radius: 0;
          margin-left: auto;
        }
        
        .bot {
          align-self: flex-start;
          background-color: #f1f0f0;
          color: #333;
          border-bottom-left-radius: 0;
          margin-right: auto;
        }
        
        .system {
          align-self: center;
          background-color: #f8f9fa;
          color: #666;
          font-size: 0.8em;
          padding: 5px 10px;
          margin: 5px 0;
          border-radius: 15px;
          border: 1px dashed #ddd;
        }
        
        .message-content {
          word-break: break-word;
        }
        
        .audio-controls {
          margin-top: 5px;
        }
        
        .audio-controls audio {
          width: 100%;
          height: 25px;
        }
      `}</style>
    </ChatbotContainer>
  );
};

export default ChatbotWidget; 