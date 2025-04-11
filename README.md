# CropVision - Plant Disease Detection

This project integrates the Clarifai API with a Next.js frontend and Flask backend to detect plant diseases from images. Users can upload plant images, which are analyzed by a machine learning model through the Clarifai API, with results stored in Supabase.

## Project Structure

```
.
├── backend/             # Flask backend
│   ├── app.py           # Main Flask application
│   ├── .env             # Environment variables (add your API key here)
│   └── requirements.txt # Python dependencies
└── frontend/            # Next.js frontend
    ├── pages/           # Next.js pages
    │   ├── index.js     # Main page with image upload and results
    │   ├── history.js   # History page showing past predictions
    │   └── _app.js      # App wrapper with global styles
    ├── styles/          # CSS styles
    │   └── globals.css  # Global CSS styles
    └── package.json     # Node.js dependencies
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows:
     ```
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```
     source venv/bin/activate
     ```

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Set up your environment variables in the `.env` file:
   - `CLARIFAI_PAT`: Your Clarifai Personal Access Token
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase anon key

6. Create a "predictions" table in your Supabase dashboard with these columns:
   - id (uuid, primary key)
   - user_id (text)
   - image_name (text)
   - image_data (text)
   - prediction (text)
   - confidence (float)
   - created_at (timestamp with time zone)

7. Start the Flask server:
   ```
   python app.py
   ```
   The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`

## Features

- Upload plant images for disease detection
- View prediction results with confidence scores
- Store prediction history in Supabase database
- View historical predictions and analysis results

## Customization

To use a different Clarifai model:
1. Open `backend/app.py`
2. Change the `USER_ID`, `APP_ID`, `MODEL_ID`, and `MODEL_VERSION_ID` variables to match your desired model
3. Adjust the response processing if needed for different model outputs
