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

# Download NLTK resources
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    NLP_AVAILABLE = True
except Exception as e:
    print(f"Error downloading NLTK resources: {str(e)}")
    NLP_AVAILABLE = False

try:
    from google.cloud import texttospeech
    TEXT_TO_SPEECH_AVAILABLE = True
except ImportError:
    print("Google Cloud Text-to-Speech not available. Chat responses will not have audio.")
    TEXT_TO_SPEECH_AVAILABLE = False

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from frontend

# Configure Clarifai API credentials
CLARIFAI_PAT = os.environ.get("CLARIFAI_PAT")
if not CLARIFAI_PAT:
    print("CLARIFAI_PAT environment variable is not set")
    CLARIFAI_PAT = "default_pat"  # Set a default to avoid errors, will be rejected by API

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
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Error initializing Supabase client: {str(e)}")
    supabase = None

# Your specific Clarifai configuration
USER_ID = 'xv221gj2xl57'
APP_ID = 'CropCareProject'
MODEL_ID = 'CC'
MODEL_VERSION_ID = '8063e28392ff49dc9167993ce6f55b19'

# In-memory fallback for storing predictions when Supabase is not available
in_memory_predictions = {}

# Translation function
def translate_text(text, target_language):
    """
    Translate text using a publicly available API
    If the API call fails, the original text is returned
    """
    try:
        # Using LibreTranslate API (no API key required for some instances)
        url = "https://translate.argosopentech.com/translate"
        payload = {
            "q": text,
            "source": "en",
            "target": target_language.split('-')[0]  # Extract language code
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            translated_text = response.json().get("translatedText", text)
            return translated_text
        else:
            print(f"Translation API error: {response.status_code}")
            return text
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return text

# NLP preprocessing function
def preprocess_text(text):
    """Process text to extract relevant features"""
    if not NLP_AVAILABLE:
        return text.lower()
    
    try:
        # Tokenize
        tokens = word_tokenize(text.lower())
        
        # Remove stopwords and punctuation
        stop_words = set(stopwords.words('english'))
        tokens = [word for word in tokens if word.isalnum() and word not in stop_words]
        
        # Lemmatize
        lemmatizer = WordNetLemmatizer()
        tokens = [lemmatizer.lemmatize(word) for word in tokens]
        
        return ' '.join(tokens)
    except Exception as e:
        print(f"Error in NLP preprocessing: {str(e)}")
        return text.lower()

@app.route("/predict", methods=["POST"])
def predict():
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
        # Print PAT prefix for debugging (don't print the full PAT for security)
        pat_prefix = CLARIFAI_PAT[:5] + "..." if len(CLARIFAI_PAT) > 10 else "Invalid PAT"
        print(f"Using PAT prefix: {pat_prefix}")
        
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
        
        print(f"Sending request to Clarifai API: USER_ID={USER_ID}, APP_ID={APP_ID}, MODEL_ID={MODEL_ID}")
        
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
            return jsonify({
                "error": f"Clarifai API request failed: {response.status.description}"
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
                prediction_data = {
                    "id": prediction_id,
                    "user_id": user_id,
                    "image_name": filename,
                    "image_data": image_base64,
                    "prediction": highest_prediction["name"],
                    "confidence": highest_prediction["value"],
                    "created_at": timestamp
                }
                
                result = supabase.table("predictions").insert(prediction_data).execute()
                print(f"Successfully stored prediction in Supabase for user {user_id}")
            except Exception as e:
                print(f"Error storing prediction in Supabase: {str(e)}")
        
        # Return the prediction
        return jsonify({
            "success": True,
            "prediction": highest_prediction
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
    try:
        # Get user ID from query parameter
        user_id = request.args.get("user_id", "anonymous")
        print(f"Getting history for user: {user_id}")
        
        # Try to get from Supabase if available
        supabase_predictions = []
        if supabase:
            try:
                result = supabase.table("predictions") \
                        .select("id, user_id, image_name, prediction, confidence, created_at") \
                        .eq("user_id", user_id) \
                        .order("created_at", desc=True) \
                        .execute()
                
                if hasattr(result, 'data'):
                    supabase_predictions = result.data
            except Exception as e:
                print(f"Error fetching from Supabase: {str(e)}")
        
        # Get from memory
        memory_predictions = in_memory_predictions.get(user_id, [])
        
        # Combine and sort predictions
        combined_predictions = supabase_predictions + memory_predictions
        sorted_predictions = sorted(
            combined_predictions, 
            key=lambda x: x.get('created_at', ''), 
            reverse=True
        )
        
        return jsonify({
            "success": True,
            "predictions": sorted_predictions
        })
        
    except Exception as e:
        error_message = str(e)
        print(f"Error fetching prediction history: {error_message}")
        print(f"Error traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": f"Error fetching prediction history: {error_message}",
            "predictions": []
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

# Enhanced chatbot response function
def process_message(message, language_code='en-US'):
    """
    Process a message and return a response based on pattern matching and NLP.
    Supports multiple languages through translation.
    """
    original_message = message
    # Convert to English for processing if not already in English
    is_english = language_code.startswith('en')
    
    processed_message = preprocess_text(message.lower())
    
    # Extract potential disease name from the message
    disease_names = [
        ("apple scab", "apple_scab"),
        ("bacterial spot", "bacterial_spot"),
        ("black spot", "black_spot"),
        ("early blight", "early_blight"),
        ("late blight", "late_blight"),
        ("leaf curl", "leaf_curl"),
        ("powdery mildew", "powdery_mildew"),
        ("rust", "rust"),
        ("citrus greening", "citrus_greening"),
        ("applescab", "apple_scab"),
        ("bacterialspot", "bacterial_spot"),
        ("blackspot", "black_spot"),
        ("earlyblight", "early_blight"),
        ("lateblight", "late_blight"),
        ("leafcurl", "leaf_curl"),
        ("powderymildew", "powdery_mildew"),
        ("citrusgreening", "citrus_greening")
    ]
    
    identified_disease = None
    for name, key in disease_names:
        if name.lower() in processed_message:
            identified_disease = key
            break
    
    # Check for intents in the message
    intent = None
    if any(word in processed_message for word in ["what", "describe", "explain", "tell me about", "what is", "what are"]):
        intent = "description"
    elif any(word in processed_message for word in ["cause", "why", "how does", "reason"]):
        intent = "causes"
    elif any(word in processed_message for word in ["symptom", "sign", "identify", "look like", "appears"]):
        intent = "symptoms"
    elif any(word in processed_message for word in ["treat", "cure", "fix", "heal", "remedy", "solution"]):
        intent = "treatment"
    elif any(word in processed_message for word in ["prevent", "avoid", "stop", "protect"]):
        intent = "prevention"
    
    # Generate response based on intent and identified disease
    response = None
    
    # If both disease and intent are identified, provide specific information
    if identified_disease and intent and identified_disease in plant_disease_data:
        disease_info = plant_disease_data[identified_disease]
        if intent in disease_info:
            response = disease_info[intent]
        else:
            # Fallback to description if the specific intent is not available
            response = disease_info["description"]
    
    # If only disease is identified but no specific intent
    elif identified_disease and identified_disease in plant_disease_data:
        disease_info = plant_disease_data[identified_disease]
        response = (f"{disease_info['name']}: {disease_info['description']} "
                  f"Symptoms include {disease_info['symptoms']} "
                  f"Treatment: {disease_info['treatment']}")
    
    # General queries about treatments or prevention
    elif "treatment" in processed_message or "remedy" in processed_message:
        response = ("For treating plant diseases: 1) Remove infected parts, 2) Improve air circulation, "
                  "3) Apply appropriate fungicides, 4) Ensure proper watering, and 5) Add mulch to prevent soil splashing. "
                  "Always follow product label instructions.")
    
    elif "prevention" in processed_message or "prevent" in processed_message:
        response = ("To prevent crop diseases: 1) Choose resistant varieties, 2) Ensure proper spacing, "
                  "3) Water at the base of plants, 4) Practice crop rotation, 5) Remove diseased plant material, "
                  "and 6) Apply organic or chemical preventatives as needed.")
    
    # Fertilizer questions
    elif any(word in processed_message for word in ["fertilizer", "fertilize", "nutrients", "feed"]):
        response = ("For crop nutrition, consider using balanced NPK fertilizers based on soil tests. "
                  "Organic options include compost, manure, and specific plant-based fertilizers.")
    
    # Pest questions
    elif any(word in processed_message for word in ["pest", "insect", "bug", "aphid", "mite"]):
        response = ("To control garden pests: 1) Identify the pest correctly, 2) Start with the least toxic methods, "
                  "3) Consider beneficial insects, 4) Use insecticidal soaps or neem oil for soft-bodied pests, "
                  "5) Use targeted treatments for specific pests.")
    
    # Watering questions
    elif any(word in processed_message for word in ["water", "irrigation", "moisture", "dry"]):
        response = ("Proper watering is crucial: 1) Water deeply and infrequently to encourage deep roots, "
                  "2) Water at the base to keep foliage dry, 3) Water in the morning, "
                  "4) Use drip irrigation when possible, 5) Adjust based on weather conditions and plant needs.")
    
    # Soil questions
    elif any(word in processed_message for word in ["soil", "compost", "mulch", "dirt"]):
        response = ("Healthy soil is the foundation for healthy plants: 1) Add organic matter regularly, "
                  "2) Test soil pH and nutrients, 3) Use appropriate amendments, "
                  "4) Apply mulch to conserve moisture and suppress weeds, 5) Avoid compacting the soil.")
    
    # Greeting
    elif any(word in processed_message for word in ["hello", "hi", "hey", "greetings"]):
        response = "Hello! I'm your Crop Care Assistant. How can I help you with your plants today?"
    
    # Default response if no specific pattern is matched
    if not response:
        response = ("I'm here to help with plant disease questions. You can ask about specific diseases like 'apple scab', "
                   "'late blight', or 'powdery mildew', as well as prevention methods, or treatment options. "
                   "What would you like to know about crop care?")
    
    # Translate response if not in English
    if not is_english:
        response = translate_text(response, language_code)
    
    return response

# Chatbot API endpoint
@app.route('/chatbot', methods=['POST'])
def process_chatbot():
    try:
        data = request.json
        user_message = data.get('message', '')
        language_code = data.get('language', 'en-US')
        
        print(f"Processing chatbot request: {user_message} in language {language_code}")
        
        # Get response using our enhanced pattern matching
        response_text = process_message(user_message, language_code)
        
        # Generate speech from text if available
        audio_url = None
        if response_text and TEXT_TO_SPEECH_AVAILABLE:
            audio_url = generate_text_to_speech(response_text, language_code)
        
        return jsonify({
            'success': True,
            'response': response_text,
            'audioUrl': audio_url
        })
    
    except Exception as e:
        print(f"Error in chatbot processing: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Text-to-Speech function
def generate_text_to_speech(text, language_code='en-US'):
    if not TEXT_TO_SPEECH_AVAILABLE:
        return None
        
    try:
        # Set API key for Text-to-Speech
        api_key = os.getenv('GOOGLE_API_KEY')
        
        # If no API key is available, return None
        if not api_key:
            print("No Text-to-Speech API key available, skipping audio generation")
            return None
            
        os.environ["GOOGLE_API_KEY"] = api_key
        
        # Initialize Text-to-Speech client
        client = texttospeech.TextToSpeechClient()
        
        # Set input text
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Map language code to voice
        language_map = {
            'en-US': {'language_code': 'en-US', 'name': 'en-US-Neural2-F'},
            'hi-IN': {'language_code': 'hi-IN', 'name': 'hi-IN-Neural2-A'},
            'te-IN': {'language_code': 'te-IN', 'name': 'te-IN-Standard-A'},
            'ta-IN': {'language_code': 'ta-IN', 'name': 'ta-IN-Standard-A'},
            'kn-IN': {'language_code': 'kn-IN', 'name': 'kn-IN-Standard-A'},
            'ml-IN': {'language_code': 'ml-IN', 'name': 'ml-IN-Standard-A'}
        }
        
        voice_params = language_map.get(language_code, language_map['en-US'])
        
        # Configure voice
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_params['language_code'],
            name=voice_params['name']
        )
        
        # Configure audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )
        
        # Generate speech
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
        os.makedirs(os.path.join(app.static_folder, 'tts'), exist_ok=True)
        
        # Move file to static directory
        permanent_path = os.path.join(app.static_folder, 'tts', audio_file_name)
        os.rename(audio_path, permanent_path)
        
        return audio_url
    
    except Exception as e:
        print(f"Error generating speech: {str(e)}")
        return None

# Configure static folder if it doesn't exist
if not hasattr(app, 'static_folder'):
    app.static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    os.makedirs(app.static_folder, exist_ok=True)
    app.static_url_path = '/static'

# Create the TTS directory in static if Text-to-Speech is available
if TEXT_TO_SPEECH_AVAILABLE:
    os.makedirs(os.path.join(app.static_folder, 'tts'), exist_ok=True)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
