import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

export default function Home() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [userId, setUserId] = useState('anonymous'); // Default user ID, you might want to implement proper authentication

  // Handle file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset states
    setSelectedImage(file);
    setPrediction(null);
    setError(null);

    // Create a preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError(null);
    setPrediction(null);

    // Create form data
    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('user_id', userId); // Include user ID in the request

    try {
      console.log('Sending request to backend...');
      // Send to Flask backend
      const response = await axios.post('http://localhost:5000/predict', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response received:', response.data);
      
      if (response.data.success) {
        setPrediction(response.data.prediction);
      } else {
        setError(response.data.error || 'Something went wrong');
      }
    } catch (err) {
      console.error('Error details:', err);
      let errorMsg = 'Failed to get predictions';
      
      if (err.response) {
        console.error('Error response:', err.response.data);
        errorMsg = err.response.data.error || 'API error occurred';
      } else if (err.request) {
        console.error('Error request:', err.request);
        errorMsg = 'No response received from server';
      } else {
        console.error('Error message:', err.message);
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Clarifai Image Recognition</title>
        <meta name="description" content="Image recognition using Clarifai API" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="main-heading">Clarifai Image Recognition</h1>

      <div className="card" style={{ marginBottom: '20px' }}>
        <Link href="/history">
          <span className="btn" style={{ display: 'inline-block', marginBottom: '15px', cursor: 'pointer' }}>
            View Prediction History
          </span>
        </Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="image-upload" style={{ display: 'block', marginBottom: '10px' }}>
              Select an image to analyze:
            </label>
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              onChange={handleImageChange}
              style={{ marginBottom: '15px' }}
            />
          </div>

          {error && <div className="error">{error}</div>}

          {preview && (
            <div>
              <img src={preview} alt="Preview" className="image-preview" />
            </div>
          )}

          <button 
            type="submit" 
            className="btn" 
            disabled={loading || !selectedImage}
          >
            {loading ? 'Analyzing...' : 'Analyze Image'}
          </button>
        </form>
      </div>

      {prediction && (
        <div className="card">
          <h2>Disease Detected</h2>
          <div className="prediction-item">
            <span>{prediction.name}</span>
            <span>{prediction.value}%</span>
          </div>
        </div>
      )}
    </div>
  );
} 