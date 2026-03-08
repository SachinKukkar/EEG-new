"""Database configuration loaded entirely from environment variables.

Defaults are for local development only — always set real values in production
via environment variables or a secrets manager.
"""
import os

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'eeg_user'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'eeg_biometric'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'connection_timeout': 10,
}