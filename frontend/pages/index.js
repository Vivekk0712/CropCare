import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import TreatmentDetails from '../components/TreatmentDetails';

export default function Home() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState('');

  // Initialize or load user ID from localStorage
  useEffect(() => {
    // Try to get userId from localStorage when component mounts
    const storedUserId = localStorage.getItem('userId') || 
      'user_' + Math.random().toString(36).substring(2, 9);
    
    setUserId(storedUserId);
    
    // Ensure userId is saved to localStorage
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', storedUserId);
    }
    
    console.log(`Using User ID: ${storedUserId}`);
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setPrediction(null); // Reset prediction when new file is selected
      setError(null);
    }
  };

  // Handle image analysis
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an image to analyze');
      return;
    }

    setIsLoading(true);
    setPrediction(null);
    setError(null);

    // Create form data for API request
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('user_id', userId);

    try {
      console.log(`Sending prediction request for user: ${userId}`);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const response = await axios.post(`${backendUrl}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Prediction response:', response.data);
      
      if (response.data.success) {
        setPrediction(response.data.prediction);
      } else {
        setError(response.data.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError(err.response?.data?.error || 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Crop Vision - Plant Disease Detection</title>
        <meta name="description" content="Plant disease detection using AI" />
      </Head>

      <main className="main">
        <h1 className="title">
          Welcome to <span>Crop Vision</span>
        </h1>

        <p className="description">
          Your comprehensive plant disease detection and treatment assistant
        </p>

        <div className="grid">
          <div className="card upload-card">
            <h2>Upload Image &rarr;</h2>
            <p>
              Upload an image of your plant to detect diseases and get recommendations.
            </p>
            <input type="file" accept="image/*" className="file-input" onChange={handleFileChange} />
            <button className="upload-button" onClick={handleAnalyze} disabled={isLoading}>
              {isLoading ? 'Analyzing...' : 'Analyze Plant'}
            </button>
            
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Plant preview" />
              </div>
            )}
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {prediction && (
              <div className="prediction-result">
                <h3>Analysis Result:</h3>
                <p className="disease-name">{prediction.name}</p>
                <p className="confidence">Confidence: {prediction.value}%</p>
                
                {/* Show treatment information directly if available */}
                {prediction.treatment && (
                  <div className="treatment-container">
                    <h3>Recommended Treatment</h3>
                    <div className="treatment-content">
                      <p>{prediction.treatment}</p>
                    </div>
                  </div>
                )}
                
                {/* Otherwise use the TreatmentDetails component with HuggingFace */}
                {!prediction.treatment && (
                  <TreatmentDetails diseaseName={prediction.name} />
                )}
                
                <Link href="/chatbot">
                  <button className="info-button">
                    Get more information
                  </button>
                </Link>
              </div>
            )}
          </div>

          <Link href="/history">
            <div className="card">
              <h2>View History &rarr;</h2>
              <p>
                View your past plant disease detections and recommendations.
              </p>
            </div>
          </Link>

          <div className="card" onClick={() => setShowChatbot(!showChatbot)}>
            <h2>Crop Care Chatbot &rarr;</h2>
            <p>
              Ask questions about plant diseases, treatments, and prevention methods.
            </p>
          </div>

          <Link href="/chatbot">
            <div className="card">
              <h2>Full Chatbot Page &rarr;</h2>
              <p>
                Open the dedicated chatbot page for a full-screen experience.
              </p>
            </div>
          </Link>
        </div>

        {showChatbot && (
          <div className="chatbot-embedded">
            <div className="chatbot-header">
              <h2>Crop Care Assistant</h2>
              <button onClick={() => setShowChatbot(false)} className="close-button">×</button>
            </div>
            <iframe 
              src="/chatbot" 
              title="Embedded Chatbot" 
              className="chatbot-frame" 
            />
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by AI for plant disease detection</p>
      </footer>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 100%;
        }

        .footer {
          width: 100%;
          height: 100px;
          border-top: 1px solid #eaeaea;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .title {
          margin: 0;
          line-height: 1.15;
          font-size: 4rem;
          text-align: center;
        }

        .title span {
          color: #0070f3;
        }

        .description {
          text-align: center;
          line-height: 1.5;
          font-size: 1.5rem;
          margin: 2rem 0;
        }

        .grid {
          display: flex;
          align-items: stretch;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 900px;
          margin-top: 3rem;
        }

        .card {
          margin: 1rem;
          flex-basis: calc(50% - 2rem);
          padding: 1.5rem;
          text-align: left;
          color: inherit;
          text-decoration: none;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          transition: color 0.15s ease, border-color 0.15s ease, transform 0.2s;
          cursor: pointer;
        }

        .card:hover,
        .card:focus,
        .card:active {
          color: #0070f3;
          border-color: #0070f3;
          transform: translateY(-5px);
        }

        .card h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }

        .card p {
          margin: 0;
          font-size: 1.25rem;
          line-height: 1.5;
        }

        .upload-card {
          display: flex;
          flex-direction: column;
        }

        .file-input {
          margin: 1rem 0;
          padding: 0.5rem;
        }

        .upload-button {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 5px;
          cursor: pointer;
          font-size: 1rem;
          margin-top: 1rem;
          transition: background-color 0.2s;
        }

        .upload-button:hover:not(:disabled) {
          background-color: #0051a8;
        }
        
        .upload-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .image-preview {
          margin-top: 1rem;
          width: 100%;
          max-height: 200px;
          overflow: hidden;
          border-radius: 5px;
          border: 1px solid #eaeaea;
        }
        
        .image-preview img {
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        
        .error-message {
          margin-top: 1rem;
          color: #e74c3c;
          font-weight: bold;
        }
        
        .prediction-result {
          margin-top: 1rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 5px;
          border: 1px solid #eaeaea;
        }
        
        .disease-name {
          font-size: 1.2rem;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .confidence {
          color: #7f8c8d;
        }
        
        .info-button {
          background-color: #27ae60;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          font-size: 0.9rem;
          margin-top: 1rem;
          transition: background-color 0.2s;
        }
        
        .info-button:hover {
          background-color: #219653;
        }

        .chatbot-embedded {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 350px;
          height: 500px;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 1000;
          background: white;
        }

        .chatbot-header {
          padding: 10px 15px;
          background-color: #0070f3;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chatbot-header h2 {
          margin: 0;
          font-size: 1.2rem;
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .chatbot-frame {
          flex: 1;
          border: none;
          width: 100%;
        }

        .treatment-container {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 5px;
          background-color: #f0f8ff;
          border: 1px solid #d1e8ff;
        }
        .treatment-content {
          margin-top: 0.5rem;
          line-height: 1.5;
        }
        .treatment-container h3 {
          margin: 0;
          color: #0070f3;
          font-size: 1.1rem;
        }

        @media (max-width: 600px) {
          .grid {
            width: 100%;
            flex-direction: column;
          }

          .card {
            flex-basis: 100%;
          }

          .chatbot-embedded {
            width: 90%;
            left: 5%;
            right: 5%;
            bottom: 10px;
          }
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
} 