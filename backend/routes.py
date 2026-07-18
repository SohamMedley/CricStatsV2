from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from backend.auth import verify_admin, login_required
from backend.utils import generate_match_code
from backend.score_engine import process_ball_event

main = Blueprint('main', __name__)

db_ref = None

def set_db(reference):
    global db_ref
    db_ref = reference

# ─────────────────────────────────────────────────────────────────────────────
# SERVER SIDE SCHEMA VALIDATORS (DEFENSIVE DEFENSE LAYER)
# ─────────────────────────────────────────────────────────────────────────────
def validate_player_payload(data):
    """Verifies fields, lengths, and constraints for player profiles."""
    name = str(data.get('name', '')).strip()
    role = data.get('role', '')
    hand = data.get('hand', '')
    
    if not name or len(name) > 40: 
        return False, "Player name must be between 1 and 40 characters."
    if role not in ["Batsman", "Bowler", "All-rounder", "Wicketkeeper"]: 
        return False, "Invalid operational field role selection."
    if hand not in ["Right-handed", "Left-handed"]: 
        return False, "Invalid configuration selection for hand dominance."
    return True, name

def validate_team_payload(data):
    """Enforces active squad rules and roster sizes prior to database commit."""
    name = str(data.get('name', '')).strip()
    captain = data.get('captain', '')
    players = data.get('players', [])
    
    if not name or len(name) > 30: 
        return False, "Team identity labels must fall between 1 and 30 characters."
    if not captain: 
        return False, "Teams require exactly one designated Captain profile."
    if not isinstance(players, list) or len(players) < 1 or len(players) > 11:
        return False, "Active squads must contain between 1 and 11 unique players."
    if captain not in players: 
        return False, "The designated Captain must reside within the active squad pool."
    return True, name

# ─────────────────────────────────────────────────────────────────────────────
# VIEWPORTS ROUTING PATTERNS
# ─────────────────────────────────────────────────────────────────────────────
@main.route('/')
def index_page():
    return render_template('index.html')

@main.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'POST':
        data = request.json or request.form
        username = data.get('username')
        password = data.get('password')
        if verify_admin(username, password):
            session['admin_logged_in'] = True
            session['username'] = username
            return jsonify({"status": "success", "redirect": url_for('main.home_page')})
        return jsonify({"status": "error", "message": "Invalid Admin Credentials"}), 401
    return render_template('login.html')

@main.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.index_page'))

@main.route('/home')
@login_required
def home_page():
    return render_template('home.html')

@main.route('/player')
@login_required
def player_page():
    return render_template('player.html')

@main.route('/team')
@login_required
def team_page():
    return render_template('team.html')

@main.route('/match')
@login_required
def match_page():
    return render_template('match.html')

@main.route('/scorecard/<match_code>')
def scorecard_page(match_code):
    admin_view = session.get('admin_logged_in', False)
    return render_template('scorecard.html', match_code=match_code, admin_view=admin_view)

@main.route('/detailed-score/<match_code>')
def detailed_score_page(match_code):
    return render_template('detailed_score.html', match_code=match_code)

# ─────────────────────────────────────────────────────────────────────────────
# ATOMIC API LAYER WITH TRANSACTIONS AND SCHEMA GUARDS
# ─────────────────────────────────────────────────────────────────────────────
@main.route('/api/players', methods=['GET', 'POST'])
def api_players():
    if request.method == 'POST':
        if not session.get('admin_logged_in'): 
            return jsonify({"error": "Unauthorized Access Token"}), 401
        
        is_valid, msg_or_name = validate_player_payload(request.json or {})
        if not is_valid: 
            return jsonify({"status": "error", "message": msg_or_name}), 400
        
        def player_txn(current_data):
            players_dict = current_data or {}
            
            for p in players_dict.values():
                if p and str(p.get('name')).lower() == msg_or_name.lower():
                    raise ValueError("Duplicate Profile Error: Name already exists.")
            
            new_key = f"player_{len(players_dict) + 1}"
            payload = request.json
            payload['id'] = new_key
            payload['name'] = msg_or_name
            payload['stats'] = {
                "matches": 0, "runs": 0, "balls_faced": 0,
                "fours": 0, "sixes": 0, "wickets": 0, "balls_bowled": 0, "runs_conceded": 0
            }
            players_dict[new_key] = payload
            return players_dict

        try:
            db_ref.child('players').transaction(player_txn)
            return jsonify({"status": "success"})
        except ValueError as ve:
            return jsonify({"status": "error", "message": str(ve)}), 409
        except Exception:
            return jsonify({"status": "error", "message": "Transaction failed."}), 400

    return jsonify(db_ref.child('players').get() or {})

@main.route('/api/players/<player_id>', methods=['DELETE'])
@login_required
def api_delete_player(player_id):
    try:
        db_ref.child('players').child(player_id).delete()
        return jsonify({"status": "success", "message": "Profile removed successfully."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to remove profile: {str(e)}"}), 500

@main.route('/api/teams', methods=['GET', 'POST'])
def api_teams():
    if request.method == 'POST':
        if not session.get('admin_logged_in'): 
            return jsonify({"error": "Unauthorized Access Token"}), 401
        
        payload = request.json or {}
        is_valid, clean_name = validate_team_payload(payload)
        if not is_valid: 
            return jsonify({"status": "error", "message": clean_name}), 400
        
        def team_txn(current_teams):
            teams_dict = current_teams or {}
            
            target_key = None
            for key, t in teams_dict.items():
                if t and str(t.get('name')).lower() == clean_name.lower():
                    target_key = key
                    break
            
            if target_key:
                payload['id'] = target_key
                payload['name'] = clean_name
                teams_dict[target_key] = payload
            else:
                new_key = f"team_{len(teams_dict) + 1}"
                payload['id'] = new_key
                payload['name'] = clean_name
                teams_dict[new_key] = payload
                
            return teams_dict

        try:
            db_ref.child('teams').transaction(team_txn)
            return jsonify({"status": "success"})
        except Exception:
            return jsonify({"status": "error", "message": "Atomic transaction update write failed."}), 400

    return jsonify(db_ref.child('teams').get() or {})

@main.route('/api/teams/<team_id>', methods=['DELETE'])
@login_required
def api_delete_team(team_id):
    try:
        db_ref.child('teams').child(team_id).delete()
        return jsonify({"status": "success", "message": "Team configuration deleted successfully."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to drop team: {str(e)}"}), 500

@main.route('/api/match/create', methods=['POST'])
@login_required
def api_create_match():
    data = request.json or {}
    t_a = data.get('team_a_name')
    t_b = data.get('team_b_name')
    s_id = data.get('striker_id')
    ns_id = data.get('non_striker_id')
    b_id = data.get('bowler_id')
    
    if not t_a or not t_b or not s_id or not ns_id:
        return jsonify({"status": "error", "message": "Configuration exception: Complete crease assignments are required."}), 400
        
    if t_a == t_b: 
        return jsonify({"status": "error", "message": "Adversary conflict: Teams cannot play themselves."}), 400
    if s_id == ns_id: 
        return jsonify({"status": "error", "message": "Crease slot assignment exception: Striker and Non-Striker must be unique."}), 400

    # WICKETKEEPER FILTER: Ensure a fallback isn't prioritized if marked as Keeper
    global_players = db_ref.child('players').get() or {}
    chosen_bowler_id = b_id
    chosen_bowler_name = data.get('bowler_name', 'Bowler')
    
    if chosen_bowler_id and chosen_bowler_id in global_players:
        player_profile = global_players[chosen_bowler_id]
        if player_profile.get('role') == 'Wicketkeeper' and not data.get('explicit_bowler_override'):
            # Auto-shift default priority to an available alternate bowler/all-rounder if exists
            for p_key, p_val in global_players.items():
                if p_key not in [s_id, ns_id] and p_val.get('role') in ['Bowler', 'All-rounder']:
                    chosen_bowler_id = p_key
                    chosen_bowler_name = p_val.get('name')
                    break

    match_code = generate_match_code()
    match_id = db_ref.child('matches').push().key
    
    initial_snapshot = {
        "striker_id": s_id,
        "striker_name": data.get('striker_name', 'Striker'),
        "non_striker_id": ns_id,
        "non_striker_name": data.get('non_striker_name', 'Non-Striker'),
        "bowler_id": chosen_bowler_id,
        "bowler_name": chosen_bowler_name,
        "wicketkeeper_id": data.get('wicketkeeper_id', 'Keeper'),
        "inn1_batting": data.get('batting_team'),
        "inn1_bowling": data.get('bowling_team')
    }
    
    data['match_id'] = match_id
    data['max_overs'] = int(data.get('max_overs', 1))
    data['bowler_id'] = chosen_bowler_id
    data['bowler_name'] = chosen_bowler_name
    
    from backend.match_logic import initialize_match_state
    initial_state = initialize_match_state(data)
    initial_state["initial_setup_snapshot"] = initial_snapshot
    initial_state["event_ledger"] = [{"event_type": "SYNC", "runs_scored": 0}]
    
    db_ref.child('matches').child(match_id).set(initial_state)
    db_ref.child('match_codes').child(match_code).set(match_id)
    
    return jsonify({"status": "success", "match_code": match_code})

@main.route('/api/match/live/<match_code>', methods=['GET'])
def api_live_match(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    if not match_id: 
        return jsonify({"status": "error", "message": "Invalid Match Access Token Pin"}), 404
    return jsonify(db_ref.child('matches').child(match_id).get() or {})

@main.route('/api/match/update/<match_code>', methods=['POST'])
@login_required
def api_update_score(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    if not match_id: 
        return jsonify({"status": "error", "message": "Target match record reference dead."}), 404
    
    post_data = request.json or {}
    
    def ball_txn(current_match_state):
        if not current_match_state: 
            return None
        
        updated = process_ball_event(
            current_match_state,
            event_type=post_data.get('event_type'),
            runs_scored=int(post_data.get('runs_scored', 0)),
            extra_type=post_data.get('extra_type'),
            dismissal=post_data.get('dismissal'),
            fielder_id=post_data.get('fielder_id'),
            run_out_batsman_id=post_data.get('run_out_batsman_id'),
            bowler_id=post_data.get('bowler_id'),
            bowler_name=post_data.get('bowler_name'),
            batsman_id=post_data.get('batsman_id'),
            batsman_name=post_data.get('batsman_name'),
            position_key=post_data.get('position_key')
        )
        return updated

    try:
        results = db_ref.child('matches').child(match_id).transaction(ball_txn)
        return jsonify({"status": "success", "state": results})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Atomic mutation tracking abort: {str(e)}"}), 500

@main.route('/api/match/next-innings/<match_code>', methods=['POST'])
@login_required
def api_next_innings(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    data = request.json or {}
    
    def next_inn_txn(state):
        if not state: 
            return None
        state['current_innings'] = 2
        state['status'] = 'live'
        
        snap = state["initial_setup_snapshot"]
        snap["inn2_batting"] = state['innings']['innings_1']['bowling_team']
        snap["inn2_bowling"] = state['innings']['innings_1']['batting_team']
        snap["inn2_setup"] = {
            "striker_id": data["striker_id"],
            "striker_name": data["striker_name"],
            "non_striker_id": data["non_striker_id"],
            "non_striker_name": data["non_striker_name"],
            "bowler_id": data["bowler_id"],
            "bowler_name": data["bowler_name"],
            "wicketkeeper_id": data["wicketkeeper_id"]
        }
        
        state["initial_setup_snapshot"] = snap
        
        from backend.score_engine import replay_entire_match_ledger
        return replay_entire_match_ledger(state)

    try:
        db_ref.child('matches').child(match_id).transaction(next_inn_txn)
        return jsonify({"status": "success"})
    except Exception:
        return jsonify({"status": "error", "message": "Innings mutation transaction failed."}), 500

@main.route('/api/match/complete/<match_code>', methods=['POST'])
@login_required
def api_complete_match(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    
    def complete_txn(state):
        if not state or state.get('status') == 'completed': 
            return state
        
        r1 = state['innings']['innings_1']['total_runs']
        r2 = state['innings']['innings_2']['total_runs'] if state['innings'].get('innings_2') else 0
        
        if r1 > r2: 
            winner = state['innings']['innings_1']['batting_team']
        elif r2 > r1: 
            winner = state['innings']['innings_2']['batting_team']
        else: 
            winner = "Match Tied"
            
        state['status'] = 'completed'
        state['winner'] = winner
        
        try:
            global_players = db_ref.child('players').get() or {}
            
            for inn_key in ['innings_1', 'innings_2']:
                inn = state['innings'].get(inn_key)
                if not inn: 
                    continue
                
                if inn.get('batsmen'):
                    for pid, b in inn['batsmen'].items():
                        str_pid = str(pid)
                        if str_pid in global_players:
                            p_ref = db_ref.child('players').child(str_pid).child('stats')
                            p_stats = p_ref.get() or {
                                "matches": 0, "runs": 0, "balls_faced": 0, "fours": 0, "sixes": 0, "wickets": 0, "balls_bowled": 0, "runs_conceded": 0
                            }
                            p_ref.update({
                                "matches": int(p_stats.get("matches", 0)) + 1,
                                "runs": int(p_stats.get("runs", 0)) + int(b.get('runs', 0)),
                                "balls_faced": int(p_stats.get("balls_faced", 0)) + int(b.get('balls', 0)),
                                "fours": int(p_stats.get("fours", 0)) + int(b.get('fours', 0)),
                                "sixes": int(p_stats.get("sixes", 0)) + int(b.get('sixes', 0))
                            })

                if inn.get('bowlers'):
                    for pid, b in inn['bowlers'].items():
                        str_pid = str(pid)
                        if str_pid in global_players:
                            p_ref = db_ref.child('players').child(str_pid).child('stats')
                            p_stats = p_ref.get() or {
                                "matches": 0, "runs": 0, "balls_faced": 0, "fours": 0, "sixes": 0, "wickets": 0, "balls_bowled": 0, "runs_conceded": 0
                            }
                            already_updated_as_batsman = (inn.get('batsmen') and str_pid in inn['batsmen'])
                            new_matches = int(p_stats.get("matches", 0)) if already_updated_as_batsman else int(p_stats.get("matches", 0)) + 1
                            
                            p_ref.update({
                                "matches": new_matches,
                                "wickets": int(p_stats.get("wickets", 0)) + int(b.get('wickets', 0)),
                                "balls_bowled": int(p_stats.get("balls_bowled", 0)) + int(b.get('balls', 0)),
                                "runs_conceded": int(p_stats.get("runs_conceded", 0)) + int(b.get('runs', 0))
                            })
        except Exception:
            pass
            
        return state

    try:
        res = db_ref.child('matches').child(match_id).transaction(complete_txn)
        return jsonify({"status": "success", "winner": res['winner']})
    except Exception:
        return jsonify({"status": "error", "message": "Completion execution block locked out."}), 500
