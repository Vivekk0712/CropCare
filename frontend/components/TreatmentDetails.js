import { useState, useEffect } from 'react';
import axios from 'axios';

const TreatmentDetails = ({ diseaseName }) => {
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  useEffect(() => {
    // Skip if no disease name
    if (!diseaseName) return;
    
    const fetchTreatment = async () => {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      try {
        // Special case handling for disease names
        let originalDiseaseName = diseaseName;
        let normalizedDiseaseName = diseaseName;
        
        // Disease name normalization map
        const diseaseNormalizationMap = {
          'applescab': 'apple_scab',
          'apple scab': 'apple_scab',
          'blackrot': 'black_rot',
          'black rot': 'black_rot',
          'cedarapplerust': 'rust',
          'cedar apple rust': 'rust',
          'cercospora': 'leaf_spot',
          'commonrust': 'rust',
          'common rust': 'rust',
          'northern leaf blight': 'early_blight',
          'northernleafblight': 'early_blight',
          'corn leaf blight': 'early_blight',
          'grape black rot': 'black_rot',
          'grapeblackrot': 'black_rot',
          'esca': 'powdery_mildew',
          'leaf blight': 'early_blight',
          'grapeleafblight': 'early_blight',
          'haunglongbing': 'citrus_greening',
          'citrus greening': 'citrus_greening',
          'citrus huanglongbing': 'citrus_greening',
          'bacterial spot': 'bacterial_spot',
          'bacterialspot': 'bacterial_spot',
          'pepper bacterial spot': 'bacterial_spot',
          'pepperbacterialspot': 'bacterial_spot',
          'early blight': 'early_blight',
          'earlyblight': 'early_blight',
          'potato early blight': 'early_blight',
          'late blight': 'late_blight',
          'lateblight': 'late_blight',
          'potato late blight': 'late_blight',
          'powdery mildew': 'powdery_mildew',
          'powderymildew': 'powdery_mildew',
          'squash powdery mildew': 'powdery_mildew',
          'leaf scorch': 'leaf_curl',
          'leafscorch': 'leaf_curl',
          'strawberry leaf scorch': 'leaf_curl',
          'tomato bacterial spot': 'bacterial_spot',
          'tomato early blight': 'early_blight',
          'tomato late blight': 'late_blight',
          'tomato leaf mold': 'powdery_mildew',
          'leafmold': 'powdery_mildew',
          'tomato septoria leaf spot': 'leaf_spot',
          'septorialeafspot': 'leaf_spot',
          'tomato spider mites': 'pest',
          'spidermites': 'pest',
          'tomato target spot': 'leaf_spot',
          'targetspot': 'leaf_spot',
          'tomato mosaic virus': 'virus',
          'mosaicvirus': 'virus'
        };
        
        // Perform case-insensitive lookup
        const lowerCaseName = diseaseName.toLowerCase().replace(/[_-]/g, '').replace(/\s+/g, '');
        
        if (diseaseNormalizationMap[lowerCaseName]) {
          console.log(`Normalizing disease name: ${lowerCaseName} -> ${diseaseNormalizationMap[lowerCaseName]}`);
          normalizedDiseaseName = diseaseNormalizationMap[lowerCaseName];
        } 
        // If we couldn't match directly, try a more flexible approach
        else {
          // Try to find partial matches
          for (const [key, value] of Object.entries(diseaseNormalizationMap)) {
            if (lowerCaseName.includes(key) || key.includes(lowerCaseName)) {
              console.log(`Found partial match: ${lowerCaseName} ~ ${key} -> ${value}`);
              normalizedDiseaseName = value;
              break;
            }
          }
        }
        
        // Format the disease name for better query results
        const formattedDisease = normalizedDiseaseName
          .replace(/___/g, ' ')  // Replace all ___ with spaces
          .replace(/_/g, ' ')    // Replace all _ with spaces
          .trim();
        
        console.log(`Fetching treatment for: ${formattedDisease}`);
        console.log(`Original disease name: ${originalDiseaseName}`);
        console.log(`Normalized disease name: ${normalizedDiseaseName}`);
        
        // Get backend URL
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        console.log(`Using backend URL: ${backendUrl}`);
        
        // First try the new disease_info endpoint
        const diseaseInfoResponse = await axios.get(`${backendUrl}/disease_info`, {
          params: { disease: normalizedDiseaseName }
        });
        
        console.log('Disease info response:', diseaseInfoResponse.data);
        
        if (diseaseInfoResponse.data.success) {
          const diseaseInfo = diseaseInfoResponse.data.info;
          // We got disease information, extract the treatment
          if (diseaseInfo.treatment) {
            setTreatment(diseaseInfo.treatment);
            setDebugInfo({
              source: 'disease_info_api',
              disease: diseaseInfoResponse.data.disease,
              fullInfo: diseaseInfo
            });
            setLoading(false);
            return;
          }
        }
        
        // If the disease_info endpoint didn't work, try the chatbot endpoint
        const backendResponse = await axios.post(`${backendUrl}/chatbot`, {
          message: `What is the treatment for ${normalizedDiseaseName}?`,
          language: 'en-US'
        });
        
        console.log('Chatbot response:', backendResponse.data);
        
        if (backendResponse.data.success && backendResponse.data.response) {
          // Check if the response is useful (not just a description)
          const response = backendResponse.data.response;
          if (response.includes("treatment") || 
              response.includes("fungicide") || 
              response.includes("apply") || 
              response.includes("remove") ||
              response.includes("control")) {
            setTreatment(response);
            setDebugInfo({
              source: 'chatbot_api_direct',
              query: `What is the treatment for ${normalizedDiseaseName}?`
            });
            setLoading(false);
            return;
          } else {
            console.log("Chatbot response doesn't contain treatment information, trying another query");
          }
        }
        
        // Try another query format
        const secondResponse = await axios.post(`${backendUrl}/chatbot`, {
          message: `How to treat ${formattedDisease}?`,
          language: 'en-US'
        });
        
        console.log('Second chatbot response:', secondResponse.data);
        
        if (secondResponse.data.success && secondResponse.data.response &&
            secondResponse.data.response !== backendResponse.data.response) {
          setTreatment(secondResponse.data.response);
          setDebugInfo({
            source: 'chatbot_api_alternative',
            query: `How to treat ${formattedDisease}?`
          });
          setLoading(false);
          return;
        }
        
        // Fallback to HuggingFace if needed
        const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN || '';
        
        // Log token availability (safely)
        console.log(`HuggingFace token available: ${hfToken ? 'Yes' : 'No'}`);
        if (hfToken) {
          console.log(`Token prefix: ${hfToken.substring(0, 5)}...`);
        }
        
        if (!hfToken) {
          throw new Error('HuggingFace API token not configured');
        }
        
        console.log('Making request to HuggingFace API...');
        
        const hfRequestBody = {
          inputs: `Plant disease: ${formattedDisease}\nTreatment and prevention methods:`,
          parameters: {
            max_length: 150,
            temperature: 0.7,
            top_p: 0.9,
            return_full_text: false
          }
        };
        
        console.log('HuggingFace request body:', hfRequestBody);
        
        const hfResponse = await axios.post(
          'https://api-inference.huggingface.co/models/gpt2-xl',
          hfRequestBody,
          {
            headers: {
              'Authorization': `Bearer ${hfToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('HuggingFace response:', hfResponse.data);
        setDebugInfo({
          source: 'huggingface_api',
          requestBody: hfRequestBody,
          responseData: hfResponse.data
        });
        
        // Process the response
        if (hfResponse.data && hfResponse.data[0] && hfResponse.data[0].generated_text) {
          let treatmentText = hfResponse.data[0].generated_text.trim();
          
          // Clean up the text (remove any irrelevant parts)
          treatmentText = treatmentText
            .replace(/^Plant disease:.*?Treatment and prevention methods:/s, '')
            .trim();
          
          setTreatment(treatmentText);
        } else {
          throw new Error('Invalid response from HuggingFace API');
        }
      } catch (err) {
        console.error('Error fetching treatment details:', err);
        setError(err.message || 'Failed to fetch treatment details');
        setDebugInfo({
          error: err.message,
          stack: err.stack,
          responseData: err.response?.data ? JSON.stringify(err.response.data, null, 2) : null
        });
        
        // Fallback to a generic message if all else fails
        const formattedDisease = diseaseName.replace(/___/g, ' ').replace(/_/g, ' ').trim();
        setTreatment(
          `For treating ${formattedDisease}, consider applying appropriate fungicides, removing infected plant material, and improving air circulation. Consult with a local agricultural extension for specific treatments for your area and conditions.`
        );
      } finally {
        setLoading(false);
      }
    };
    
    fetchTreatment();
  }, [diseaseName]);
  
  if (loading) {
    return (
      <div className="treatment-loading">
        <p>Loading treatment information...</p>
        <div className="spinner"></div>
        <style jsx>{`
          .treatment-loading {
            margin-top: 1rem;
            padding: 1rem;
            text-align: center;
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0070f3;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 10px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  if (error && !treatment) {
    return (
      <div className="treatment-error">
        <p>Error loading treatment information: {error}</p>
        {debugInfo && process.env.NODE_ENV === 'development' && (
          <details>
            <summary>Debug Info</summary>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
        <style jsx>{`
          .treatment-error {
            margin-top: 1rem;
            padding: 1rem;
            color: #e74c3c;
            border-radius: 5px;
            background-color: #fff5f5;
          }
          details {
            margin-top: 0.5rem;
            font-size: 0.8rem;
          }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            background: #f8f8f8;
            padding: 0.5rem;
            border-radius: 4px;
            max-height: 200px;
            overflow: auto;
          }
        `}</style>
      </div>
    );
  }
  
  if (!treatment) {
    return null;
  }
  
  return (
    <div className="treatment-container">
      <h3>Recommended Treatment</h3>
      <div className="treatment-content">
        <p>{treatment}</p>
      </div>
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <details>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}
      <style jsx>{`
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
        h3 {
          margin: 0;
          color: #0070f3;
          font-size: 1.1rem;
        }
        details {
          margin-top: 0.5rem;
          font-size: 0.8rem;
        }
        pre {
          white-space: pre-wrap;
          word-break: break-word;
          background: #f8f8f8;
          padding: 0.5rem;
          border-radius: 4px;
          max-height: 200px;
          overflow: auto;
        }
      `}</style>
    </div>
  );
};

export default TreatmentDetails; 