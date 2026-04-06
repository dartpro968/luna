"""
Luna AI Girlfriend - Flask Backend
Dual-LLM Pipeline: Emotion Analyzer + Girlfriend Persona
Authentication: Supabase JWT Bearer tokens
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
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# ──────────────────────────────────────────────
# Auth helper
# ──────────────────────────────────────────────

def get_current_user_id():
    """
    Extract and validate the Supabase JWT from the Authorization header.
    Returns user_id (str) or None.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    return db.verify_token(token)


# ──────────────────────────────────────────────
# Static Routes
# ──────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route("/terms")
def serve_terms():
    return send_from_directory('.', 'terms.html')

@app.route("/choose")
def serve_choose():
    return send_from_directory('.', 'choose.html')


# ──────────────────────────────────────────────
# Auth Routes
# ──────────────────────────────────────────────

@app.route("/api/signup", methods=["POST"])
def signup():
    """Register a new user with email/password via Supabase Auth."""
    data = request.get_json()
    email    = data.get("email", "").strip()
    password = data.get("password", "")
    name     = data.get("name", "").strip()
    dob      = data.get("dob", "").strip()

    if not all([email, password, name, dob]):
        return jsonify({"error": "Missing required fields"}), 400

    user_id = db.create_user(email, password, name, dob)
    if not user_id:
        return jsonify({"error": "Email already in use or invalid"}), 409

    # Inject stranger intro context
    stranger_prompt = (
        f"You are meeting this user for the very first time. You are strangers. "
        f"Their name is {name} and their DOB is {dob}. "
        f"Start the conversation to get to know them. Ask about their hobbies, "
        f"and spend the next 2-3 messages slowly getting more familiar with them."
    )
    db.save_message(user_id, "system", stranger_prompt)

    # Sign in immediately to return a session token
    session = db.verify_user(email, password)
    if not session:
        return jsonify({"error": "Account created but login failed, please log in manually"}), 500

    user_id, retrieved_name, _, _ = session

    # Get a fresh token from Supabase
    token_res = db.supabase.auth.sign_in_with_password({"email": email, "password": password})
    access_token = token_res.session.access_token

    return jsonify({
        "access_token": access_token,
        "user_id": user_id,
        "name": retrieved_name,
        "coins": 5
    })


@app.route("/api/login", methods=["POST"])
def login():
    """Login with email/password."""
    data = request.get_json()
    email    = data.get("email", "").strip()
    password = data.get("password", "")

    # Try Supabase Auth sign-in and get token
    try:
        token_res = db.supabase.auth.sign_in_with_password({"email": email, "password": password})
        access_token = token_res.session.access_token
        user_id = token_res.user.id

        profile_res = db.supabase.table("profiles").select("name, dob, coins").eq("id", user_id).single().execute()
        d = profile_res.data

        return jsonify({
            "access_token": access_token,
            "user_id": user_id,
            "name": d["name"],
            "coins": d["coins"]
        })
    except Exception as e:
        print(f"login error: {e}")
        return jsonify({"error": "Invalid credentials"}), 401



@app.route("/api/google-login", methods=["POST"])
def google_login():
    """
    Verify Google ID token, find/create the user in Supabase,
    then mint a real Supabase JWT session for them.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    import requests as http_requests

    data      = request.get_json()
    token     = data.get("credential")
    client_id = data.get("client_id")

    try:
        # 1. Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        email  = idinfo["email"]
        name   = idinfo.get("name", email.split("@")[0])

        # 2. Find or create Supabase user + profile
        result = db.verify_google_user(email, name)
        if result is None:
            return jsonify({"error": "Failed to create/find user in database"}), 500

        user_data, is_new = result
        user_id, retrieved_name, dob, coins = user_data

        # 3. Generate a Supabase magic-link (gives us a hashed_token)
        supabase_url      = os.getenv("SUPABASE_URL")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

        gen_res = db.supabase.auth.admin.generate_link({
            "type": "magiclink",
            "email": email,
        })
        hashed_token = gen_res.properties.hashed_token

        # 4. Exchange hashed_token → real Supabase JWT session
        verify_resp = http_requests.post(
            f"{supabase_url}/auth/v1/verify",
            json={"type": "magiclink", "token": hashed_token},
            headers={
                "apikey": supabase_anon_key,
                "Content-Type": "application/json"
            },
            timeout=10
        )

        if verify_resp.status_code != 200:
            print(f"Supabase verify error: {verify_resp.text}")
            return jsonify({"error": "Could not create session for Google user"}), 500

        session = verify_resp.json()
        access_token = session.get("access_token")

        if not access_token:
            return jsonify({"error": "No access token returned from Supabase"}), 500

        return jsonify({
            "access_token": access_token,
            "user_id": user_id,
            "name": retrieved_name,
            "is_new": is_new,
            "needs_dob": is_new or not dob,
            "coins": coins
        })

    except ValueError as e:
        print(f"google_login token error: {e}")
        return jsonify({"error": "Invalid Google token"}), 401
    except Exception as e:
        print(f"google_login error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500




@app.route("/api/update-dob", methods=["POST"])
def update_dob():
    """Update DOB after Google signup. Protected by Bearer token."""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    dob  = data.get("dob", "").strip()

    db.update_user_dob(user_id, dob)
    user_info = db.get_user_by_id(user_id)
    name = user_info[0]

    stranger_prompt = (
        f"You are meeting this user for the very first time. You are strangers. "
        f"Their name is {name} and their DOB is {dob}. "
        f"Start the conversation to get to know them. Ask about their hobbies, "
        f"and spend the next 2-3 messages slowly getting more familiar with them."
    )
    db.save_message(user_id, "system", stranger_prompt)
    return jsonify({"status": "success"})


@app.route("/api/me", methods=["GET"])
def get_me():
    """Get current user details. Protected by Bearer token."""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user_info = db.get_user_by_id(user_id)
    if not user_info:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"name": user_info[0], "dob": user_info[1], "coins": user_info[2]})


# ──────────────────────────────────────────────
# Chat Routes
# ──────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint - processes through dual-LLM pipeline."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data         = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        # Daily coin grant
        db.check_and_grant_daily_coins(user_id)

        user_info = db.get_user_by_id(user_id)
        if not user_info:
            return jsonify({"error": "Unauthorized"}), 401

        user_name  = user_info[0]
        user_coins = user_info[2]

        if user_coins <= 0:
            return jsonify({"error": "insufficient_coins", "require_payment": True}), 403

        # Get conversation history
        conversation_history = db.get_history(user_id=user_id, limit=200)

        # Recent context for emotion analysis
        recent_context = ""
        if conversation_history:
            msgs = conversation_history[-6:]
            recent_context = "\n".join(
                [f"{'User' if m['role'] == 'user' else 'Luna'}: {m['content']}" for m in msgs]
            )

        # STEP 1: Emotion Analysis
        emotion_data = analyze_emotion(user_message, recent_context)
        print(f"🧠 Emotion: {emotion_data}")

        # STEP 2: Generate Response
        response_text = generate_girlfriend_response(
            user_message, emotion_data, conversation_history, user_name
        )
        print(f"💜 Luna: {response_text}")

        # Save to DB
        db.save_message(user_id, "user", user_message)
        db.save_message(user_id, "assistant", response_text)

        # Deduct coin
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
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    data    = request.get_json(silent=True) or {}
    persona = data.get("persona", None)   # if provided, clear only that persona's thread
    db.clear_history(user_id, persona=persona)
    return jsonify({"status": "cleared"})



# ──────────────────────────────────────────────
# Payment Routes
# ──────────────────────────────────────────────

@app.route("/api/create-order", methods=["POST"])
def create_order():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data   = request.get_json()
    amount = data.get("amount", 0)
    coins  = data.get("coins", 0)

    valid_packages = {10: 30, 50: 150, 100: 300}
    if valid_packages.get(coins) != amount:
        return jsonify({"error": "Invalid coin amount package"}), 400

    try:
        order = razorpay_client.order.create({
            "amount": amount * 100,
            "currency": "INR",
            "payment_capture": 1
        })
        return jsonify({
            "order_id": order["id"],
            "amount": amount * 100,
            "currency": "INR",
            "razorpay_key": RAZORPAY_KEY_ID
        })
    except Exception as e:
        print(f"❌ Razorpay Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data                  = request.get_json()
    razorpay_payment_id   = data.get("razorpay_payment_id")
    razorpay_order_id     = data.get("razorpay_order_id")
    razorpay_signature    = data.get("razorpay_signature")
    coins                 = data.get("coins", 0)

    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id':   razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature':  razorpay_signature
        })
        db.add_coins(user_id, coins)
        user_info = db.get_user_by_id(user_id)
        return jsonify({"status": "success", "new_balance": user_info[2]})
    except razorpay.errors.SignatureVerificationError:
        return jsonify({"error": "Invalid payment signature"}), 400
    except Exception as e:
        print(f"❌ Payment Verification Error: {e}")
        return jsonify({"error": "Payment verification failed"}), 500


# ──────────────────────────────────────────────
# Misc / Health
# ──────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models": [EMOTION_MODEL, PERSONA_MODEL],
        "api_connected": client is not None
    })


@app.route("/api/admin/boost", methods=["GET"])
def admin_boost():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    db.add_coins(user_id, 999999)
    user_info = db.get_user_by_id(user_id)
    return jsonify({"status": "SUCCESS! YOU ARE NOW A SUPER USER.", "new_balance": user_info[2]})


# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("\n💜 Luna AI Girlfriend Backend Starting...")
    print(f"🧠 Emotion Model: {EMOTION_MODEL}")
    print(f"💬 Persona Model: {PERSONA_MODEL}")
    print("🗄️  Database: Supabase (cloud Postgres)")
    print("🌐 Server: http://localhost:5000\n")

    app.run(debug=True, port=5000)
