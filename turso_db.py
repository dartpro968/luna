import os
import libsql
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

def get_client():
    """Initializes and returns a Turso client."""
    return libsql.connect(TURSO_URL, auth_token=TURSO_TOKEN)

def init_db():
    """Creates the necessary tables for Luna AI if they don't exist."""
    client = get_client()
    try:
        # Conversation History: Store every user and assistant message
        client.execute("""
            CREATE TABLE IF NOT EXISTS conversation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                persona TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # User Memory: Key-Value store for personal details (profile, likes, birthday, etc.)
        client.execute("""
            CREATE TABLE IF NOT EXISTS user_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, key)
            )
        """)
        
        # Indexing for faster lookups
        client.execute("CREATE INDEX IF NOT EXISTS idx_history_user_persona ON conversation_history(user_id, persona)")
        client.execute("CREATE INDEX IF NOT EXISTS idx_memory_user_key ON user_memory(user_id, key)")
        
        client.commit()
    finally:
        client.close()

def get_full_history(user_id, persona, limit=50):
    """Retrieves the chronological history of the conversation for a specific user and persona."""
    client = get_client()
    try:
        result = client.execute(
            "SELECT role, content FROM conversation_history WHERE user_id = ? AND persona = ? ORDER BY created_at ASC LIMIT ?",
            (user_id, persona, limit)
        )
        return [{"role": row[0], "content": row[1]} for row in result.rows]
    finally:
        client.close()

def append_history(user_id, persona, role, content):
    """Appends a new message to the conversation history."""
    client = get_client()
    try:
        client.execute(
            "INSERT INTO conversation_history (user_id, persona, role, content) VALUES (?, ?, ?, ?)",
            (user_id, persona, role, content)
        )
        client.commit()
    finally:
        client.close()

def get_user_memory(user_id):
    """Retrieves the complete user memory/profile as a dictionary."""
    client = get_client()
    try:
        result = client.execute(
            "SELECT key, value FROM user_memory WHERE user_id = ?",
            (user_id,)
        )
        return {row[0]: row[1] for row in result.rows}
    finally:
        client.close()

def upsert_user_memory(user_id, key, value):
    """Updates or inserts a fact into the user's memory."""
    client = get_client()
    try:
        client.execute("""
            INSERT INTO user_memory (user_id, key, value, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, key) DO UPDATE SET 
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, key, value))
        client.commit()
    finally:
        client.close()

def clear_persona_history(user_id, persona):
    """Clears history for a specific persona."""
    client = get_client()
    try:
        client.execute("DELETE FROM conversation_history WHERE user_id = ? AND persona = ?", (user_id, persona))
        client.commit()
    finally:
        client.close()

# Initialize tables on first run
if __name__ == "__main__":
    print("🚀 Initializing Turso DB...")
    init_db()
    print("✅ Tables Created!")
