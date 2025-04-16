# CropVision

CropVision is an AI-powered application for crop disease detection and management.

## Features

- **Image-based Disease Detection**: Upload images of your crops to identify diseases
- **Detailed Treatment Recommendations**: Get specific treatment options for detected diseases
- **Multilingual Support**: Use the application in multiple languages
- **AI-Powered Groq Chatbot**: Get intelligent answers to your crop disease questions through an advanced LLM-based chatbot
- **History Tracking**: View your past disease detections and recommendations

## Groq LLM Integration

The chatbot has been upgraded with Groq's powerful Large Language Model capabilities:

- Intelligent responses powered by Groq's state-of-the-art LLMs (llama3-70b and llama3-8b)
- Context-aware conversations about agricultural topics
- Detailed information about crop diseases, symptoms, treatments, and prevention
- Automatic fallback to more reliable models when needed
- Multilingual capabilities with automatic translation

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Node.js 14 or higher
- Clarifai API key
- Supabase account and API key
- Groq API key (required for AI chatbot)

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd CropVision/backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Create a `.env` file based on `.env.example` and add your API keys:
   ```
   CLARIFAI_PAT=your_clarifai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   GROQ_API_KEY=your_groq_api_key
   ```

6. Run the application:
   ```
   python app.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd CropVision/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file with backend URL:
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and visit `http://localhost:3002`

## Using the Chatbot

1. Click the chat bubble icon in the bottom right corner
2. Type your question about crop diseases or treatments
3. The chatbot will provide a detailed, context-aware response powered by Groq LLM
4. For non-English users, select your preferred language from the dropdown
5. Each response will indicate which model was used (e.g., "Powered by Groq LLM (llama3-70b-8192)")

## Acknowledgments

- Built with Flask, React, and Next.js
- Disease classification powered by Clarifai
- Data storage with Supabase
- Chatbot powered by Groq LLM
