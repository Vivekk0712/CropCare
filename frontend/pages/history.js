import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

export default function History() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState('anonymous'); // Default user ID, you might want to implement proper authentication

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/history?user_id=${userId}`);
      if (response.data.success) {
        setPredictions(response.data.predictions);
      } else {
        setError(response.data.error || 'Failed to load history');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error loading prediction history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="container">
      <Head>
        <title>Prediction History | Clarifai Image Recognition</title>
        <meta name="description" content="History of image recognition predictions" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="main-heading">Prediction History</h1>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <Link href="/">
          <span className="btn" style={{ display: 'inline-block', marginBottom: '10px', cursor: 'pointer' }}>
            Back to Image Upload
          </span>
        </Link>
      </div>

      {error && <div className="error">{error}</div>}
      
      {loading ? (
        <div className="card">Loading history...</div>
      ) : predictions.length === 0 ? (
        <div className="card">No prediction history found.</div>
      ) : (
        predictions.map((prediction) => (
          <div key={prediction.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>{prediction.prediction}</h3>
              <span>Confidence: {prediction.confidence}%</span>
            </div>
            <p className="timestamp">
              Date: {formatDate(prediction.created_at)}
            </p>
          </div>
        ))
      )}
    </div>
  );
} 