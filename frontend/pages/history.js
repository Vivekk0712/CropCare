import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import withAuth from '../utils/withAuth';
import Navbar from '../components/Navbar';

function History() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Try to get userId from localStorage when component mounts
    const storedUserId = localStorage.getItem('userId') || 
      'user_' + Math.random().toString(36).substring(2, 9);
    
    setUserId(storedUserId);
    
    // Ensure userId is saved to localStorage
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', storedUserId);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchHistory();
    }
  }, [userId, refreshKey]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching history for user: ${userId}`);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const response = await axios.get(`${backendUrl}/history?user_id=${userId}`);
      
      console.log('History response:', response.data);
      
      if (response.data.success) {
        setPredictions(response.data.predictions || []);
      } else {
        setError(response.data.error || 'Failed to load history');
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.response?.data?.error || err.message || 'Error loading prediction history');
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const formatDate = (dateString) => {
    try {
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString || 'Unknown date';
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Prediction History | Crop Disease Detection</title>
        <meta name="description" content="History of crop disease predictions" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <h1 className="main-heading">Prediction History</h1>
      
      <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button 
          onClick={refreshHistory} 
          className="btn" 
          style={{ background: '#27ae60', cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh History'}
        </button>
      </div>

      {error && (
        <div className="error-card">
          <p>{error}</p>
          <p>User ID: {userId}</p>
          <button onClick={refreshHistory} className="btn">Try Again</button>
        </div>
      )}
      
      {loading ? (
        <div className="card loading-card">
          <div className="loading-spinner"></div>
          <p>Loading history...</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="card empty-card">
          <h3>No prediction history found</h3>
          <p>Upload an image on the home page to start building your history.</p>
          <p className="user-id">Your User ID: {userId}</p>
        </div>
      ) : (
        <>
          <div className="info-card">
            <p>Found {predictions.length} prediction(s) for User ID: {userId}</p>
          </div>
          
          {predictions.map((prediction) => (
            <div key={prediction.id} className="card prediction-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>{prediction.prediction}</h3>
                <span className="confidence">Confidence: {prediction.confidence}%</span>
              </div>
              <p className="timestamp">
                Date: {formatDate(prediction.created_at)}
              </p>
            </div>
          ))}
        </>
      )}
      
      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .main-heading {
          text-align: center;
          margin-bottom: 30px;
          color: #2c3e50;
        }
        
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s;
        }
        
        .prediction-card:hover {
          transform: translateY(-3px);
        }
        
        .error-card {
          background: #ffecec;
          border-left: 4px solid #e74c3c;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 5px;
        }
        
        .info-card {
          background: #eaf7ff;
          border-left: 4px solid #3498db;
          padding: 10px 15px;
          margin-bottom: 20px;
          border-radius: 5px;
        }
        
        .empty-card {
          text-align: center;
          padding: 40px 20px;
          color: #7f8c8d;
        }
        
        .loading-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }
        
        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        
        .btn:hover {
          background: #2980b9;
        }
        
        .confidence {
          background: #f8f9fa;
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 14px;
          color: #7f8c8d;
        }
        
        .timestamp {
          color: #7f8c8d;
          font-size: 14px;
          margin-top: 10px;
        }
        
        .user-id {
          margin-top: 20px;
          font-size: 12px;
          color: #95a5a6;
        }
      `}</style>
    </div>
  );
}

export default withAuth(History); 