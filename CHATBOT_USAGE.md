# Crop Care Chatbot Usage Guide

This guide explains how to use the built-in chatbot in the Crop Vision application.

## Features

The chatbot provides information about plant diseases, prevention methods, and treatments. It includes:

1. **Text and Voice Input**: You can type questions or use the voice input feature
2. **Text-to-Speech Responses** (optional): The chatbot can speak responses in multiple languages if Google TTS is available
3. **Multilingual Support**: Supports English, Hindi, Telugu, Tamil, Kannada, and Malayalam
4. **Smart Pattern Matching**: Understands various ways of asking about crop diseases and care

## How to Use

### Opening the Chatbot
- Click on the chat bubble (💬) icon in the bottom right corner of any page.

### Text Input
1. Type your question in the input field at the bottom of the chat window
2. Press Enter or click the send button (➤) to send your message

### Voice Input
1. Click the "Speak" button
2. Allow microphone access if prompted
3. Speak your question clearly
4. The button will turn red while recording
5. When you're done speaking, the recording will automatically stop and your question will be processed

### Changing Language
1. Use the language dropdown in the chat header to select your preferred language
2. Both your input speech recognition and the chatbot's spoken response will use this language

## Sample Questions

The chatbot can understand and respond to a wide range of questions:

### Disease Information
- "What is apple scab?"
- "Tell me about tomato late blight"
- "What causes powdery mildew?"
- "Explain black spot disease"
- "What is rust in plants?"

### Prevention Methods
- "How to prevent plant diseases?"
- "Ways to prevent apple scab"
- "Prevention methods for crop diseases"
- "How to avoid leaf curl"

### Treatment Recommendations
- "How to treat apple scab"
- "Treatment for tomato late blight"
- "What should I do about powdery mildew?"
- "Remedy for black spot"
- "Cure for citrus greening"

### Additional Topics
- "Fertilizer recommendations for crops"
- "How to deal with aphids"
- "Best watering practices for plants"
- "Tips for healthy soil"

## Customizing the Chatbot

The chatbot uses pattern matching to understand questions and provide appropriate responses. To add more capabilities:

1. Open `backend/app.py`
2. Find the `process_message` function
3. Add new patterns and responses to the `patterns` list

Example:
```python
# Add a new pattern for composting questions
(["compost", "composting", "organic matter"], 
 "Composting tips: 1) Mix green (nitrogen-rich) and brown (carbon-rich) materials, 2) Keep pile moist but not wet, 3) Turn regularly for aeration, 4) Wait 3-12 months for finished compost, 5) Use in garden beds, containers, or as a top dressing.")
```

## Enabling Text-to-Speech

The chatbot can use Google's Text-to-Speech API to provide spoken responses:

1. Install the optional TTS dependencies:
   ```
   pip install google-cloud-texttospeech google-auth
   ```

2. Add your Google API key to the `.env` file:
   ```
   GOOGLE_API_KEY=your_google_api_key
   ```

3. Restart the backend server

## Troubleshooting

### Speech Recognition Issues
- Make sure your browser supports the Web Speech API (Chrome is recommended)
- Check that your microphone is working and properly connected
- Speak clearly and at a normal pace
- Try in a quieter environment if there's background noise

### Text-to-Speech Issues
- If you don't hear responses, check your device volume
- Make sure you've added a Google API key in the backend `.env` file and installed the required packages
- Some languages may have limited voice options 