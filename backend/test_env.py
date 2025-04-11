import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get Clarifai credentials
clarifai_pat = os.environ.get("CLARIFAI_PAT")
clarifai_api_key = os.environ.get("CLARIFAI_API_KEY")

print(f"CLARIFAI_PAT: {clarifai_pat}")
print(f"CLARIFAI_API_KEY: {clarifai_api_key}")

# Get Clarifai configurations from app.py
print("\nClarifai configurations in app.py:")
print(f"USER_ID: xv221gj2xl57")
print(f"APP_ID: CropCareProject")
print(f"MODEL_ID: CC")
print(f"MODEL_VERSION_ID: 8063e28392ff49dc9167993ce6f55b19") 