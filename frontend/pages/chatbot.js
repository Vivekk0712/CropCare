import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Chatbot.module.css';

const ChatbotPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  // Add a welcome message when component mounts
  useEffect(() => {
    setMessages([
      {
        text: "Hello! I'm your Crop Care Assistant. How can I help you with your plants today?",
        sender: 'bot'
      }
    ]);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');

    try {
      // Send message to backend
      const response = await axios.post('http://localhost:5000/chatbot', {
        message: userInput,
        language: selectedLanguage
      });

      // Add bot response
      if (response.data.success) {
        const botMessage = { 
          text: response.data.response, 
          sender: 'bot',
          audioUrl: response.data.audioUrl
        };
        setMessages(prev => [...prev, botMessage]);

        // Play audio if available
        if (response.data.audioUrl) {
          audioRef.current.src = `http://localhost:5000${response.data.audioUrl}`;
          audioRef.current.play();
        }
      } else {
        // Add error message
        setMessages(prev => [...prev, { 
          text: "Sorry, I'm having trouble processing your request.", 
          sender: 'bot' 
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        text: "Sorry, I couldn't connect to the server. Please try again later.", 
        sender: 'bot' 
      }]);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Crop Care Chatbot</title>
        <meta name="description" content="Chat with our Crop Care Assistant" />
      </Head>

      <header className={styles.header}>
        <Link href="/">
          <button className={styles.backButton}>Back to Home</button>
        </Link>
        <h1>Crop Care Chat Assistant</h1>
        <select 
          value={selectedLanguage} 
          onChange={handleLanguageChange}
          className={styles.languageSelector}
        >
          <option value="en-US">English</option>
          <option value="hi-IN">Hindi</option>
          <option value="te-IN">Telugu</option>
          <option value="ta-IN">Tamil</option>
          <option value="kn-IN">Kannada</option>
          <option value="ml-IN">Malayalam</option>
        </select>
      </header>

      <div className={styles.chatContainer}>
        <div className={styles.chatMessages}>
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`${styles.message} ${
                message.sender === 'user' ? styles.userMessage : styles.botMessage
              }`}
            >
              {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about plant diseases, treatments, etc..."
            className={styles.textInput}
          />
          <button type="submit" className={styles.sendButton}>
            Send
          </button>
          <button 
            type="button" 
            onClick={startListening} 
            className={`${styles.micButton} ${isListening ? styles.listening : ''}`}
          >
            {isListening ? 'Listening...' : '🎤'}
          </button>
        </form>
      </div>

      <audio ref={audioRef} hidden />

      <footer className={styles.footer}>
        <p>
          Ask me about plant diseases, prevention methods, or treatments. 
          You can also try voice input by clicking the microphone icon.
        </p>
      </footer>
    </div>
  );
};

export default ChatbotPage; 