from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

# Simple chatbot response function
def process_message(message, language_code='en-US'):
    """
    Process a message and return a response based on pattern matching.
    This is a simple alternative to Rasa.
    """
    message_lower = message.lower()
    
    # Define patterns and responses
    patterns = [
        # Greetings
        (["hello", "hi", "hey", "greetings"], 
         "Hello! I'm your Crop Care Assistant. How can I help you with your plants today?"),
        
        # General disease questions
        (["what is", "tell me about", "explain"], {
            "apple scab": "Apple scab is a common fungal disease that affects apple trees. It appears as dark, scaly lesions on leaves and fruit. To treat it, remove infected leaves, apply fungicide, and ensure good air circulation.",
            "late blight": "Late blight is a devastating disease affecting tomatoes and potatoes. It causes dark lesions on leaves and can quickly kill plants. Preventative fungicides and resistant varieties are recommended."
        }),
        
        # Fallback
        (["*"], "I'm here to help with plant disease questions. You can ask about specific diseases, prevention methods, or treatment options.")
    ]
    
    # Check each pattern for a match
    for pattern_list, response in patterns:
        if isinstance(pattern_list, list) and any(p in message_lower for p in pattern_list):
            if isinstance(response, str):
                return response
            elif isinstance(response, dict):
                # For more specific matches like disease names
                for key, specific_response in response.items():
                    if key in message_lower:
                        return specific_response
    
    # General fallback
    return "I'm here to help with plant disease questions. You can ask about specific diseases, prevention methods, or treatment options. What would you like to know about crop care?"

# Chatbot API endpoint
@app.route('/chatbot', methods=['POST'])
def process_chatbot():
    try:
        data = request.json
        user_message = data.get('message', '')
        language_code = data.get('language', 'en-US')
        
        print(f"Processing chatbot request: {user_message} in language {language_code}")
        
        # Get response using our simple pattern matching
        response_text = process_message(user_message, language_code)
        
        return jsonify({
            'success': True,
            'response': response_text,
            'audioUrl': None
        })
    
    except Exception as e:
        print(f"Error in chatbot processing: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000) 