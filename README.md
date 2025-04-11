# Crop Disease Detection Application

This application detects crop diseases from images and provides information and remedies through an AI-powered chatbot.

## Features

- Plant disease detection using Clarifai AI
- Interactive chatbot for disease information
- Multilingual support
- Text-to-speech capabilities
- History tracking of predictions

## Setup

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set up environment variables by creating a `.env` file with:
   ```
   CLARIFAI_PAT=your_clarifai_pat
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   GOOGLE_API_KEY=your_google_api_key  # Optional, for text-to-speech
   ```

4. Run the backend server:
   ```
   python app.py
   ```

### Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Access the application at `http://localhost:3000`

## API Endpoints

- `/predict` - Upload an image for disease detection
- `/history` - Get prediction history
- `/chatbot` - Interact with the AI chatbot

## Technologies

- Backend: Flask, Clarifai API, NLTK, Google Cloud Text-to-Speech
- Frontend: Next.js, React, Tailwind CSS
