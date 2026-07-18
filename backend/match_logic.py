def initialize_match_state(match_data):
    """
    Prepares the baseline structural data schema for a new match database record.
    Instead of relying strictly on volatile nested mutations that risk state drift,
    this creates a persistent initial setup snapshot and an append-only event ledger 
    to support atomic transaction replays and seamless multi-admin sync overrides.
    """
    return {
        "match_id": match_data["match_id"],
        "team_a_name": match_data["team_a_name"],
        "team_b_name": match_data["team_b_name"],
        "max_overs": int(match_data["max_overs"]),
        "toss_winner": match_data["toss_winner"],
        "decision": match_data["decision"],
        "current_innings": 1,
        "status": "live",  # live, innings_break, completed[cite: 16]
        "winner": "",
        "event_ledger": [{"event_type": "SYNC", "runs_scored": 0}],
        "initial_setup_snapshot": {
            "striker_id": match_data["striker_id"],
            "striker_name": match_data["striker_name"],
            "non_striker_id": match_data["non_striker_id"],
            "non_striker_name": match_data["non_striker_name"],
            "bowler_id": match_data["bowler_id"],
            "bowler_name": match_data["bowler_name"],
            "wicketkeeper_id": match_data["wicketkeeper_id"],
            "inn1_batting": match_data["batting_team"],
            "inn1_bowling": match_data["bowling_team"]
        },
        "innings": {
            "innings_1": {
                "batting_team": match_data["batting_team"],
                "bowling_team": match_data["bowling_team"],
                "total_runs": 0,
                "wickets": 0,
                "total_balls": 0,
                "free_hit_active": False,
                "extras": {"wd": 0, "nb": 0, "b": 0, "lb": 0, "total": 0},
                "batsmen": {
                    match_data["striker_id"]: {"id": match_data["striker_id"], "name": match_data["striker_name"], "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"},
                    match_data["non_striker_id"]: {"id": match_data["non_striker_id"], "name": match_data["non_striker_name"], "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"}
                },
                "bowlers": {
                    match_data["bowler_id"]: {"id": match_data["bowler_id"], "name": match_data["bowler_name"], "overs_bowled": 0.0, "balls": 0, "runs": 0, "wickets": 0, "maidens": 0}
                },
                "fielding": {},
                "striker_id": match_data["striker_id"],
                "non_striker_id": match_data["non_striker_id"],
                "current_bowler_id": match_data["bowler_id"],
                "wicketkeeper_id": match_data["wicketkeeper_id"]
            },
            "innings_2": None
        }
    }