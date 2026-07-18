import firebase_admin
from firebase_admin import credentials, db
from backend.config import Config

def init_firebase():
    """
    Initializes the global Firebase Admin SDK app instance safely if it hasn't
    been created yet, preventing initialization collision errors.
    """
    if not firebase_admin._apps:
        cred = credentials.Certificate(Config.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': Config.FIREBASE_DATABASE_URL
        })
    return db.reference()