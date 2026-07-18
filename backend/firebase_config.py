import os

import firebase_admin
from firebase_admin import credentials, db
from backend.config import Config
from backend.local_database import LocalJsonDatabase

def init_firebase():
    """
    Initializes the global Firebase Admin SDK app instance safely if it hasn't
    been created yet, preventing initialization collision errors.
    """
    backend = Config.DATABASE_BACKEND
    credential_exists = os.path.isfile(Config.FIREBASE_CREDENTIALS_PATH)

    if backend not in {'auto', 'firebase', 'local'}:
        raise ValueError("DATABASE_BACKEND must be 'auto', 'firebase', or 'local'.")
    if backend == 'local' or (backend == 'auto' and not credential_exists):
        return LocalJsonDatabase(Config.LOCAL_DATABASE_PATH).reference()
    if not credential_exists:
        raise FileNotFoundError(
            f"Firebase credentials were not found at {Config.FIREBASE_CREDENTIALS_PATH}. "
            "Set FIREBASE_CREDENTIALS_PATH or use DATABASE_BACKEND=local."
        )

    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.Certificate(Config.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': Config.FIREBASE_DATABASE_URL
        })
    return db.reference()
