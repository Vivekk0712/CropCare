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
    <div className="dashboard-container">
      <Head>
        <title>Analytics Dashboard | Crop Disease Detection</title>
        <meta name="description" content="Comprehensive analytics dashboard for crop disease predictions" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="dashboard-header">
        <h1 className="dashboard-title">Prediction Analytics</h1>
        <p className="dashboard-subtitle">Visualize and analyze your crop disease predictions</p>
      </div>
      
      <div className="navigation-bar">
        <div className="nav-links">
          <Link href="/">
            <span className="nav-btn"><i className="nav-icon">🏠</i> Home</span>
          </Link>
          <Link href="/history">
            <span className="nav-btn"><i className="nav-icon">📋</i> History</span>
          </Link>
          <Link href="/chatbot">
            <span className="nav-btn"><i className="nav-icon">💬</i> Chatbot</span>
          </Link>
        </div>
        <button 
          onClick={refreshDashboard} 
          className="refresh-btn"
          disabled={loading}
        >
          <i className="refresh-icon">{loading ? '⏳' : '🔄'}</i> 
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <p className="error-message">{error}</p>
            <p className="error-user-id">User ID: {userId}</p>
            <button onClick={refreshDashboard} className="retry-btn">Try Again</button>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard analytics...</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="empty-card">
          <div className="empty-icon">📊</div>
          <h3 className="empty-title">No prediction data found</h3>
          <p className="empty-message">Upload images on the home page to start building your dashboard.</p>
          <Link href="/">
            <span className="empty-action-btn">Go to Upload Page</span>
          </Link>
          <p className="user-id">Your User ID: {userId}</p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <h3 className="stat-title">Total Predictions</h3>
              <div className="stat-value">{stats.totalPredictions}</div>
              <div className="stat-trend positive">
                {stats.totalPredictions > 0 ? '+' + stats.totalPredictions : '0'} all time
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <h3 className="stat-title">Average Confidence</h3>
              <div className="stat-value">{stats.confidenceAvg}%</div>
              <div className="stat-trend">
                Across all predictions
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🔍</div>
              <h3 className="stat-title">Most Common Disease</h3>
              <div className="stat-value">{stats.mostCommonDisease}</div>
              <div className="stat-trend">
                {stats.diseaseCounts[stats.mostCommonDisease] || 0} occurrences
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <h3 className="stat-title">Highest Confidence</h3>
              <div className="stat-value">{stats.mostConfidentDisease}</div>
              <div className="stat-trend positive">
                {stats.maxConfidence}% average
              </div>
            </div>
          </div>
          
          {/* Charts rendered via dynamic import */}
          <DynamicCharts 
            predictions={predictions} 
            stats={stats} 
          />
          
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">Recent Activity</h3>
              <span className="activity-subtitle">{Math.min(stats.recentActivity.length, 10)} most recent predictions</span>
            </div>
            <div className="activity-list">
              {stats.recentActivity.map((prediction) => (
                <div key={prediction.id} className="activity-item">
                  <div className="activity-disease">
                    <span className="disease-indicator" style={{
                      backgroundColor: prediction.confidence > 90 ? '#10b981' : 
                                      prediction.confidence > 75 ? '#3b82f6' : '#f59e0b'
                    }}></span>
                    {prediction.prediction}
                  </div>
                  <div className="activity-confidence" style={{
                    color: prediction.confidence > 90 ? '#10b981' : 
                           prediction.confidence > 75 ? '#3b82f6' : '#f59e0b'
                  }}>
                    {prediction.confidence}%
                  </div>
                  <div className="activity-date">{formatDate(prediction.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <style jsx>{`
        .dashboard-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 25px;
          background-color: #f8fafc;
          min-height: 100vh;
        }
        
        .dashboard-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .dashboard-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 5px;
          background: linear-gradient(90deg, #3b82f6, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .dashboard-subtitle {
          color: #64748b;
          font-size: 1.2rem;
        }
        
        .navigation-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          background: white;
          border-radius: 12px;
          padding: 15px 25px;
          box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
        }
        
        .nav-links {
          display: flex;
          gap: 15px;
        }
        
        .nav-btn {
          padding: 10px 20px;
          background: transparent;
          color: #334155;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .nav-btn:hover {
          background: #f1f5f9;
          color: #3b82f6;
        }
        
        .nav-icon {
          font-size: 18px;
        }
        
        .refresh-btn {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          border: none;
          font-size: 16px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        
        .refresh-btn:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }
        
        .refresh-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        
        .refresh-icon {
          font-size: 18px;
        }
        
        .error-card {
          display: flex;
          align-items: center;
          background: #fee2e2;
          border-left: 4px solid #ef4444;
          padding: 20px;
          margin-bottom: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.1);
        }
        
        .error-icon {
          font-size: 24px;
          margin-right: 15px;
        }
        
        .error-content {
          flex: 1;
        }
        
        .error-message {
          font-weight: 500;
          color: #b91c1c;
          margin-bottom: 5px;
        }
        
        .error-user-id {
          color: #64748b;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .retry-btn {
          padding: 8px 15px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .retry-btn:hover {
          background: #dc2626;
        }
        
        .empty-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          padding: 50px 30px;
          margin-bottom: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          text-align: center;
        }
        
        .empty-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        
        .empty-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #334155;
        }
        
        .empty-message {
          color: #64748b;
          margin-bottom: 20px;
          max-width: 500px;
        }
        
        .empty-action-btn {
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          display: inline-block;
          margin-bottom: 20px;
          transition: all 0.2s ease;
        }
        
        .empty-action-btn:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }
        
        .user-id {
          color: #64748b;
          font-size: 14px;
        }
        
        .loading-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          padding: 50px 30px;
          margin-bottom: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }
        
        .loading-spinner {
          border: 4px solid #f1f5f9;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1.5s linear infinite;
          margin-bottom: 20px;
        }
        
        .loading-text {
          color: #64748b;
          font-size: 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 25px;
          margin-bottom: 30px;
        }
        
        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 5px;
          background: linear-gradient(90deg, #3b82f6, #10b981);
        }
        
        .stat-icon {
          font-size: 24px;
          margin-bottom: 15px;
        }
        
        .stat-title {
          font-size: 16px;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 5px;
          background: linear-gradient(90deg, #1e40af, #0369a1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .stat-trend {
          font-size: 14px;
          color: #64748b;
        }
        
        .stat-trend.positive {
          color: #10b981;
        }
        
        .activity-card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          margin-top: 30px;
        }
        
        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .activity-title {
          font-size: 20px;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }
        
        .activity-subtitle {
          font-size: 14px;
          color: #64748b;
        }
        
        .activity-list {
          margin-top: 15px;
        }
        
        .activity-item {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 20px;
          padding: 15px 0;
          border-bottom: 1px solid #f1f5f9;
          align-items: center;
        }
        
        .activity-item:last-child {
          border-bottom: none;
        }
        
        .activity-disease {
          font-weight: 500;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .disease-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        
        .activity-confidence {
          font-weight: 600;
        }
        
        .activity-date {
          color: #64748b;
          font-size: 14px;
        }
        
        @media (max-width: 768px) {
          .navigation-bar {
            flex-direction: column;
            gap: 15px;
          }
          
          .nav-links {
            width: 100%;
            justify-content: space-between;
          }
          
          .refresh-btn {
            width: 100%;
            justify-content: center;
          }
          
          .activity-item {
            grid-template-columns: 1fr auto;
          }
          
          .activity-date {
            grid-column: 1 / -1;
            padding-top: 5px;
          }
          
          .stat-card {
            padding: 20px;
          }
          
          .stat-value {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  );
} 