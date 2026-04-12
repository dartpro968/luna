import os
from dotenv import load_dotenv
import turso_db
from llm_service import client, EMOTION_MODEL, PERSONA_MODEL
import db

load_dotenv()

print("--- Luna AI Health Check ---")
print("1. Checking Environment Variables...")
needed = ["GROQ_API_KEY", "OPENROUTER_API_KEY", "SUPABASE_URL", "SUPABASE_KEY", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
for key in needed:
    print(f"{key}: {'SET' if os.getenv(key) else 'MISSING'}")

print("\n2. Checking Supabase Connection...")
try:
    if db.supabase:
        print("Supabase: Connected")
    else:
        print("Supabase: Failed")
except Exception as e:
    print(f"Supabase error: {e}")

print("\n3. Checking Turso DB Connection...")
try:
    turso_db.init_db()
    print("Turso DB: Connected")
except Exception as e:
    print(f"Turso DB error: {e}")

print("\n4. Checking LLM API Connection...")
try:
    if client:
        print("LLM Client initialized.")
        # Try a tiny prompt
        response = client.chat.completions.create(
            model=EMOTION_MODEL,
            messages=[{"role": "user", "content": "hello"}],
            max_tokens=10
        )
        print(f"LLM Response Model ({EMOTION_MODEL}): {response.choices[0].message.content}")
    else:
        print("LLM Client not initialized.")
except Exception as e:
    print(f"LLM API error: {e}")

print("\nHealth Check Complete.")
