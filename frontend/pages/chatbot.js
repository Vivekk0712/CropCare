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
  const [showDiseases, setShowDiseases] = useState(false);
  const [diseases, setDiseases] = useState([]);
  const [loadingDiseases, setLoadingDiseases] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [diseaseInfo, setDiseaseInfo] = useState(null);
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

  const loadAllDiseases = async () => {
    setLoadingDiseases(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const response = await axios.get(`${backendUrl}/disease_info`, {
        params: { format: 'keys' }
      });
      
      if (response.data.success) {
        setDiseases(response.data.diseases.sort());
        setShowDiseases(true);
      } else {
        console.error('Failed to load diseases:', response.data.error);
      }
    } catch (error) {
      console.error('Error loading diseases:', error);
    } finally {
      setLoadingDiseases(false);
    }
  };

  const loadDiseaseInfo = async (disease) => {
    setSelectedDisease(disease);
    setDiseaseInfo(null);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const response = await axios.get(`${backendUrl}/disease_info`, {
        params: { disease }
      });
      
      if (response.data.success) {
        setDiseaseInfo(response.data.info);
      } else {
        console.error('Failed to load disease info:', response.data.error);
      }
    } catch (error) {
      console.error('Error loading disease info:', error);
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

      <div className={styles.pageContent}>
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

        <div className={styles.diseaseLibrary}>
          <div className={styles.libraryHeader}>
            <h2>Disease Treatment Library</h2>
            <button 
              onClick={loadAllDiseases} 
              disabled={loadingDiseases}
              className={styles.loadButton}
            >
              {loadingDiseases ? 'Loading...' : (showDiseases ? 'Refresh' : 'View All Diseases')}
            </button>
          </div>

          {showDiseases && (
            <div className={styles.diseasesContainer}>
              <div className={styles.diseasesList}>
                {diseases.map(disease => (
                  <div 
                    key={disease}
                    className={`${styles.diseaseItem} ${selectedDisease === disease ? styles.selected : ''}`}
                    onClick={() => loadDiseaseInfo(disease)}
                  >
                    {disease.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>

              {selectedDisease && diseaseInfo && (
                <div className={styles.diseaseDetails}>
                  <h3>{diseaseInfo.name}</h3>
                  <div className={styles.infoSection}>
                    <h4>Description</h4>
                    <p>{diseaseInfo.description}</p>
                  </div>
                  <div className={styles.infoSection}>
                    <h4>Symptoms</h4>
                    <p>{diseaseInfo.symptoms}</p>
                  </div>
                  <div className={styles.infoSection}>
                    <h4>Causes</h4>
                    <p>{diseaseInfo.causes}</p>
                  </div>
                  <div className={styles.infoSection}>
                    <h4>Treatment</h4>
                    <p>{diseaseInfo.treatment}</p>
                  </div>
                  <div className={styles.infoSection}>
                    <h4>Prevention</h4>
                    <p>{diseaseInfo.prevention}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} hidden />

      <footer className={styles.footer}>
        <p>
          Ask me about plant diseases, prevention methods, or treatments. 
          You can also try voice input by clicking the microphone icon.
        </p>
      </footer>

      <style jsx>{`
        .pageContent {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (min-width: 768px) {
          .pageContent {
            flex-direction: row;
          }

          .chatContainer {
            flex: 1;
          }

          .diseaseLibrary {
            flex: 1;
            max-width: 500px;
          }
        }

        .diseaseLibrary {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          padding: 15px;
        }

        .libraryHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .libraryHeader h2 {
          margin: 0;
          font-size: 1.2rem;
          color: #333;
        }

        .loadButton {
          background-color: #3498db;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: pointer;
        }

        .loadButton:disabled {
          background-color: #95a5a6;
          cursor: not-allowed;
        }

        .diseasesContainer {
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 992px) {
          .diseasesContainer {
            flex-direction: row;
            gap: 15px;
          }

          .diseasesList {
            width: 35%;
            overflow-y: auto;
            max-height: 500px;
          }

          .diseaseDetails {
            width: 65%;
          }
        }

        .diseasesList {
          border: 1px solid #eee;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 15px;
        }

        @media (min-width: 992px) {
          .diseasesList {
            margin-bottom: 0;
          }
        }

        .diseaseItem {
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          text-transform: capitalize;
        }

        .diseaseItem:hover {
          background-color: #f5f5f5;
        }

        .diseaseItem.selected {
          background-color: #e1f0fa;
          border-left: 3px solid #3498db;
        }

        .diseaseDetails {
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 4px;
        }

        .diseaseDetails h3 {
          margin-top: 0;
          color: #3498db;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }

        .infoSection {
          margin-bottom: 15px;
        }

        .infoSection h4 {
          color: #2c3e50;
          margin-bottom: 5px;
        }

        .infoSection p {
          margin-top: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default ChatbotPage; 