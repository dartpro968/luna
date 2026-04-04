import os
import requests

# Ensure you define these in your actual .env file for production!
API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL") # Default generic ElevenLabs Voice

def generate_voice(text: str):
    """
    Calls ElevenLabs API to generate realistic speech from text.
    Returns the binary audio MP3 content, or None if failed.
    """
    if not API_KEY:
        print("❌ ElevenLabs API Key missing in environment!")
        return None

    # We use turbo model for absolute lowest latency and cost efficiency
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": API_KEY
    }

    data = {
        "text": text,
        "model_id": "eleven_turbo_v2_5", 
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        response = requests.post(url, json=data, headers=headers, stream=True)
        if response.ok:
            return response.content
        else:
            print(f"❌ ElevenLabs API Error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Voice Generation HTTP Exception: {e}")
        return None
