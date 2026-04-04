import sqlite3
import os

DB_PATH = 'chat_history.db'

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                dob TEXT NOT NULL,
                coins INTEGER DEFAULT 5,
                last_free_claim TEXT DEFAULT ''
            )
        ''')
        
        # Create messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        
        # Migrations
        try:
            cursor.execute('''ALTER TABLE messages ADD COLUMN user_id INTEGER DEFAULT 1''')
        except sqlite3.OperationalError:
            pass # Column already exists

        # Migration: Add coins and last_free_claim to existing users
        try:
            cursor.execute('''ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 5''')
            cursor.execute('''ALTER TABLE users ADD COLUMN last_free_claim TEXT DEFAULT ""''')
        except sqlite3.OperationalError:
            pass # Column already exists
            
        conn.commit()

def create_user(username, password, name, dob):
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO users (username, password, name, dob, coins, last_free_claim) VALUES (?, ?, ?, ?, ?, ?)', 
                           (username, password, name, dob, 5, today))
            conn.commit()
            return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None  # Username already exists

def verify_user(username, password):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, dob, coins FROM users WHERE username = ? AND password = ?', (username, password))
        return cursor.fetchone()

def verify_google_user(email, name):
    """Authenticate or create a Google user."""
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, dob, coins FROM users WHERE username = ?', (email,))
        user = cursor.fetchone()
        
        if user:
            return user, False # (user_tuple, is_new_user)
        else:
            cursor.execute('INSERT INTO users (username, password, name, dob, coins, last_free_claim) VALUES (?, ?, ?, ?, ?, ?)',
                           (email, "GOOGLE_AUTH", name, "", 5, today))
            conn.commit()
            new_id = cursor.lastrowid
            return (new_id, name, "", 5), True

def update_user_dob(user_id, dob):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET dob = ? WHERE id = ?', (dob, user_id))
        conn.commit()

def get_user_by_id(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT name, dob, coins FROM users WHERE id = ?', (user_id,))
        return cursor.fetchone()

def deduct_coin(user_id):
    """Safely deducts 1 coin if they have a balance."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET coins = coins - 1 WHERE id = ? AND coins > 0', (user_id,))
        conn.commit()
        return cursor.rowcount > 0

def add_coins(user_id, amount):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET coins = coins + ? WHERE id = ?', (amount, user_id))
        conn.commit()

def check_and_grant_daily_coins(user_id):
    """Grants 3 daily coins strictly if a new day has started."""
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT last_free_claim, coins FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        if not row: return False
        
        last_claim, current_coins = row
        if last_claim != today:
            # It's a new day! Grant exactly 3 coins, and update the claim date.
            # (Does not exceed or stack past 3 free coins for the day)
            new_balance = current_coins + 3
            cursor.execute('UPDATE users SET last_free_claim = ?, coins = ? WHERE id = ?', (today, new_balance, user_id))
            conn.commit()
            return True
        return False

def save_message(user_id, role, content):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)', (user_id, role, content))
        conn.commit()

def get_history(user_id, limit=200):
    """Retrieve up to 'limit' messages for a specific user, returned in chronological order"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT role, content 
            FROM (
                SELECT role, content, id 
                FROM messages 
                WHERE user_id = ?
                ORDER BY id DESC 
                LIMIT ?
            ) 
            ORDER BY id ASC
        ''', (user_id, limit))
        rows = cursor.fetchall()
        return [{"role": row[0], "content": row[1]} for row in rows]

def clear_history(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM messages WHERE user_id = ?', (user_id,))
        conn.commit()

# Ensure the DB is initialized when this module is imported
init_db()
