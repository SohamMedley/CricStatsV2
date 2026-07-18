# CricStats Production Domain Constants & Enums
class EventType:
    RUN = "RUN"
    EXTRA = "EXTRA"
    WICKET = "WICKET"
    UNDO = "UNDO"
    SYNC = "SYNC"
    BOWLER_CHANGE = "BOWLER_CHANGE"
    BATSMAN_CHANGE = "BATSMAN_CHANGE"

class ExtraType:
    WD = "WD"
    NB = "NB"
    B = "B"
    LB = "LB"

class DismissalType:
    BOWLED = "Bowled"
    CATCH_OUT = "Catch Out"
    STUMPED = "Stumped"
    RUN_OUT = "Run Out"
    HIT_WICKET = "Hit Wicket"

def process_ball_event(match_state, event_type, runs_scored=0, extra_type=None, dismissal=None, fielder_id=None, run_out_batsman_id=None, bowler_id=None, bowler_name=None, batsman_id=None, batsman_name=None, position_key=None):
    """
    Appends a new event payload to the ledger history and executes a clean initial-state
    replay sequence to compute perfect, zero-drift statistics.
    """
    if "event_ledger" not in match_state or match_state["event_ledger"] is None:
        match_state["event_ledger"] = []

    if event_type == EventType.UNDO:
        if match_state["event_ledger"]:
            match_state["event_ledger"].pop()
        return replay_entire_match_ledger(match_state)

    # Build transaction snapshot payload to record to historical ledger path
    event_payload = {
        "event_type": event_type,
        "runs_scored": int(runs_scored),
        "extra_type": extra_type,
        "dismissal": dismissal,
        "fielder_id": fielder_id,
        "run_out_batsman_id": run_out_batsman_id,
        "bowler_id": bowler_id,
        "bowler_name": bowler_name,
        "batsman_id": batsman_id,
        "batsman_name": batsman_name,
        "position_key": position_key
    }
    
    match_state["event_ledger"].append(event_payload)
    return replay_entire_match_ledger(match_state)

def replay_entire_match_ledger(match_state):
    """
    Resets running statistic tallies to ground-zero states and rebuilds metrics incrementally
    by replaying the transaction history block. This mathematically eliminates delta drift errors
    and naturally supports structural undo commands.
    """
    m_id = match_state.get("match_id")
    t_a = match_state.get("team_a_name")
    t_b = match_state.get("team_b_name")
    m_overs = match_state.get("max_overs", 1)
    t_win = match_state.get("toss_winner")
    dec = match_state.get("decision")
    c_inn = match_state.get("current_innings", 1)
    status = match_state.get("status", "live")
    winner = match_state.get("winner", "")
    ledger = match_state.get("event_ledger", [])
    
    init_setup = match_state.get("initial_setup_snapshot", {})
    
    rebuilt_state = {
        "match_id": m_id,
        "team_a_name": t_a,
        "team_b_name": t_b,
        "max_overs": m_overs,
        "toss_winner": t_win,
        "decision": dec,
        "current_innings": c_inn,
        "status": status,
        "winner": winner,
        "event_ledger": ledger,
        "initial_setup_snapshot": init_setup,
        "innings": {
            "innings_1": reinitialize_innings_schema(init_setup.get("inn1_batting"), init_setup.get("inn1_bowling"), init_setup),
            "innings_2": None
        }
    }
    
    # Proactively build second innings branch structures during replay configurations
    if int(c_inn) == 2 or init_setup.get("inn2_batting") or "inn2_setup" in init_setup:
        inn2_bat = init_setup.get("inn2_batting") or init_setup.get("inn1_bowling")
        inn2_bowl = init_setup.get("inn2_bowling") or init_setup.get("inn1_batting")
        inn2_setup_data = init_setup.get("inn2_setup", {})
        
        # Merge fallbacks to guarantee dictionary lookup keys are present
        merged_setup = {
            "striker_id": inn2_setup_data.get("striker_id"),
            "striker_name": inn2_setup_data.get("striker_name"),
            "non_striker_id": inn2_setup_data.get("non_striker_id"),
            "non_striker_name": inn2_setup_data.get("non_striker_name"),
            "bowler_id": inn2_setup_data.get("bowler_id"),
            "bowler_name": inn2_setup_data.get("bowler_name"),
            "wicketkeeper_id": inn2_setup_data.get("wicketkeeper_id")
        }
        rebuilt_state["innings"]["innings_2"] = reinitialize_innings_schema(inn2_bat, inn2_bowl, merged_setup)

    # Process all ledger actions chronologically up to the current state point
    for event in ledger:
        execute_ledger_event_step(rebuilt_state, event)
        
    # Context check to handle post-innings transitions safely
    evaluate_live_innings_boundaries(rebuilt_state)
        
    return rebuilt_state

def reinitialize_innings_schema(bat_team, bowl_team, identities):
    if not bat_team:
        return None
    return {
        "batting_team": bat_team,
        "bowling_team": bowl_team,
        "total_runs": 0,
        "wickets": 0,
        "total_balls": 0,
        "free_hit_active": False,
        "extras": {"wd": 0, "nb": 0, "b": 0, "lb": 0, "total": 0},
        "batsmen": {
            identities["striker_id"]: {"id": identities["striker_id"], "name": identities.get("striker_name", "Striker"), "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"} if identities.get("striker_id") else {},
            identities["non_striker_id"]: {"id": identities["non_striker_id"], "name": identities.get("non_striker_name", "Non-Striker"), "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"} if identities.get("non_striker_id") else {}
        },
        "bowlers": {
            identities["bowler_id"]: {"id": identities["bowler_id"], "name": identities.get("bowler_name", "Bowler"), "overs_bowled": 0.0, "balls": 0, "runs": 0, "wickets": 0, "maidens": 0} if identities.get("bowler_id") else {}
        },
        "fielding": {},
        "striker_id": identities.get("striker_id"),
        "non_striker_id": identities.get("non_striker_id"),
        "current_bowler_id": identities.get("bowler_id"),
        "wicketkeeper_id": identities.get("wicketkeeper_id")
    }

def execute_ledger_event_step(state, event):
    inn_key = f"innings_{state['current_innings']}"
    inn = state["innings"][inn_key]
    
    if not inn:
        return

    ev_type = event.get("event_type", "SYNC")
    
    if ev_type == EventType.BOWLER_CHANGE:
        target_id = event.get("bowler_id")
        target_name = event.get("bowler_name", "Bowler")
        if target_id:
            inn["current_bowler_id"] = target_id
            if target_id not in inn["bowlers"]:
                inn["bowlers"][target_id] = {"id": target_id, "name": target_name, "overs_bowled": 0.0, "balls": 0, "runs": 0, "wickets": 0, "maidens": 0}
        return

    if ev_type == EventType.BATSMAN_CHANGE:
        target_id = event.get("batsman_id")
        target_name = event.get("batsman_name", "Batsman")
        pos_key = event.get("position_key")
        if target_id and pos_key:
            inn[f"{pos_key}_id"] = target_id
            if target_id not in inn["batsmen"]:
                inn["batsmen"][target_id] = {"id": target_id, "name": target_name, "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"}
        return

    if not inn.get("striker_id") or not inn.get("current_bowler_id"):
        return

    striker_id = inn["striker_id"]
    bowler_id = inn["current_bowler_id"]
    
    runs = int(event.get("runs_scored", 0))
    extra_type = event.get("extra_type")
    dismissal = event.get("dismissal")
    fielder_id = event.get("fielder_id")
    ro_batsman_id = event.get("run_out_batsman_id")
    
    is_legal_ball = True
    currently_on_free_hit = inn.get("free_hit_active", False)
    
    if ev_type == EventType.SYNC:
        return

    if ev_type == EventType.EXTRA:
        if extra_type == ExtraType.WD:
            is_legal_ball = False
            inn["extras"]["wd"] += (1 + runs)
            inn["extras"]["total"] += (1 + runs)
            inn["total_runs"] += (1 + runs)
            if bowler_id in inn["bowlers"]:
                inn["bowlers"][bowler_id]["runs"] += (1 + runs)
            inn["free_hit_active"] = False
            
        elif extra_type == ExtraType.NB:
            is_legal_ball = False
            inn["extras"]["nb"] += 1
            inn["extras"]["total"] += 1
            inn["total_runs"] += 1
            if bowler_id in inn["bowlers"]:
                inn["bowlers"][bowler_id]["runs"] += (1 + runs)
            
            if runs > 0:
                inn["total_runs"] += runs
                inn["extras"]["total"] += runs
                if striker_id in inn["batsmen"]:
                    inn["batsmen"][striker_id]["runs"] += runs
                
            inn["free_hit_active"] = True
            
        elif extra_type in [ExtraType.B, ExtraType.LB]:
            inn["extras"][extra_type.lower()] += runs
            inn["extras"]["total"] += runs
            inn["total_runs"] += runs
            inn["free_hit_active"] = False

    elif ev_type == EventType.RUN:
        inn["total_runs"] += runs
        if striker_id in inn["batsmen"]:
            inn["batsmen"][striker_id]["runs"] += runs
        if bowler_id in inn["bowlers"]:
            inn["bowlers"][bowler_id]["runs"] += runs
        if runs == 4 and striker_id in inn["batsmen"]: 
            inn["batsmen"][striker_id]["fours"] += 1
        if runs == 6 and striker_id in inn["batsmen"]: 
            inn["batsmen"][striker_id]["sixes"] += 1
        inn["free_hit_active"] = False

    if is_legal_ball:
        inn["total_balls"] += 1
        if striker_id in inn["batsmen"]:
            inn["batsmen"][striker_id]["balls"] += 1
        if bowler_id in inn["bowlers"]:
            inn["bowlers"][bowler_id]["balls"] += 1
        
        if bowler_id in inn["bowlers"]:
            b_balls = inn["bowlers"][bowler_id]["balls"]
            inn["bowlers"][bowler_id]["overs_bowled"] = round((b_balls // 6) + (b_balls % 6) / 10, 1)

    if dismissal:
        allowed_wicket = True
        if currently_on_free_hit and dismissal not in [DismissalType.RUN_OUT]:
            allowed_wicket = False
            
        if allowed_wicket:
            inn["wickets"] += 1
            if bowler_id in inn["bowlers"]:
                inn["bowlers"][bowler_id]["wickets"] += 1
            
            if dismissal == DismissalType.RUN_OUT and ro_batsman_id:
                if ro_batsman_id in inn["batsmen"]:
                    inn["batsmen"][ro_batsman_id]["out_status"] = dismissal
                if ro_batsman_id == inn["striker_id"]:
                    inn["striker_id"] = None
                else:
                    inn["non_striker_id"] = None
            else:
                if striker_id in inn["batsmen"]:
                    inn["batsmen"][striker_id]["out_status"] = dismissal
                inn["striker_id"] = None
                
            if fielder_id:
                if fielder_id not in inn["fielding"]:
                    inn["fielding"][fielder_id] = {"catches": 0, "stumpings": 0, "run_outs": 0}
                if dismissal == DismissalType.CATCH_OUT: inn["fielding"][fielder_id]["catches"] += 1
                if dismissal == DismissalType.STUMPED: inn["fielding"][fielder_id]["stumpings"] += 1
                if dismissal == DismissalType.RUN_OUT: inn["fielding"][fielder_id]["run_outs"] += 1

    if runs % 2 != 0 and not dismissal:
        inn["striker_id"], inn["non_striker_id"] = inn["non_striker_id"], inn["striker_id"]
        
    if is_legal_ball and (inn["total_balls"] % 6 == 0) and not dismissal:
        if inn["striker_id"] and inn["non_striker_id"]:
            inn["striker_id"], inn["non_striker_id"] = inn["non_striker_id"], inn["striker_id"]

def evaluate_live_innings_boundaries(state):
    """
    Evaluates dynamic transitions at over or wicket caps, switching states 
    natively instead of auto-terminating the entire engine prematurely.
    """
    max_balls = int(state.get("max_overs", 1)) * 6
    inn_1 = state["innings"].get("innings_1")
    inn_2 = state["innings"].get("innings_2")
    
    if int(state["current_innings"]) == 1 and inn_1:
        if inn_1["wickets"] >= 10 or inn_1["total_balls"] >= max_balls:
            if not inn_2 and not state["initial_setup_snapshot"].get("inn2_setup"):
                state["status"] = "inn1_completed"
                
    elif int(state["current_innings"]) == 2 and inn_2 and inn_1:
        target = inn_1["total_runs"] + 1
        if inn_2["total_runs"] >= target or inn_2["wickets"] >= 10 or inn_2["total_balls"] >= max_balls:
            state["status"] = "completed"
            if inn_2["total_runs"] >= target:
                state["winner"] = inn_2["batting_team"]
            elif inn_1["total_runs"] > inn_2["total_runs"]:
                state["winner"] = inn_1["batting_team"]
            else:
                state["winner"] = "Match Tied"
