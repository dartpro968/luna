"""
Luna AI - Supabase Database Layer
Replaces local SQLite with Supabase (Postgres + Auth).
"""
import os
import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Use the service-role key on the backend (bypasses RLS for admin operations)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ──────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────

def create_user(email: str, password: str, name: str, dob: str):
    """
    Register a new user via Supabase Auth, then create their profile row.
    Returns (user_id, name) on success, or None on failure.
    """
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True   # skip confirmation email for now
        })
        user_id = res.user.id

        # Insert profile
        supabase.table("profiles").insert({
            "id": user_id,
            "name": name,
            "dob": dob,
            "coins": 5,
            "last_free_claim": today
        }).execute()

        return user_id
    except Exception as e:
        print(f"create_user error: {e}")
        return None


def verify_user(email: str, password: str):
    """
    Email/password sign-in via Supabase Auth.
    Returns (user_id, name, dob, coins) or None.
    """
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user_id = res.user.id
        profile = supabase.table("profiles").select("name, dob, coins").eq("id", user_id).single().execute()
        d = profile.data
        return (user_id, d["name"], d["dob"], d["coins"])
    except Exception as e:
        print(f"verify_user error: {e}")
        return None


def verify_google_user(email: str, name: str):
    """
    Look up existing Google/OAuth user by email, or create a new profile.
    Returns ((user_id, name, dob, coins), is_new).
    """
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    try:
        # Look up by email in Auth admin API
        users_res = supabase.auth.admin.list_users()
        email_lower = email.lower()
        existing_user = next((u for u in users_res if u.email and u.email.lower() == email_lower), None)

        if existing_user:
            user_id = existing_user.id
            profile_res = supabase.table("profiles").select("name, dob, coins").eq("id", user_id).maybe_single().execute()
            if profile_res.data:
                d = profile_res.data
                return (user_id, d["name"], d["dob"], d["coins"]), False
            else:
                # Profile missing — create it
                supabase.table("profiles").insert({
                    "id": user_id, "name": name, "dob": "", "coins": 5, "last_free_claim": today
                }).execute()
                return (user_id, name, "", 5), True
        else:
            # Brand new Google user: create auth entry + profile
            res = supabase.auth.admin.create_user({
                "email": email,
                "email_confirm": True,
                "user_metadata": {"name": name}
            })
            user_id = res.user.id
            supabase.table("profiles").insert({
                "id": user_id, "name": name, "dob": "", "coins": 5, "last_free_claim": today
            }).execute()
            return (user_id, name, "", 5), True
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"verify_google_user error: {err_msg}")
        return None, str(e)


def verify_token(token: str):
    """
    Validate a Supabase JWT and return the user_id, or None if invalid.
    """
    try:
        res = supabase.auth.get_user(token)
        return res.user.id
    except Exception:
        return None


# ──────────────────────────────────────────────
# Profile helpers
# ──────────────────────────────────────────────

def update_user_dob(user_id: str, dob: str):
    supabase.table("profiles").update({"dob": dob}).eq("id", user_id).execute()


def get_user_by_id(user_id: str):
    """Returns (name, dob, coins) or None."""
    try:
        res = supabase.table("profiles").select("name, dob, coins").eq("id", user_id).single().execute()
        d = res.data
        return (d["name"], d["dob"], d["coins"])
    except Exception:
        return None


def deduct_coin(user_id: str) -> bool:
    """Deducts 1 coin if balance > 0. Returns True on success."""
    try:
        profile = supabase.table("profiles").select("coins").eq("id", user_id).single().execute()
        coins = profile.data["coins"]
        if coins <= 0:
            return False
        supabase.table("profiles").update({"coins": coins - 1}).eq("id", user_id).execute()
        return True
    except Exception:
        return False


def add_coins(user_id: str, amount: int):
    try:
        profile = supabase.table("profiles").select("coins").eq("id", user_id).single().execute()
        current = profile.data["coins"]
        supabase.table("profiles").update({"coins": current + amount}).eq("id", user_id).execute()
    except Exception as e:
        print(f"add_coins error: {e}")


def check_and_grant_daily_coins(user_id: str) -> bool:
    """Grants 3 daily coins if it's a new day."""
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    try:
        res = supabase.table("profiles").select("last_free_claim, coins").eq("id", user_id).single().execute()
        d = res.data
        if d["last_free_claim"] != today:
            new_balance = d["coins"] + 3
            supabase.table("profiles").update({
                "coins": new_balance,
                "last_free_claim": today
            }).eq("id", user_id).execute()
            return True
        return False
    except Exception as e:
        print(f"check_and_grant_daily_coins error: {e}")
        return False


# ──────────────────────────────────────────────
# Messages helpers
# ──────────────────────────────────────────────

def save_message(user_id: str, role: str, content: str, persona: str = "luna"):
    """Save a message for a specific user + persona thread."""
    try:
        supabase.table("messages").insert({
            "user_id": user_id,
            "role": role,
            "content": content,
            "persona": persona
        }).execute()
    except Exception as e:
        print(f"save_message error: {e}")


def get_history(user_id: str, persona: str = "luna", limit: int = 200):
    """Returns list of {role, content} dicts for a specific user + persona."""
    try:
        res = (
            supabase.table("messages")
            .select("role, content")
            .eq("user_id", user_id)
            .eq("persona", persona)
            .order("id", desc=False)
            .limit(limit)
            .execute()
        )
        return [{"role": r["role"], "content": r["content"]} for r in res.data]
    except Exception as e:
        print(f"get_history error: {e}")
        return []


def clear_history(user_id: str, persona: str = None):
    """Clear messages for a user. If persona given, clears only that thread."""
    try:
        q = supabase.table("messages").delete().eq("user_id", user_id)
        if persona:
            q = q.eq("persona", persona)
        q.execute()
    except Exception as e:
        print(f"clear_history error: {e}")
