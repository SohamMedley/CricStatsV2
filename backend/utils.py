import random
import string

def generate_match_code():
    """
    Generates a unique 6-character alphanumeric match code.
    Used as the distinct spectator PIN for public read-only lookups.
    """
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def calculate_run_rate(runs, balls):
    """
    Computes the standard batting side current run rate per over.
    """
    if balls == 0:
        return 0.0
    overs = balls / 6
    return round(runs / overs, 2)

def calculate_strike_rate(runs, balls):
    """
    Computes an individual batsman's performance velocity scale metric.
    """
    if balls == 0:
        return 0.0
    return round((runs / balls) * 100, 2)

def calculate_economy(runs, balls):
    """
    Computes the running cost ratio of runs conceded per completed over for bowlers.
    """
    if balls == 0:
        return 0.0
    overs = balls / 6
    return round(runs / overs, 2)