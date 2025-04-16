from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
import base64
from datetime import datetime
from dotenv import load_dotenv
from clarifai_grpc.channel.clarifai_channel import ClarifaiChannel
from clarifai_grpc.grpc.api import resources_pb2, service_pb2, service_pb2_grpc
from clarifai_grpc.grpc.api.status import status_code_pb2
from supabase import create_client, Client
import traceback
import json
import tempfile
import re
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import nltk
import requests
import time
import groq

# Try to import Google Cloud TextToSpeech
try:
    from google.cloud import texttospeech
    TEXT_TO_SPEECH_AVAILABLE = True
except ImportError:
    print("Google Cloud Text-to-Speech not available. Chat responses will not have audio.")
    print("To enable text-to-speech functionality, install the package with: pip install google-cloud-texttospeech")
    TEXT_TO_SPEECH_AVAILABLE = False

# Initialize variables at module level
SUPABASE_URL = None
SUPABASE_KEY = None
supabase = None

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from frontend

# Set up static folder for serving TTS audio files
app.static_folder = 'static'

# Configure Clarifai API credentials
CLARIFAI_PAT = os.environ.get("CLARIFAI_PAT")
if not CLARIFAI_PAT:
    print("WARNING: CLARIFAI_PAT environment variable is not set or is empty")
    print("Image analysis functionality will not work correctly")
    CLARIFAI_PAT = "default_pat"  # Set a default to avoid errors, will be rejected by API

# Log PAT information for debugging (safely)
pat_prefix = CLARIFAI_PAT[:5] + "..." if len(CLARIFAI_PAT) > 10 else "Invalid PAT"
print(f"Using Clarifai PAT with prefix: {pat_prefix}")

# Configure Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("SUPABASE_URL and SUPABASE_KEY environment variables must be set")
    # Set defaults to avoid errors
    SUPABASE_URL = "https://example.supabase.co"
    SUPABASE_KEY = "default_key"

# Initialize Supabase client
try:
    print(f"Initializing Supabase client with URL: {SUPABASE_URL[:20]}...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Test the connection
    test_result = supabase.table("predictions").select("count", count="exact").execute()
    count = test_result.count if hasattr(test_result, 'count') else 0
    print(f"Successfully connected to Supabase. Found {count} predictions in the database.")
except Exception as e:
    print(f"Error initializing Supabase client: {str(e)}")
    print(f"Supabase URL: {SUPABASE_URL[:20]}...")
    print(f"Supabase Key length: {len(SUPABASE_KEY)}")
    traceback_str = traceback.format_exc()
    print(f"Traceback: {traceback_str}")
    supabase = None

# Initialize Groq client
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
groq_client = None
GROQ_AVAILABLE = False
GROQ_MODELS = {
    'primary': 'llama3-70b-8192',  # Powerful primary model
    'fallback': 'llama3-8b-8192'   # Smaller fallback model
}

if GROQ_API_KEY:
    try:
        groq_client = groq.Client(api_key=GROQ_API_KEY)
        print(f"Successfully initialized Groq client with API key prefix: {GROQ_API_KEY[:5] if len(GROQ_API_KEY) > 5 else '***'}...")
        GROQ_AVAILABLE = True
        
        # Log available models
        print(f"Groq primary model: {GROQ_MODELS['primary']}")
        print(f"Groq fallback model: {GROQ_MODELS['fallback']}")
    except Exception as e:
        print(f"Error initializing Groq client: {str(e)}")
        traceback_str = traceback.format_exc()
        print(f"Traceback: {traceback_str}")
else:
    print("GROQ_API_KEY environment variable is not set. Groq LLM will not be available.")

# Your specific Clarifai configuration
USER_ID = 'xv221gj2xl57'
APP_ID = 'CropCareProject'
MODEL_ID = 'CC'
MODEL_VERSION_ID = '8063e28392ff49dc9167993ce6f55b19'

# In-memory fallback for storing predictions when Supabase is not available
in_memory_predictions = {}

# Enhanced treatments with more detailed information
treatments = {
    "Apple___Apple_scab": {
        "treatment": "Apply fungicide, remove infected leaves, improve air circulation around trees.",
        "details": "Apple scab is a fungal disease that affects apple trees, causing dark, scaly lesions on leaves and fruit. To treat it, apply fungicide sprays according to label instructions, starting at bud break and continuing at 7-14 day intervals during rainy periods. Remove and destroy infected leaves and fallen debris. Prune trees to improve air circulation, which helps reduce humidity and infection rates."
    },
    "Apple___Black_rot": {
        "treatment": "Prune infected branches, apply appropriate fungicides, remove mummified fruits.",
        "details": "Black rot is a fungal disease affecting apples, causing leaf spots and fruit rot. Treatment includes pruning infected branches (cutting at least 8 inches below visible infection), applying fungicides labeled for black rot during the growing season, and removing all mummified fruits from trees and ground. Maintaining good orchard sanitation is essential for control."
    },
    "Apple___Cedar_apple_rust": {
        "treatment": "Remove nearby cedar trees if possible, apply fungicides preventively.",
        "details": "Cedar apple rust requires both cedar and apple trees to complete its life cycle. Remove nearby cedar trees if practical. Apply protective fungicides (like myclobutanil or propiconazole) starting at pink bud stage and continuing until about 2-3 weeks after petal fall. Some apple varieties have resistance to this disease."
    },
    "Apple___healthy": {
        "treatment": "Continue good agricultural practices to maintain health.",
        "details": "Your apple tree appears healthy. Continue with regular watering, appropriate fertilization, and preventive fungicide applications during the growing season to maintain plant health. Monitor regularly for early signs of diseases or pests."
    },
    # Additional detailed treatments for other diseases
    "Tomato___Early_blight": {
        "treatment": "Apply fungicides, remove lower infected leaves, mulch around plants.",
        "details": "Early blight is caused by the fungus Alternaria solani. Remove and destroy infected lower leaves. Apply copper-based fungicides or approved commercial fungicides every 7-10 days. Mulch around the base of plants to prevent spores splashing from soil to leaves. Provide adequate spacing between plants for good air circulation and avoid overhead watering."
    },
    "Tomato___Late_blight": {
        "treatment": "Apply fungicides, remove infected plants, ensure proper spacing.",
        "details": "Late blight is caused by Phytophthora infestans, the same pathogen that caused the Irish potato famine. It spreads rapidly in cool, wet conditions. Apply copper-based fungicides or specific late blight fungicides preventatively. Remove and destroy infected plants immediately to prevent spread. Space plants properly and stake them to improve air circulation. Water at the base and avoid overhead irrigation."
    },
    "Potato___Early_blight": {
        "treatment": "Apply fungicides, ensure proper spacing, avoid overhead irrigation.",
        "details": "For potato early blight, apply approved fungicides like chlorothalonil or copper-based products when plants are 6-8 inches tall, and continue at 7-10 day intervals. Remove and destroy infected leaves. Practice crop rotation (3-4 year cycle). Maintain adequate soil fertility as stressed plants are more susceptible. Water at the base of plants to keep foliage dry."
    },
    "Grape___Black_rot": {
        "treatment": "Apply fungicides, prune infected areas, improve air flow in the canopy.",
        "details": "Black rot in grapes requires integrated management. Apply fungicides like myclobutanil or mancozeb starting at bud break and continuing until veraison (when grapes begin to ripen). Timing is critical—ensure coverage before rain events. Prune and destroy infected wood in winter. Remove mummified berries and infected leaves. Train vines to maximize air circulation and sun exposure."
    }
}

# Basic treatments for other diseases
basic_treatments = {
    "Blueberry___healthy": "Continue good agricultural practices to maintain health.",
    "Cherry___healthy": "Continue good agricultural practices to maintain health.",
    "Cherry___Powdery_mildew": "Apply sulfur-based fungicides, ensure proper spacing for air circulation.",
    "Corn___Cercospora_leaf_spot": "Rotate crops, apply appropriate fungicides, remove crop debris.",
    "Corn___Common_rust": "Apply fungicides, plant resistant varieties, avoid overhead irrigation.",
    "Corn___healthy": "Continue good agricultural practices to maintain health.",
    "Corn___Northern_Leaf_Blight": "Apply fungicides, crop rotation, till under crop debris after harvest.",
    "Grape___Esca": "Prune during dry weather, apply wound protectants, remove infected vines.",
    "Grape___healthy": "Continue good agricultural practices to maintain health.",
    "Grape___Leaf_blight": "Apply fungicides, proper canopy management, sanitize equipment.",
    "Orange___Haunglongbing": "Remove infected trees, control psyllid vectors, use disease-free nursery stock.",
    "Peach___Bacterial_spot": "Apply copper-based sprays, prune during dry weather, avoid overhead irrigation.",
    "Peach___healthy": "Continue good agricultural practices to maintain health.",
    "Pepper___Bacterial_spot": "Rotate crops, use copper-based fungicides, avoid working with wet plants.",
    "Pepper___healthy": "Continue good agricultural practices to maintain health.",
    "Potato___healthy": "Continue good agricultural practices to maintain health.",
    "Potato___Late_blight": "Apply fungicides, destroy infected plants, harvest during dry weather.",
    "Squash___Powdery_mildew": "Apply fungicides, space plants for good air circulation, water at base.",
    "Strawberry___healthy": "Continue good agricultural practices to maintain health.",
    "Strawberry___Leaf_scorch": "Remove infected leaves, apply fungicides, provide adequate spacing.",
    "Tomato___Bacterial_spot": "Rotate crops, use copper-based sprays, avoid overhead irrigation.",
    "Tomato___healthy": "Continue good agricultural practices to maintain health.",
    "Tomato___Leaf_Mold": "Improve air circulation, reduce humidity, apply fungicides.",
    "Tomato___Septoria_leaf_spot": "Apply fungicides, avoid watering leaves, practice crop rotation.",
    "Tomato___Spider_mites": "Apply miticides, increase humidity, introduce predatory mites.",
    "Tomato___Target_Spot": "Apply fungicides, practice crop rotation, avoid overhead irrigation.",
    "Tomato___Mosaic_virus": "Remove and destroy infected plants, control aphids, disinfect tools."
}

# Disease treatment information
def get_treatment_for_disease(disease_name):
    """Get detailed treatment information for a detected disease"""
    global treatments, basic_treatments
    
    # Special case for Applescab - handle directly
    if disease_name.lower() == "applescab":
        print("Special case: Applescab detected, returning Apple___Apple_scab treatment")
        return treatments["Apple___Apple_scab"]["details"]
    
    # First try the direct disease name
    if disease_name in treatments:
        print(f"Found treatment for exact match: {disease_name}")
        return treatments[disease_name]["details"]
    
    # Try various formats of the disease name
    cleaned_names = [
        disease_name,
        disease_name.replace('___', '_'),
        disease_name.replace('___', ' '),
        disease_name.replace('_', ' '),
        disease_name.lower(),
        disease_name.replace('___', '_').lower(),
        disease_name.replace('___', ' ').lower(),
        disease_name.replace('_', ' ').lower()
    ]
    
    # Try to match with treatments
    for name in cleaned_names:
        if name in treatments:
            print(f"Found treatment using cleaned name: {name}")
            return treatments[name]["details"]
        
    # Check for partial matches in treatments
    for treatment_key in treatments.keys():
        for name in cleaned_names:
            if name in treatment_key or treatment_key in name:
                print(f"Found treatment using partial match: '{name}' in '{treatment_key}'")
                return treatments[treatment_key]["details"]
    
    # Try direct disease name
    if disease_name in basic_treatments:
        print(f"Found basic treatment for direct match: {disease_name}")
        return basic_treatments[disease_name]
    
    # Try cleaned names in basic treatments
    for name in cleaned_names:
        if name in basic_treatments:
            print(f"Found basic treatment using cleaned name: {name}")
            return basic_treatments[name]
            
    # Check for partial matches in basic treatments
    for treatment_key in basic_treatments.keys():
        for name in cleaned_names:
            if name in treatment_key or treatment_key in name:
                print(f"Found basic treatment using partial match: '{name}' in '{treatment_key}'")
                return basic_treatments[treatment_key]
    
    # Try to match based on the crop type and disease type
    if '___' in disease_name:
        crop_type, disease_type = disease_name.split('___', 1)
        print(f"Trying to match based on crop type '{crop_type}' and disease type '{disease_type}'")
        
        # Look for similar disease in other crops
        for key in treatments.keys():
            if disease_type in key:
                print(f"Found similar disease in treatments: {key}")
                return f"Treatment for {disease_name}: Similar to {key} - {treatments[key]['details']}"
        
        for key in basic_treatments.keys():
            if disease_type in key:
                print(f"Found similar disease in basic treatments: {key}")
                return f"Treatment for {disease_name}: Similar to {key} - {basic_treatments[key]}"
    
    print(f"No specific treatment found for: {disease_name}")
    return f"No specific treatment information available for {disease_name}. Consult a local agricultural extension office for personalized advice based on your location and specific conditions."

# Function to translate text using Google Translate
def translate_text(text, target_language):
    """Translate text to the specified language"""
    if target_language.startswith('en'):
        # No need to translate if target is English
        print("Target language is English, no translation needed")
        return text
    
    # Extract just the language code if a locale is provided
    if '-' in target_language:
        target_language = target_language.split('-')[0]
    
    # Map to language codes supported by the translation API
    language_map = {
        'en': 'en',   # English
        'hi': 'hi',   # Hindi
        'te': 'te',   # Telugu
        'ta': 'ta',   # Tamil
        'kn': 'kn',   # Kannada
        'ml': 'ml'    # Malayalam
    }
    
    # Use mapped language code or default to original
    target_language = language_map.get(target_language, target_language)
    
    try:
        print(f"Translating text to {target_language} (length: {len(text)})")
        
        # Use Google Translate API
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",  # Source language (auto-detect)
            "tl": target_language,  # Target language
            "dt": "t",  # Return text
            "q": text
        }
        
        response = requests.get(url, params=params)
        if response.status_code != 200:
            print(f"Translation API error: {response.status_code}")
            return text
            
        # Parse the response (it comes in a nested list structure)
        result = response.json()
        
        # Extract all translated parts and join them
        translated_text = ""
        for part in result[0]:
            if part[0]:
                translated_text += part[0]
        
        print(f"Translation successful: {translated_text[:100]}...")
        return translated_text
    except Exception as e:
        print(f"*** Translation error: {str(e)} ***")
        return text

@app.route("/predict", methods=["POST"])
def predict():
    # Declare global supabase to modify the module-level variable
    global supabase
    
    print("Predict endpoint called")
    
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    # Get the user ID from the request
    user_id = request.form.get("user_id", "anonymous")
    print(f"Processing request for user: {user_id}")
    
    image_file = request.files["image"]
    image_bytes = image_file.read()
    print(f"Received image of size: {len(image_bytes)} bytes")
    
    # Generate a unique filename for the image
    filename = f"{uuid.uuid4()}.jpg"
    
    # Setup Clarifai API client
    print("Setting up Clarifai client")
    channel = ClarifaiChannel.get_grpc_channel()
    stub = service_pb2_grpc.V2Stub(channel)
    
    # Create metadata for authentication using PAT
    metadata = (("authorization", f"Key {CLARIFAI_PAT}"),)
    print(f"PAT length: {len(CLARIFAI_PAT)}")
    
    # Create the user data object
    user_data_object = resources_pb2.UserAppIDSet(user_id=USER_ID, app_id=APP_ID)
    
    try:
        # Print request details for debugging
        print(f"Making Clarifai API request with:")
        print(f"- PAT prefix: {CLARIFAI_PAT[:5]}...")
        print(f"- USER_ID: {USER_ID}")
        print(f"- APP_ID: {APP_ID}")
        print(f"- MODEL_ID: {MODEL_ID}")
        print(f"- MODEL_VERSION_ID: {MODEL_VERSION_ID}")
        
        # Create the request object
        request_object = service_pb2.PostModelOutputsRequest(
            user_app_id=user_data_object,
            model_id=MODEL_ID,
            version_id=MODEL_VERSION_ID,
            inputs=[
                resources_pb2.Input(
                    data=resources_pb2.Data(
                        image=resources_pb2.Image(
                            base64=image_bytes
                        )
                    )
                )
            ]
        )
        
        # Call the Clarifai API
        print("Calling Clarifai API...")
        response = stub.PostModelOutputs(request_object, metadata=metadata)
        print("Received response from Clarifai API")
        
        if response.status.code != status_code_pb2.SUCCESS:
            error_details = {
                "code": response.status.code,
                "description": response.status.description,
                "details": response.status.details
            }
            print(f"Clarifai API error: {error_details}")
            
            # More detailed error handling
            error_message = response.status.description
            if "Invalid API key" in error_message or "authorization" in error_message.lower():
                print("Authentication error with Clarifai API. Check your PAT in the .env file.")
                return jsonify({
                    "success": False,
                    "error": f"Clarifai API authentication failed: {error_message}. Please check your API credentials."
                }), 401
            
            return jsonify({
                "success": False,
                "error": f"Clarifai API request failed: {error_message}"
            }), 500
        
        # Process the response
        outputs = []
        for concept in response.outputs[0].data.concepts:
            outputs.append({
                "name": concept.name,
                "value": round(concept.value * 100, 2)
            })
        
        # Find the prediction with the highest confidence
        highest_prediction = max(outputs, key=lambda x: x["value"])
        
        # Convert image bytes to base64 string for storage
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Store prediction in memory
        prediction_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        memory_prediction = {
            "id": prediction_id,
            "user_id": user_id,
            "image_name": filename,
            "prediction": highest_prediction["name"],
            "confidence": highest_prediction["value"],
            "created_at": timestamp
        }
        
        # Store in memory
        if user_id not in in_memory_predictions:
            in_memory_predictions[user_id] = []
        in_memory_predictions[user_id].append(memory_prediction)
        
        # Try to store in Supabase if available
        if supabase:
            try:
                print(f"Attempting to store prediction in Supabase for user {user_id}")
                
                # First verify connection is still active by making a simple query
                try:
                    test_query = supabase.table("predictions").select("count", count="exact").limit(1).execute()
                    print(f"Connection test successful. Database is accessible.")
                except Exception as conn_err:
                    print(f"Supabase connection test failed: {str(conn_err)}")
                    print(f"Attempting to reconnect...")
                    # Try to reconnect without using global keyword
                    try:
                        # Access the module-level variables directly
                        new_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
                        # If we get here, connection succeeded
                        supabase = new_supabase  # This now updates the module-level variable
                        print("Successfully reconnected to Supabase")
                    except Exception as reconnect_err:
                        print(f"Reconnection failed: {str(reconnect_err)}")
                        raise Exception("Failed to connect to database") from reconnect_err
                
                # Prepare prediction data
                prediction_data = {
                    "id": prediction_id,
                    "user_id": user_id,
                    "image_name": filename,
                    "image_data": image_base64,
                    "prediction": highest_prediction["name"],
                    "confidence": highest_prediction["value"],
                    "created_at": timestamp
                }
                
                print(f"Prediction data prepared, inserting into Supabase table 'predictions'")
                print(f"Data sample: id={prediction_id}, user={user_id}, prediction={highest_prediction['name']}, confidence={highest_prediction['value']}")
                
                # Check data format to ensure it matches database schema
                # Ensure prediction_id is UUID format 
                if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', prediction_id):
                    prediction_id = str(uuid.uuid4())
                    prediction_data["id"] = prediction_id
                    print(f"Updated prediction_id to valid UUID: {prediction_id}")
                
                # Ensure confidence is a float
                if not isinstance(prediction_data["confidence"], float):
                    try:
                        prediction_data["confidence"] = float(prediction_data["confidence"])
                    except:
                        prediction_data["confidence"] = 0.0
                
                # Use proper ISO format for timestamp
                try:
                    if not isinstance(prediction_data["created_at"], str) or not prediction_data["created_at"].endswith('Z'):
                        dt = datetime.fromisoformat(prediction_data["created_at"].replace('Z', '+00:00'))
                        prediction_data["created_at"] = dt.isoformat()
                except:
                    prediction_data["created_at"] = datetime.now().isoformat()
                
                result = supabase.table("predictions").insert(prediction_data).execute()
                
                if hasattr(result, 'data') and len(result.data) > 0:
                    print(f"Successfully stored prediction in Supabase. Result data: {json.dumps(result.data[0])[:100]}...")
                else:
                    print(f"Supabase insert returned unexpected result: {result}")
            except Exception as e:
                error_traceback = traceback.format_exc()
                print(f"Error storing prediction in Supabase: {str(e)}")
                print(f"Error traceback: {error_traceback}")
        else:
            print("Supabase client not available, storing prediction in memory only")
        
        # Store in-memory prediction for response
        response_prediction = {
            "id": prediction_id,
            "name": highest_prediction["name"],
            "value": highest_prediction["value"],
            "details": highest_prediction.get("details", ""),
            "created_at": timestamp,
            "all_predictions": outputs
        }

        # Handle special disease name cases like Applescab
        disease_name = highest_prediction["name"]
        print(f"Getting treatment for disease: {disease_name}")

        # Special case for Apple Scab variants
        if disease_name.lower() == "applescab":
            print("Special case: Converting Applescab to Apple___Apple_scab for treatment lookup")
            treatment_info = get_treatment_for_disease("Apple___Apple_scab")
        else:
            treatment_info = get_treatment_for_disease(disease_name)

        response_prediction["treatment"] = treatment_info

        print(f"Returning prediction with name: {highest_prediction['name']}, confidence: {highest_prediction['value']}%")
        print(f"Treatment information included: {len(treatment_info)} characters")
        
        return jsonify({
            "success": True,
            "prediction": response_prediction
        })
        
    except Exception as e:
        error_traceback = traceback.format_exc()
        error_message = str(e) if str(e) else "Unknown error occurred"
        print(f"Exception in Clarifai API call: {error_message}")
        print(f"Traceback: {error_traceback}")
        
        return jsonify({
            "error": f"Error calling Clarifai API: {error_message}",
            "details": error_traceback
        }), 500

@app.route("/history", methods=["GET"])
def history():
    # Declare global supabase to modify the module-level variable
    global supabase
    
    try:
        # Get user ID from query parameter
        user_id = request.args.get("user_id", "anonymous")
        print(f"Getting history for user: {user_id}")
        
        # Try to get from Supabase if available
        supabase_predictions = []
        if supabase:
            try:
                print(f"Attempting to fetch predictions from Supabase for user {user_id}")
                
                # First verify connection is still active by making a simple query
                try:
                    test_query = supabase.table("predictions").select("count", count="exact").limit(1).execute()
                    print(f"Connection test successful. Database is accessible.")
                except Exception as conn_err:
                    print(f"Supabase connection test failed: {str(conn_err)}")
                    print(f"Attempting to reconnect...")
                    # Try to reconnect without using global keyword
                    try:
                        # Access the module-level variables directly
                        new_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
                        # If we get here, connection succeeded
                        supabase = new_supabase  # This now updates the module-level variable
                        print("Successfully reconnected to Supabase")
                    except Exception as reconnect_err:
                        print(f"Reconnection failed: {str(reconnect_err)}")
                        raise Exception("Failed to connect to database") from reconnect_err
                
                # Now proceed with the actual query
                result = supabase.table("predictions") \
                        .select("id, user_id, image_name, prediction, confidence, created_at") \
                        .eq("user_id", user_id) \
                        .order("created_at", desc=True) \
                        .execute()
                
                print(f"Query executed. Response type: {type(result)}")
                
                if hasattr(result, 'data'):
                    supabase_predictions = result.data
                    print(f"Successfully fetched {len(supabase_predictions)} predictions from Supabase")
                    
                    # Debug the first prediction if available
                    if len(supabase_predictions) > 0:
                        print(f"Sample prediction: {json.dumps(supabase_predictions[0])[:100]}...")
                    else:
                        print("No predictions found in Supabase for this user")
                else:
                    print(f"Supabase query returned no data attribute. Result: {result}")
            except Exception as e:
                error_traceback = traceback.format_exc()
                print(f"Error fetching from Supabase: {str(e)}")
                print(f"Error traceback: {error_traceback}")
        else:
            print("Supabase client not available, using in-memory predictions only")
        
        # Get from memory
        memory_predictions = in_memory_predictions.get(user_id, [])
        print(f"Found {len(memory_predictions)} predictions in memory")
        
        # Debug in-memory predictions
        if memory_predictions:
            print(f"Sample in-memory prediction: {json.dumps(memory_predictions[0])[:100]}...")
        
        # Combine and sort predictions
        combined_predictions = supabase_predictions + memory_predictions
        sorted_predictions = sorted(
            combined_predictions, 
            key=lambda x: x.get('created_at', ''), 
            reverse=True
        )
        
        print(f"Returning {len(sorted_predictions)} total predictions")
        
        return jsonify({
            "success": True,
            "predictions": sorted_predictions,
            "from_supabase": len(supabase_predictions),
            "from_memory": len(memory_predictions)
        })
        
    except Exception as e:
        error_message = str(e)
        error_traceback = traceback.format_exc()
        print(f"Error fetching prediction history: {error_message}")
        print(f"Error traceback: {error_traceback}")
        return jsonify({
            "success": False,
            "error": f"Error fetching prediction history: {error_message}",
            "predictions": [],
            "debug_info": {
                "supabase_available": globals().get('supabase') is not None,
                "in_memory_available": bool(in_memory_predictions)
            }
        }), 500

@app.route("/disease_info", methods=["GET"])
def get_disease_info():
    """
    Get information about a specific disease or list all diseases
    Query parameters:
    - disease: (optional) disease key to get specific information
    - format: (optional) 'keys' to get just keys, 'full' to get all information
    """
    disease = request.args.get('disease')
    format_type = request.args.get('format', 'full')
    
    try:
        if disease:
            # Convert disease name to match the keys in our data
            disease_key = disease.lower().replace(' ', '_')
            
            # First look directly in the plant_disease_data dictionary
            if disease_key in plant_disease_data:
                response = {
                    "success": True,
                    "disease": disease_key,
                    "info": plant_disease_data[disease_key]
                }
                return jsonify(response)
            
            # If not found, try to normalize the name using the same logic as in process_message
            # This will handle cases like "applescab" -> "apple_scab"
            for name, key in disease_names:
                if name.lower() == disease_key or key == disease_key:
                    if key in plant_disease_data:
                        response = {
                            "success": True,
                            "disease": key,
                            "info": plant_disease_data[key]
                        }
                        return jsonify(response)
            
            # Disease not found
            return jsonify({
                "success": False,
                "error": f"Disease information not found for '{disease}'",
                "available_diseases": list(plant_disease_data.keys())
            }), 404
        else:
            # Return all diseases
            if format_type == 'keys':
                return jsonify({
                    "success": True,
                    "diseases": list(plant_disease_data.keys())
                })
            else:
                return jsonify({
                    "success": True,
                    "diseases": plant_disease_data
                })
                
    except Exception as e:
        print(f"Error retrieving disease information: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Knowledge base for plant diseases
plant_disease_data = {
    "apple_scab": {
        "name": "Apple Scab",
        "description": "Apple scab is a common fungal disease that affects apple trees. It appears as dark, scaly lesions on leaves and fruit.",
        "causes": "Caused by the fungus Venturia inaequalis, especially in cool, wet spring weather.",
        "symptoms": "Dark olive-green spots that later become brown and corky on leaves and fruit. Severely infected leaves may turn yellow and drop.",
        "treatment": "Remove infected leaves, apply fungicide, and ensure good air circulation. Use resistant apple varieties when possible.",
        "prevention": "Apply fungicide sprays from budbreak until rainy season ends. Rake and destroy fallen leaves. Prune to improve air circulation."
    },
    "bacterial_spot": {
        "name": "Bacterial Spot",
        "description": "Bacterial spot causes small, dark lesions on leaves, stems, and fruits. It affects peppers and tomatoes.",
        "causes": "Caused by Xanthomonas bacteria, spread by splashing water, insects, and handling plants.",
        "symptoms": "Small, water-soaked spots on leaves that turn brown with a yellow halo. Spots on fruit start as small bumps.",
        "treatment": "Copper-based sprays can help manage it, but prevention is key. Remove and destroy infected plant material.",
        "prevention": "Use disease-free seeds and transplants. Avoid overhead irrigation. Rotate crops and ensure proper spacing."
    },
    "black_spot": {
        "name": "Black Spot",
        "description": "Black spot is a fungal disease that causes black spots on leaves, which then yellow and drop. It commonly affects roses.",
        "causes": "Caused by Diplocarpon rosae fungus, especially in warm, humid conditions.",
        "symptoms": "Circular black spots with feathery margins on leaves. Infected leaves turn yellow and drop prematurely.",
        "treatment": "Remove infected leaves. Apply fungicides labeled for black spot control.",
        "prevention": "Choose resistant varieties. Water at the base of plants. Ensure good air circulation."
    },
    "early_blight": {
        "name": "Early Blight",
        "description": "Early blight is a fungal disease causing target-shaped brown spots on lower leaves first. It affects tomatoes and potatoes.",
        "causes": "Caused by Alternaria solani fungus, favored by warm, humid conditions.",
        "symptoms": "Dark brown spots with concentric rings creating a target pattern, usually on older leaves first.",
        "treatment": "Remove infected leaves and apply fungicide. Ensure adequate plant nutrition.",
        "prevention": "Rotate crops. Use mulch to prevent soil splash. Provide adequate spacing for air circulation."
    },
    "late_blight": {
        "name": "Late Blight",
        "description": "Late blight is a devastating disease affecting tomatoes and potatoes. It causes dark lesions on leaves and can quickly kill plants.",
        "causes": "Caused by Phytophthora infestans, favored by cool, wet conditions.",
        "symptoms": "Large, dark brown blotches on leaves and stems with white fungal growth on leaf undersides in humid conditions.",
        "treatment": "Remove infected plants to prevent spread. Apply fungicides preventatively.",
        "prevention": "Use resistant varieties. Avoid overhead irrigation. Destroy volunteer potato plants."
    },
    "leaf_curl": {
        "name": "Leaf Curl",
        "description": "Leaf curl is a fungal disease causing leaves to pucker, thicken, and curl. It commonly affects peach trees.",
        "causes": "Caused by Taphrina deformans fungus, infecting during cool, wet spring weather.",
        "symptoms": "Red, puckered, distorted leaves that eventually turn yellow and drop.",
        "treatment": "Once symptoms appear, treatment in the current season isn't effective. Remove infected leaves.",
        "prevention": "Apply fungicide as a dormant spray before buds swell in late winter/early spring."
    },
    "powdery_mildew": {
        "name": "Powdery Mildew",
        "description": "Powdery mildew appears as white powdery spots on leaves and stems. It thrives in high humidity.",
        "causes": "Caused by various fungi, thrives in high humidity with moderate temperatures.",
        "symptoms": "White, powdery coating on leaves, stems, and sometimes fruit. Leaves may curl, turn yellow, and drop.",
        "treatment": "Apply fungicides, neem oil, or a baking soda solution. Remove severely infected plants.",
        "prevention": "Provide good air circulation. Water at the base of plants. Choose resistant varieties."
    },
    "rust": {
        "name": "Rust",
        "description": "Rust diseases cause orange-brown pustules on leaf undersides. They affect many plants including roses and beans.",
        "causes": "Caused by various fungi in the order Pucciniales. Often requires alternate hosts to complete lifecycle.",
        "symptoms": "Orange to rusty-brown pustules mainly on leaf undersides. Severe infections cause leaf yellowing and drop.",
        "treatment": "Apply fungicides labeled for rust control. Remove severely infected plants.",
        "prevention": "Avoid wetting leaves when watering. Provide adequate spacing. Remove alternate host plants if applicable."
    },
    "citrus_greening": {
        "name": "Citrus Greening",
        "description": "Citrus greening is a bacterial disease spread by insects. It causes mottled leaves and misshapen, bitter fruit.",
        "causes": "Caused by Candidatus Liberibacter bacteria, spread by Asian citrus psyllid insects.",
        "symptoms": "Blotchy mottled leaves, yellowing of leaf veins, lopsided and bitter fruit that remains green at the base.",
        "treatment": "No cure available. Remove infected trees to prevent spread.",
        "prevention": "Control psyllid populations with insecticides. Use certified disease-free nursery stock."
    }
}

# Get all disease keys for treatment lookup
def get_all_treatment_disease_keys():
    """Get all disease keys from treatments and basic_treatments dictionaries"""
    global treatments, basic_treatments
    
    all_keys = []
    
    # Add keys from detailed treatments
    for k in treatments.keys():
        all_keys.append(k)
    
    # Add keys from basic treatments
    for k in basic_treatments.keys():
        all_keys.append(k)
    
    # Make list unique
    return list(set(all_keys))

# Enhanced chatbot response function
def process_message(message, language_code='en-US'):
    """
    Process a message and get a response using Groq LLM.
    Supports multiple languages through translation.
    
    Returns:
        tuple: (response_text, model_used)
    """
    global supabase, GROQ_AVAILABLE  
    
    print(f"------ Processing message in {language_code} ------")
    original_message = message
    model_used = None
    
    # Check if language is English
    is_english = language_code.startswith('en')
    print(f"Is English language: {is_english}")
    
    # Translate non-English input to English for processing
    translated_message = message
    if not is_english:
        try:
            print(f"Translating message from {language_code} to English for processing")
            translated_message = translate_text(message, 'en-US')
            print(f"Translated message: {translated_message}")
        except Exception as e:
            print(f"Error translating message to English: {str(e)}")
            # Continue with original message if translation fails
            translated_message = message
    
    # Get disease info for context
    disease_keys = get_all_treatment_disease_keys()
    diseases_context = ", ".join(disease_keys[:20])
    
    # Create system prompt with agricultural knowledge
    system_prompt = f"""You are an expert agricultural assistant specializing in crop diseases and treatments.
Your purpose is to help farmers identify, prevent, and treat plant diseases.

Available information about crop diseases: {diseases_context} and more.

When providing treatment recommendations:
1. Start with cultural practices (like pruning, spacing, watering techniques)
2. Follow with organic options when available
3. Include conventional chemical treatments as appropriate
4. Always emphasize safety precautions

Keep responses concise, practical and farmer-friendly.
For disease-specific questions, include information about symptoms, causes, and prevention.
"""

    response = None
    
    # Use Groq LLM for response generation
    if GROQ_AVAILABLE:
        try:
            # Try primary model first
            current_model = GROQ_MODELS['primary']
            model_used = current_model
            print(f"Calling Groq LLM API with model: {current_model}...")
            
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": translated_message}
                ],
                model=current_model,
                temperature=0.5,
                max_tokens=800,
                top_p=1,
                stream=False
            )
            
            # Extract and process the response
            response = chat_completion.choices[0].message.content
            print(f"Received response from Groq {current_model} (length: {len(response)})")
            
        except Exception as primary_error:
            print(f"Error calling Groq primary model: {str(primary_error)}")
            print("Attempting to use fallback model...")
            
            try:
                # Try fallback model
                current_model = GROQ_MODELS['fallback']
                model_used = current_model
                print(f"Calling Groq LLM API with fallback model: {current_model}...")
                
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": translated_message}
                    ],
                    model=current_model,
                    temperature=0.5,
                    max_tokens=800,
                    top_p=1,
                    stream=False
                )
                
                # Extract and process the response
                response = chat_completion.choices[0].message.content
                print(f"Received response from Groq fallback model {current_model} (length: {len(response)})")
                
            except Exception as fallback_error:
                print(f"Error calling Groq fallback model: {str(fallback_error)}")
                traceback_str = traceback.format_exc()
                print(f"Traceback: {traceback_str}")
                
                # Create a simple fallback response if both models fail
                response = "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a few moments."
                model_used = "Error"
    else:
        # Groq not available
        print("Groq LLM is not available. Please check your API key.")
        response = "I'm currently operating with limited capabilities. Please ensure Groq API is properly configured."
        model_used = "Not Available"
    
    # Translate response back to original language if needed
    if not is_english and response:
        try:
            print(f"Translating response to {language_code}...")
            original_response = response
            response = translate_text(response, language_code)
            
            # Verify if translation worked
            if response == original_response:
                print("WARNING: Translation may not have worked. Response unchanged.")
            else:
                print(f"Translated response: {response[:100]}...")
        except Exception as e:
            print(f"Error translating response: {str(e)}")
    
    print(f"------ Message processing completed ------")
    return response, model_used

# Chatbot API endpoint
@app.route('/chatbot', methods=['POST'])
def process_chatbot():
    try:
        data = request.json
        user_message = data.get('message', '')
        language_code = data.get('language', 'en-US')
        
        print(f"====== Processing chatbot request ======")
        print(f"User message: {user_message}")
        print(f"Language code: {language_code}")
        
        # Create response cache if it doesn't exist
        if not hasattr(process_chatbot, 'cache'):
            process_chatbot.cache = {}
            
        # Generate cache key from message and language
        cache_key = f"{user_message.lower().strip()}_{language_code}"
        
        # Check cache for existing response
        if cache_key in process_chatbot.cache:
            print(f"Using cached chatbot response for: {cache_key[:30]}...")
            cached_response = process_chatbot.cache[cache_key]
            return jsonify(cached_response)
        
        # Get response using our enhanced Groq integration
        start_time = time.time()
        print(f"Calling process_message with message and language: {language_code}")
        response_text, model_used = process_message(user_message, language_code)
        processing_time = time.time() - start_time
        print(f"Generated response in {processing_time:.2f} seconds using model: {model_used}")
        print(f"Response text: {response_text[:100]}...")
        
        # Verify language - ensure non-English responses are actually translated
        if not language_code.startswith('en'):
            # Force translation if still in English
            english_words = ['the', 'is', 'and', 'to', 'for', 'your', 'with', 'that', 'have', 'plant', 'disease']
            english_word_count = sum(1 for word in english_words if f" {word} " in f" {response_text.lower()} ")
            
            if english_word_count > 5:  # If response seems to be in English
                print(f"Response appears to be in English despite language {language_code}. Forcing translation...")
                response_text = translate_text(response_text, language_code)
        
        # Generate speech from text if available
        audio_url = None
        if response_text and TEXT_TO_SPEECH_AVAILABLE:
            tts_start = time.time()
            audio_url = generate_text_to_speech(response_text, language_code)
            tts_time = time.time() - tts_start
            print(f"Generated speech in {tts_time:.2f} seconds")
            if audio_url:
                print(f"Audio URL: {audio_url}")
            else:
                print("Failed to generate audio")
        
        # Create response with model info
        powered_by = f"Groq LLM ({model_used})" if GROQ_AVAILABLE and model_used not in ["Error", "Not Available"] else "Pattern Matching (Fallback)"
        response = {
            'success': True,
            'response': response_text,
            'audioUrl': audio_url,
            'language': language_code,
            'poweredBy': powered_by
        }
        
        # Cache the response
        process_chatbot.cache[cache_key] = response
        
        # Limit cache size to prevent memory issues
        if len(process_chatbot.cache) > 100:
            # Remove oldest entries (first 20)
            oldest_keys = list(process_chatbot.cache.keys())[:20]
            for key in oldest_keys:
                del process_chatbot.cache[key]
        
        print(f"====== Chatbot request completed ======")
        return jsonify(response)
    
    except Exception as e:
        print(f"Error in chatbot processing: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Text-to-Speech function
def generate_text_to_speech(text, language_code='en-US'):
    if not TEXT_TO_SPEECH_AVAILABLE:
        print("Text-to-Speech is not available: the required library is not installed")
        return None
    
    # Extract the base language code
    base_lang = language_code.split('-')[0]
        
    # Create a cache if it doesn't exist
    if not hasattr(generate_text_to_speech, 'cache'):
        generate_text_to_speech.cache = {}
        
    # Generate cache key from text and language
    cache_key = f"{text[:50]}_{language_code}"
    
    # Return cached audio URL if available
    if cache_key in generate_text_to_speech.cache:
        print(f"Using cached TTS audio for: {cache_key[:30]}...")
        return generate_text_to_speech.cache[cache_key]
        
    try:
        # Set API key for Text-to-Speech
        api_key = os.getenv('GOOGLE_API_KEY')
        
        # If no API key is available, return None
        if not api_key:
            print("No Text-to-Speech API key available, skipping audio generation")
            print("Set the GOOGLE_API_KEY environment variable to enable Text-to-Speech")
            return None
            
        os.environ["GOOGLE_API_KEY"] = api_key
        
        # Initialize Text-to-Speech client
        try:
            client = texttospeech.TextToSpeechClient()
        except Exception as e:
            print(f"Failed to initialize Text-to-Speech client: {str(e)}")
            print("This may be due to authentication issues - ensure your API key is correct")
            return None
        
        # Set input text
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Enhanced language map with more voice options
        language_map = {
            'en-US': {'language_code': 'en-US', 'name': 'en-US-Neural2-F', 'ssml_gender': 'FEMALE'},
            'hi-IN': {'language_code': 'hi-IN', 'name': 'hi-IN-Neural2-A', 'ssml_gender': 'FEMALE'},
            'te-IN': {'language_code': 'te-IN', 'name': 'te-IN-Standard-A', 'ssml_gender': 'FEMALE'},
            'ta-IN': {'language_code': 'ta-IN', 'name': 'ta-IN-Standard-A', 'ssml_gender': 'FEMALE'},
            'kn-IN': {'language_code': 'kn-IN', 'name': 'kn-IN-Standard-A', 'ssml_gender': 'FEMALE'},
            'ml-IN': {'language_code': 'ml-IN', 'name': 'ml-IN-Standard-A', 'ssml_gender': 'FEMALE'}
        }
        
        # Fallback to base language codes if specific variant not found
        if language_code not in language_map:
            base_lang_key = None
            for lang_key in language_map.keys():
                if lang_key.startswith(f"{base_lang}-"):
                    base_lang_key = lang_key
                    break
            
            if base_lang_key:
                print(f"Using fallback voice {base_lang_key} for {language_code}")
                voice_params = language_map[base_lang_key]
            else:
                print(f"No voice found for {language_code}, using English")
                voice_params = language_map['en-US']
        else:
            voice_params = language_map[language_code]
        
        # Configure voice
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_params['language_code'],
            name=voice_params['name'],
            ssml_gender=getattr(texttospeech.SsmlVoiceGender, voice_params['ssml_gender'])
        )
        
        # Configure audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,  # Normal speed
            pitch=0.0,  # Default pitch
            volume_gain_db=0.0  # Default volume
        )
        
        # Generate speech
        print(f"Requesting TTS for text in {language_code}")
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Save audio file temporarily
        audio_file_name = f"tts_{uuid.uuid4()}.mp3"
        audio_path = os.path.join(tempfile.gettempdir(), audio_file_name)
        
        with open(audio_path, "wb") as out:
            out.write(response.audio_content)
        
        # Return URL to audio file
        audio_url = f"/static/tts/{audio_file_name}"
        
        # Ensure the directory exists
        tts_dir = os.path.join(app.static_folder, 'tts')
        os.makedirs(tts_dir, exist_ok=True)
        
        # Move file to static directory
        permanent_path = os.path.join(tts_dir, audio_file_name)
        os.rename(audio_path, permanent_path)
        
        # Cache the audio URL
        generate_text_to_speech.cache[cache_key] = audio_url
        
        # Limit cache size
        if len(generate_text_to_speech.cache) > 50:
            # Remove oldest entries
            oldest_keys = list(generate_text_to_speech.cache.keys())[:10]
            for key in oldest_keys:
                del generate_text_to_speech.cache[key]
                
        # Clean up old audio files (files older than 1 hour)
        try:
            cleanup_time = time.time() - 3600  # 1 hour ago
            for old_file in os.listdir(tts_dir):
                file_path = os.path.join(tts_dir, old_file)
                if os.path.isfile(file_path) and os.path.getmtime(file_path) < cleanup_time:
                    try:
                        os.remove(file_path)
                        print(f"Removed old TTS file: {old_file}")
                    except:
                        pass
        except Exception as cleanup_err:
            print(f"Error during TTS file cleanup: {str(cleanup_err)}")
        
        return audio_url
    
    except Exception as e:
        print(f"Error generating speech: {str(e)}")
        print(traceback.format_exc())
        return None

# Configure static folder if it doesn't exist
if not hasattr(app, 'static_folder'):
    app.static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    os.makedirs(app.static_folder, exist_ok=True)
    app.static_url_path = '/static'

# Create the TTS directory in static if Text-to-Speech is available
if TEXT_TO_SPEECH_AVAILABLE:
    os.makedirs(os.path.join(app.static_folder, 'tts'), exist_ok=True)

# Define disease name mapping at the module level for reuse
disease_names = [
    ("apple scab", "apple_scab"),
    ("apple___apple_scab", "apple_scab"),
    ("applescab", "apple_scab"),
    ("bacterial spot", "bacterial_spot"),
    ("bacteria___bacterial_spot", "bacterial_spot"),
    ("black spot", "black_spot"),
    ("black_rot", "black_rot"),
    ("early blight", "early_blight"),
    ("late blight", "late_blight"),
    ("leaf curl", "leaf_curl"),
    ("powdery mildew", "powdery_mildew"),
    ("rust", "rust"),
    ("citrus greening", "citrus_greening"),
    ("bacterialspot", "bacterial_spot"),
    ("blackspot", "black_spot"),
    ("earlyblight", "early_blight"),
    ("lateblight", "late_blight"),
    ("leafcurl", "leaf_curl"),
    ("powderymildew", "powdery_mildew"),
    ("citrusgreening", "citrus_greening")
]

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "True").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=port)
