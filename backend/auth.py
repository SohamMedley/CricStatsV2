from functools import wraps
from flask import session, jsonify, request, redirect, url_for

# Predefined admin access credentials from configuration specifications
ADMIN_USERS = {
    "Admin1": "Delta247",
    "Admin2": "Gamma247"
}

def verify_admin(username, password):
    """
    Verifies provided username and password signatures against the fixed credential dictionary.
    """
    return ADMIN_USERS.get(username) == password

def login_required(f):
    """
    Route decorator ensuring administrative session tracking is verified[cite: 14].
    Gracefully intercepts raw JSON requests with a clean 401 status while handling
    standard viewport browser redirects natively[cite: 14].
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"status": "error", "message": "Unauthorized access"}), 401
            return redirect(url_for('main.login_page'))
        return f(*args, **kwargs)
    return decorated_function
