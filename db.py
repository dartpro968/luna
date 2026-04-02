import sqlite3
import os

DB_PATH = 'chat_history.db'

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        # Create table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

def save_message(role, content):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO messages (role, content) VALUES (?, ?)', (role, content))
        conn.commit()

def get_history(limit=200):
    """Retrieve up to 'limit' messages, returned in chronological order"""
    with get_connection() as conn:
        cursor = conn.cursor()
        # Fetch the last 'limit' messages ordered by id descending, then reverse so they are chronological
        cursor.execute('''
            SELECT role, content 
            FROM (
                SELECT role, content, id 
                FROM messages 
                ORDER BY id DESC 
                LIMIT ?
            ) 
            ORDER BY id ASC
        ''', (limit,))
        rows = cursor.fetchall()
        return [{"role": row[0], "content": row[1]} for row in rows]

def clear_history():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM messages')
        conn.commit()

# Ensure the DB is initialized when this module is imported
init_db()
