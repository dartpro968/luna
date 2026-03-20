"""Quick test script to verify Groq API connection"""
import os
import sys

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

from dotenv import load_dotenv
load_dotenv()

key = os.getenv("GROQ_API_KEY")
print(f"API Key found: {key[:15]}..." if key else "NO API KEY FOUND!")
print(f"Key length: {len(key) if key else 0}")

try:
    from groq import Groq
    client = Groq(api_key=key)
    print("Groq client created. Testing API call...")
    
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": "Say hello in 5 words"}],
        max_tokens=30,
    )
    
    reply = response.choices[0].message.content
    print(f"SUCCESS! Response: {reply}")
    
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()