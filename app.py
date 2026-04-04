"""
Luna AI Girlfriend - Flask Backend
Dual-LLM Pipeline: Emotion Analyzer + Girlfriend Persona
Uses Groq API (free tier) with Llama models
"""

import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import razorpay

import db
from llm_service import analyze_emotion, generate_girlfriend_response, EMOTION_MODEL, PERSONA_MODEL, client

# Load environment variables
load_dotenv()

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

# Initialize Razorpay Client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_YourTestKeyIdHere")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "YourTestKeySecretHere")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

@app.route("/")
def serve_index():
    return send_from_directory('.', 'index.html')

# ==========================================
# Auth Routes
# ==========================================

@app.route("/api/signup", methods=["POST"])
def signup():
    """Register a new user and add initial context flow."""
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    dob = data.get("dob", "").strip()

    if not all([username, password, name, dob]):
        return jsonify({"error": "Missing required fields"}), 400

    user_id = db.create_user(username, password, name, dob)
    if not user_id:
        return jsonify({"error": "Username already exists"}), 409

    # Inject the stranger initial logic into the db as context
    stranger_prompt = (
        f"You are meeting this user for the very first time. You are strangers. "
        f"Their name is {name} and their DOB is {dob}. "
        f"Start the conversation to get to know them. Ask about their hobbies, "
        f"and spend the next 2-3 messages slowing getting more familiar with them."
    )
    db.save_message(user_id, "system", stranger_prompt)

    return jsonify({"user_id": user_id, "name": name})

@app.route("/api/login", methods=["POST"])
def login():
    """Login an existing user."""
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = db.verify_user(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    user_id, name, dob, coins = user
    return jsonify({"user_id": user_id, "name": name, "coins": coins})

@app.route("/api/google-login", methods=["POST"])
def google_login():
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    data = request.get_json()
    token = data.get("credential")
    client_id = data.get("client_id")
    
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        email = idinfo['email']
        name = idinfo.get('name', email.split("@")[0])

        user_data, is_new = db.verify_google_user(email, name)
        user_id, retrieved_name, dob, coins = user_data
        
        return jsonify({
            "user_id": user_id, 
            "name": retrieved_name,
            "is_new": is_new,
            "needs_dob": is_new or not dob,
            "coins": coins
        })
    except ValueError:
        return jsonify({"error": "Invalid Google token"}), 401


@app.route("/api/update-dob", methods=["POST"])
def update_dob():
    """Endpoint for updating DOB after Google signup."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    dob = data.get("dob", "").strip()
    
    db.update_user_dob(user_id, dob)
    user_info = db.get_user_by_id(user_id)
    name = user_info[0]

    # Inject the stranger initial logic now that we have DOB
    stranger_prompt = (
        f"You are meeting this user for the very first time. You are strangers. "
        f"Their name is {name} and their DOB is {dob}. "
        f"Start the conversation to get to know them. Ask about their hobbies, "
        f"and spend the next 2-3 messages slowing getting more familiar with them."
    )
    db.save_message(user_id, "system", stranger_prompt)

    return jsonify({"status": "success"})


@app.route("/api/me", methods=["GET"])
def get_me():
    """Get current user details."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_info = db.get_user_by_id(user_id)
    if not user_info:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({"name": user_info[0], "dob": user_info[1], "coins": user_info[2]})

# ==========================================
# API Routes
# ==========================================

@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint - processes through dual-LLM pipeline."""
    try:
        user_id = request.headers.get("X-User-ID")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        # Enforce hook rules logic: Daily Grant
        db.check_and_grant_daily_coins(user_id)

        # Retrieve user info and check balances
        user_info = db.get_user_by_id(user_id)
        if not user_info:
            return jsonify({"error": "Unauthorized"}), 401
        
        user_name = user_info[0]
        user_coins = user_info[2]

        if user_coins <= 0:
            return jsonify({"error": "insufficient_coins", "require_payment": True}), 403

        # Retrieve conversation history from DB for this user
        conversation_history = db.get_history(user_id=user_id, limit=200)

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
            user_message, emotion_data, conversation_history, user_name
        )
        print(f"💜 Luna: {response_text}")

        # Update conversation history in DB
        db.save_message(user_id, "user", user_message)
        db.save_message(user_id, "assistant", response_text)

        # Spend the coin
        db.deduct_coin(user_id)

        return jsonify({
            "reply": response_text,
            "emotion": emotion_data.get("emotion", "neutral"),
            "intensity": emotion_data.get("intensity", "medium"),
            "coins_remaining": user_coins - 1
        })
    
    except Exception as e:
        print(f"❌ API Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/clear", methods=["POST"])
def clear_chat():
    """Clear conversation history."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    db.clear_history(user_id)
    return jsonify({"status": "cleared"})


@app.route("/api/create-order", methods=["POST"])
def create_order():
    """Create a new Razorpay order for purchasing coins."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    amount = data.get("amount", 0)  # Amount in rupees
    coins = data.get("coins", 0)

    # Valid packages based on Rs 3 per coin constraint
    valid_packages = {10: 30, 50: 150, 100: 300}
    
    if valid_packages.get(coins) != amount:
        return jsonify({"error": "Invalid coin amount package"}), 400

    try:
        # amount is in paise for Razorpay
        order_amount = amount * 100
        order_currency = "INR"
        
        order = razorpay_client.order.create({
            "amount": order_amount,
            "currency": order_currency,
            "payment_capture": 1
        })
        
        return jsonify({
            "order_id": order["id"],
            "amount": order_amount,
            "currency": order_currency,
            "razorpay_key": RAZORPAY_KEY_ID
        })
    except Exception as e:
        print(f"❌ Razorpay Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    """Verify Razorpay payment signature and add coins to user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")
    coins = data.get("coins", 0)

    try:
        # Verify the payment signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
        
        # If signature is valid, add coins
        db.add_coins(user_id, coins)
        user_info = db.get_user_by_id(user_id)
        
        return jsonify({"status": "success", "new_balance": user_info[2]})
    except razorpay.errors.SignatureVerificationError:
        return jsonify({"error": "Invalid payment signature"}), 400
    except Exception as e:
        print(f"❌ Payment Verification Error: {e}")
        return jsonify({"error": "Payment verification failed"}), 500


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
@app.route("/api/admin/boost", methods=["GET"])
def admin_boost():
    """Secret endpoint to give the currently logged-in user 999,999 coins."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Bypass standard coin addition and directly inject high amount
    db.add_coins(user_id, 999999)
    user_info = db.get_user_by_id(user_id)
    return jsonify({"status": "SUCCESS! YOU ARE NOW A SUPER USER.", "new_balance": user_info[2]})


if __name__ == "__main__":
    print("\n💜 Luna AI Girlfriend Backend Starting...")
    print(f"🧠 Emotion Model: {EMOTION_MODEL}")
    print(f"💬 Persona Model: {PERSONA_MODEL}")
    print("🌐 Server: http://localhost:5000\n")
    
    app.run(debug=True, port=5000)
