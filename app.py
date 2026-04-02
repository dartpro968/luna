"""
Luna AI Girlfriend - Flask Backend
Dual-LLM Pipeline: Emotion Analyzer + Girlfriend Persona
Uses Groq API (free tier) with Llama models
"""

import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

import db
from llm_service import analyze_emotion, generate_girlfriend_response, EMOTION_MODEL, PERSONA_MODEL, client

# Load environment variables
load_dotenv()

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

@app.route("/")
def serve_index():
    return send_from_directory('.', 'index.html')

# ==========================================
# API Routes
# ==========================================

@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint - processes through dual-LLM pipeline."""
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        # Retrieve conversation history from DB
        conversation_history = db.get_history(limit=200)

        # Build recent context for emotion analysis
        recent_context = ""
        if conversation_history:
            # Use last 6 messages for context
            msgs = conversation_history[-6:]
            recent_context = "\n".join(
                [f"{'User' if m['role'] == 'user' else 'Luna'}: {m['content']}" for m in msgs]
            )

        # STEP 1: Emotion Analysis
        emotion_data = analyze_emotion(user_message, recent_context)
        print(f"🧠 Emotion: {emotion_data}")

        # STEP 2: Generate Girlfriend Response
        response_text = generate_girlfriend_response(
            user_message, emotion_data, conversation_history
        )
        print(f"💜 Luna: {response_text}")

        # Update conversation history in DB
        db.save_message("user", user_message)
        db.save_message("assistant", response_text)

        return jsonify({
            "reply": response_text,
            "emotion": emotion_data.get("emotion", "neutral"),
            "intensity": emotion_data.get("intensity", "medium"),
        })
    
    except Exception as e:
        print(f"❌ API Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/clear", methods=["POST"])
def clear_chat():
    """Clear conversation history."""
    db.clear_history()
    return jsonify({"status": "cleared"})


@app.route("/api/health", methods=["GET"])
def health():
    """Health check."""
    return jsonify({
        "status": "ok", 
        "models": [EMOTION_MODEL, PERSONA_MODEL],
        "api_connected": client is not None
    })

# ==========================================
# Run
# ==========================================
if __name__ == "__main__":
    print("\n💜 Luna AI Girlfriend Backend Starting...")
    print(f"🧠 Emotion Model: {EMOTION_MODEL}")
    print(f"💬 Persona Model: {PERSONA_MODEL}")
    print("🌐 Server: http://localhost:5000\n")
    
    app.run(debug=True, port=5000)
