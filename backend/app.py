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

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from frontend

# Configure Clarifai API credentials
CLARIFAI_PAT = os.environ.get("CLARIFAI_PAT")
if not CLARIFAI_PAT:
    raise ValueError("CLARIFAI_PAT environment variable is not set")

# Configure Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Your specific Clarifai configuration
USER_ID = 'xv221gj2xl57'
APP_ID = 'CropCareProject'
MODEL_ID = 'CC'
MODEL_VERSION_ID = '8063e28392ff49dc9167993ce6f55b19'

# In-memory fallback for storing predictions when Supabase is not available
in_memory_predictions = {}

def create_predictions_table():
    """Create the predictions table if it doesn't exist."""
    print("Attempting to create predictions table...")
    try:
        # Execute a raw SQL query to create the table
        # Note: This is done using the REST API through supabase-py which has limited SQL capabilities
        # We'll check if the table exists first by trying to select from it
        result = supabase.table("predictions").select("count", count="exact").execute()
        print("Predictions table already exists.")
        return True
    except Exception as e:
        error_message = str(e)
        print(f"Error checking predictions table: {error_message}")
        
        if "does not exist" in error_message:
            try:
                # Create the table using SQL
                # This may not work with older supabase-py versions, but we'll try
                create_table_sql = """
                CREATE TABLE IF NOT EXISTS predictions (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id TEXT NOT NULL,
                    image_name TEXT NOT NULL,
                    image_data TEXT,
                    prediction TEXT NOT NULL,
                    confidence FLOAT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """
                
                # Try executing the SQL directly
                # This might not work with the current supabase-py version
                # If it fails, we'll provide instructions for manual table creation
                supabase.rpc('execute_sql', {'sql': create_table_sql}).execute()
                print("Successfully created predictions table!")
                return True
            except Exception as create_err:
                print(f"Could not automatically create table: {str(create_err)}")
                print("Please create the 'predictions' table manually in your Supabase dashboard with the following columns:")
                print("- id (uuid, primary key)")
                print("- user_id (text)")
                print("- image_name (text)")
                print("- image_data (text)")
                print("- prediction (text)")
                print("- confidence (float)")
                print("- created_at (timestamp with time zone)")
                return False
        return False

# Try to create the predictions table when the app starts
table_exists = create_predictions_table()

@app.route("/predict", methods=["POST"])
def predict():
    print("Predict endpoint called")
    
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    # Get the user ID from the request (you may need to implement authentication)
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
        
        print(f"Sending request to Clarifai API: USER_ID={USER_ID}, APP_ID={APP_ID}, MODEL_ID={MODEL_ID}, MODEL_VERSION_ID={MODEL_VERSION_ID}")
        
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
        
        # Convert image bytes to base64 string for storage in the database
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Store prediction in Supabase if the table exists
        try:
            timestamp = datetime.now().isoformat()
            prediction_id = str(uuid.uuid4())
            
            prediction_data = {
                "id": prediction_id,
                "user_id": user_id,
                "image_name": filename,
                "image_data": image_base64,  # Store the base64 encoded image
                "prediction": highest_prediction["name"],  # Store only the highest prediction
                "confidence": highest_prediction["value"],
                "created_at": timestamp
            }
            
            print(f"Attempting to store prediction data in Supabase: {prediction_data['prediction']}")
            
            # Insert into the predictions table
            result = supabase.table("predictions").insert(prediction_data).execute()
            print(f"Successfully stored prediction in Supabase for user {user_id}")
            
            # Store in memory as well for backup
            if user_id not in in_memory_predictions:
                in_memory_predictions[user_id] = []
            
            memory_prediction = {
                "id": prediction_id,
                "user_id": user_id,
                "image_name": filename,
                "prediction": highest_prediction["name"],
                "confidence": highest_prediction["value"],
                "created_at": timestamp
            }
            in_memory_predictions[user_id].append(memory_prediction)
            
        except Exception as e:
            # If storing fails, we still return the prediction result
            print(f"Error storing prediction in Supabase: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            
            # Store in memory as fallback
            if user_id not in in_memory_predictions:
                in_memory_predictions[user_id] = []
            
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
            in_memory_predictions[user_id].append(memory_prediction)
            print(f"Stored prediction in memory for user {user_id}")
        
        # Return the prediction 
        return jsonify({
            "success": True,
            "prediction": highest_prediction
        })
        
    except Exception as e:
        import traceback
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
        
        try:
            # Try to get predictions from Supabase
            result = supabase.table("predictions") \
                    .select("id, user_id, image_name, prediction, confidence, created_at") \
                    .eq("user_id", user_id) \
                    .order("created_at", desc=True) \
                    .execute()
            
            # Print the type and structure of the result for debugging
            print(f"Supabase response type: {type(result)}")
            
            # Access the data based on the structure of the result
            if hasattr(result, 'data'):
                predictions = result.data
            elif hasattr(result, 'json') and callable(getattr(result, 'json')):
                # Some versions return json() method
                predictions = result.json().get('data', [])
            elif isinstance(result, dict):
                predictions = result.get('data', [])
            else:
                # Try to convert the result to a string and parse it
                try:
                    import json
                    result_str = str(result)
                    if '{' in result_str:
                        # Extract JSON-like part of the string
                        json_part = result_str[result_str.find('{'):result_str.rfind('}')+1]
                        result_dict = json.loads(json_part)
                        predictions = result_dict.get('data', [])
                    else:
                        predictions = []
                except:
                    predictions = []
                    print(f"Could not parse Supabase response: {result}")
                    
            print(f"Found {len(predictions)} predictions in Supabase for user {user_id}")
            
            # If we got predictions from Supabase, return them
            if predictions:
                return jsonify({
                    "success": True,
                    "source": "supabase",
                    "predictions": predictions
                })
                
        except Exception as db_error:
            print(f"Error fetching from Supabase: {str(db_error)}")
            print(f"Falling back to in-memory storage")
        
        # If we reach here, either Supabase failed or returned no results
        # Fall back to in-memory predictions
        memory_predictions = in_memory_predictions.get(user_id, [])
        print(f"Found {len(memory_predictions)} predictions in memory for user {user_id}")
        
        # Sort by created_at in descending order
        sorted_predictions = sorted(
            memory_predictions, 
            key=lambda x: x.get('created_at', ''), 
            reverse=True
        )
        
        return jsonify({
            "success": True,
            "source": "memory",
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

@app.route("/test-clarifai", methods=["GET"])
def test_clarifai():
    """
    Test endpoint that uses the Clarifai sample code with a sample image URL
    """
    try:
        print("Test Clarifai endpoint called")
        
        # Setup Clarifai API client
        channel = ClarifaiChannel.get_grpc_channel()
        stub = service_pb2_grpc.V2Stub(channel)
        
        # Create metadata for authentication using PAT
        metadata = (("authorization", f"Key {CLARIFAI_PAT}"),)
        
        # Create the user data object
        user_data_object = resources_pb2.UserAppIDSet(user_id=USER_ID, app_id=APP_ID)
        
        # Test with URL (like the official example)
        request_object = service_pb2.PostModelOutputsRequest(
            user_app_id=user_data_object,
            model_id=MODEL_ID,
            version_id=MODEL_VERSION_ID,
            inputs=[
                resources_pb2.Input(
                    data=resources_pb2.Data(
                        image=resources_pb2.Image(
                            url="https://samples.clarifai.com/metro-north.jpg"
                        )
                    )
                )
            ]
        )
        
        print(f"Sending request to Clarifai API (test route): USER_ID={USER_ID}, APP_ID={APP_ID}, MODEL_ID={MODEL_ID}")
        
        # Call the Clarifai API
        response = stub.PostModelOutputs(request_object, metadata=metadata)
        
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
        highest_prediction = max(outputs, key=lambda x: x["value"]) if outputs else None
        
        return jsonify({
            "success": True,
            "message": "Test successful",
            "prediction": highest_prediction,
            "all_predictions": outputs
        })
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        error_message = str(e) if str(e) else "Unknown error occurred"
        print(f"Exception in test Clarifai API call: {error_message}")
        print(f"Traceback: {error_traceback}")
        
        return jsonify({
            "error": f"Error in test Clarifai API call: {error_message}",
            "details": error_traceback
        }), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000) 