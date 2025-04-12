import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import dynamic from 'next/dynamic';

// Create component with no SSR
const DynamicCharts = dynamic(
  () => import('../components/DashboardCharts'),
  { ssr: false }
);

export default function Dashboard() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    totalPredictions: 0,
    diseaseCounts: {},
    confidenceAvg: 0,
    recentActivity: [],
    mostCommonDisease: '',
    mostConfidentDisease: '',
    maxConfidence: 0
  });

  // Initialize user ID from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId') || 
      'user_' + Math.random().toString(36).substring(2, 9);
    
    setUserId(storedUserId);
    
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', storedUserId);
    }
  }, []);

  // Fetch prediction history when userId changes or refresh is triggered
  useEffect(() => {
    if (userId) {
      fetchHistory();
    }
  }, [userId, refreshKey]);

  // Process data when predictions change
  useEffect(() => {
    if (predictions.length > 0) {
      processData();
    }
  }, [predictions]);

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

  const processData = () => {
    // Count occurrences of each disease
    const diseaseCounts = {};
    let totalConfidence = 0;
    
    predictions.forEach(prediction => {
      const disease = prediction.prediction;
      diseaseCounts[disease] = (diseaseCounts[disease] || 0) + 1;
      totalConfidence += prediction.confidence;
    });
    
    // Get most common disease
    let mostCommonDisease = '';
    let maxCount = 0;
    Object.entries(diseaseCounts).forEach(([disease, count]) => {
      if (count > maxCount) {
        mostCommonDisease = disease;
        maxCount = count;
      }
    });
    
    // Get disease with highest average confidence
    const diseaseConfidences = {};
    const diseaseConfidenceCounts = {};
    
    predictions.forEach(prediction => {
      const disease = prediction.prediction;
      diseaseConfidences[disease] = (diseaseConfidences[disease] || 0) + prediction.confidence;
      diseaseConfidenceCounts[disease] = (diseaseConfidenceCounts[disease] || 0) + 1;
    });
    
    let mostConfidentDisease = '';
    let maxConfidence = 0;
    
    Object.entries(diseaseConfidences).forEach(([disease, totalConfidence]) => {
      const avgConfidence = totalConfidence / diseaseConfidenceCounts[disease];
      if (avgConfidence > maxConfidence) {
        mostConfidentDisease = disease;
        maxConfidence = avgConfidence;
      }
    });
    
    // Get sorted recent activity (last 10 predictions)
    const recentActivity = [...predictions]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
    
    setStats({
      totalPredictions: predictions.length,
      diseaseCounts,
      confidenceAvg: predictions.length > 0 ? (totalConfidence / predictions.length).toFixed(2) : 0,
      recentActivity,
      mostCommonDisease,
      mostConfidentDisease,
      maxConfidence: maxConfidence.toFixed(2)
    });
  };

  const refreshDashboard = () => {
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
        <title>Dashboard | Crop Disease Detection</title>
        <meta name="description" content="Dashboard for crop disease predictions" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="main-heading">Prediction Dashboard</h1>
      
      <div className="navigation-bar">
        <Link href="/">
          <span className="nav-btn">Home</span>
        </Link>
        <Link href="/history">
          <span className="nav-btn">History</span>
        </Link>
        <Link href="/chatbot">
          <span className="nav-btn">Chatbot</span>
        </Link>
        <button 
          onClick={refreshDashboard} 
          className="nav-btn refresh-btn"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div className="error-card">
          <p>{error}</p>
          <p>User ID: {userId}</p>
          <button onClick={refreshDashboard} className="btn">Try Again</button>
        </div>
      )}
      
      {loading ? (
        <div className="card loading-card">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="card empty-card">
          <h3>No prediction data found</h3>
          <p>Upload images on the home page to start building your dashboard.</p>
          <p className="user-id">Your User ID: {userId}</p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Predictions</h3>
              <div className="stat-value">{stats.totalPredictions}</div>
            </div>
            
            <div className="stat-card">
              <h3>Average Confidence</h3>
              <div className="stat-value">{stats.confidenceAvg}%</div>
            </div>
            
            <div className="stat-card">
              <h3>Most Common Disease</h3>
              <div className="stat-value">{stats.mostCommonDisease}</div>
              <div className="stat-subtext">
                {stats.diseaseCounts[stats.mostCommonDisease] || 0} occurrences
              </div>
            </div>
            
            <div className="stat-card">
              <h3>Highest Confidence Disease</h3>
              <div className="stat-value">{stats.mostConfidentDisease}</div>
              <div className="stat-subtext">
                {stats.maxConfidence}% average
              </div>
            </div>
          </div>
          
          {/* Charts rendered via dynamic import */}
          <DynamicCharts 
            predictions={predictions} 
            stats={stats} 
          />
          
          <div className="card">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              {stats.recentActivity.map((prediction) => (
                <div key={prediction.id} className="activity-item">
                  <div className="activity-disease">{prediction.prediction}</div>
                  <div className="activity-confidence">{prediction.confidence}%</div>
                  <div className="activity-date">{formatDate(prediction.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .main-heading {
          text-align: center;
          margin-bottom: 30px;
          color: #2c3e50;
        }
        
        .navigation-bar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .nav-btn {
          padding: 10px 20px;
          background: #3498db;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          border: none;
          font-size: 16px;
          text-align: center;
          display: inline-block;
        }
        
        .refresh-btn {
          background: #27ae60;
        }
        
        .nav-btn:hover {
          opacity: 0.9;
        }
        
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .error-card {
          background: #ffecec;
          border-left: 4px solid #e74c3c;
          padding: 15px;
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
          animation: spin 2s linear infinite;
          margin-bottom: 15px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        
        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: #3498db;
          margin: 10px 0;
        }
        
        .stat-subtext {
          font-size: 0.9rem;
          color: #7f8c8d;
        }
        
        .activity-list {
          margin-top: 15px;
        }
        
        .activity-item {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px solid #f1f1f1;
        }
        
        .activity-item:last-child {
          border-bottom: none;
        }
        
        .activity-disease {
          font-weight: bold;
        }
        
        .activity-confidence {
          color: #27ae60;
        }
        
        .activity-date {
          color: #7f8c8d;
          font-size: 0.9rem;
        }
        
        h3 {
          margin-top: 0;
          color: #2c3e50;
        }
        
        @media (max-width: 768px) {
          .activity-item {
            grid-template-columns: 1fr;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  );
} 