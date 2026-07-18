import os
from dotenv import load_dotenv

# Load environmental variables from local .env file if present
load_dotenv()

class Config:
    """
    Centralized configuration engine holding database location constants, 
    cryptographic session salts, and private security credential paths.
    """
    SECRET_KEY = os.environ.get('SECRET_KEY', 'bento_box_secret_key_777')
    DEBUG = os.environ.get('FLASK_DEBUG', '').lower() in {'1', 'true', 'yes'}
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    FIREBASE_CREDENTIALS_PATH = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase_creds.json')
    FIREBASE_DATABASE_URL = os.environ.get('FIREBASE_DATABASE_URL', 'https://cricstats-e21f1-default-rtdb.firebaseio.com/')
    DATABASE_BACKEND = os.environ.get('DATABASE_BACKEND', 'auto').lower()
    LOCAL_DATABASE_PATH = os.environ.get(
        'LOCAL_DATABASE_PATH',
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'cricstats.json'))
    )
