"""MySQL database management for EEG system."""
import mysql.connector
from datetime import datetime
import logging
from db_config import DB_CONFIG


logger = logging.getLogger(__name__)

class EEGDatabase:
    def __init__(self):
        self.config = DB_CONFIG
        self.available = True
        try:
            self.init_database()
        except Exception as exc:
            self.available = False
            logger.error("Database initialization failed: %s", exc)
        
    def get_connection(self):
        """Get database connection."""
        return mysql.connector.connect(**self.config)
        
    def init_database(self):
        """Initialize database tables."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                subject_id INT NOT NULL,
                data_segments INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ''')
        
        # Authentication logs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS auth_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                success BOOLEAN NOT NULL,
                confidence FLOAT,
                reason TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # System settings
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                `key` VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
        
    def add_user(self, username, subject_id, data_segments=0):
        """Add new user to database."""
        if not self.available:
            return False

        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO users (username, subject_id, data_segments)
                VALUES (%s, %s, %s)
            ''', (username, subject_id, data_segments))
            conn.commit()
            return True
        except mysql.connector.IntegrityError:
            return False
        finally:
            cursor.close()
            conn.close()
            
    def remove_user(self, username):
        """Remove user from database."""
        if not self.available:
            return False

        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM users WHERE username = %s', (username,))
        affected = cursor.rowcount
        conn.commit()
        cursor.close()
        conn.close()
        
        return affected > 0
        
    def get_users(self):
        """Get all users."""
        if not self.available:
            return {}

        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT username, subject_id, data_segments FROM users')
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return {user[0]: {'subject_id': user[1], 'data_segments': user[2]} for user in users}
        
    def log_authentication(self, username, success, confidence=None, reason=None):
        """Log authentication attempt."""
        if not self.available:
            return

        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO auth_logs (username, success, confidence, reason)
            VALUES (%s, %s, %s, %s)
        ''', (username, success, confidence, reason))
        
        conn.commit()
        cursor.close()
        conn.close()
        
    def get_auth_stats(self):
        """Get authentication statistics."""
        if not self.available:
            return {
                'total_attempts': 0,
                'successful': 0,
                'success_rate': 0.0,
                'avg_confidence': 0.0
            }

        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                AVG(confidence) as avg_confidence
            FROM auth_logs
        ''')
        
        stats = cursor.fetchone()
        cursor.close()
        conn.close()
        
        total_attempts = int(stats[0]) if stats[0] else 0
        successful = int(stats[1]) if stats[1] else 0
        avg_confidence = float(stats[2]) if stats[2] else 0.0
        
        return {
            'total_attempts': total_attempts,
            'successful': successful,
            'success_rate': successful / total_attempts if total_attempts > 0 else 0.0,
            'avg_confidence': avg_confidence
        }

# Global database instance
db = EEGDatabase()