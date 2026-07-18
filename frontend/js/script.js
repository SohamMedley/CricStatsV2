// CricStats Unified Client Controller Script Engine

async function secureApiFetch(url, options = {}, timeoutMs = 8000) {
    const abortController = new AbortController();
    const id = setTimeout(() => abortController.abort(), timeoutMs);
    
    const baseOptions = {
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        ...options
    };

    try {
        const response = await fetch(url, baseOptions);
        clearTimeout(id);
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.message || `Server responded with HTTP Status code ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        clearTimeout(id);
        let clearErrorMessage = err.message;
        if (err.name === 'AbortError') {
            clearErrorMessage = "Network operation timed out. Please check your connectivity connection.";
        }
        triggerGlobalNotificationBanner(clearErrorMessage, true);
        throw err;
    }
}

function triggerGlobalNotificationBanner(msg, isError = false) {
    const banner = document.getElementById('feedbackToast');
    if (!banner) return;
    banner.innerText = msg;
    if (isError) {
        banner.style.background = 'rgba(255, 51, 75, 0.98)';
        banner.style.boxShadow = '0 24px 48px rgba(255, 51, 75, 0.4)';
    } else {
        banner.style.background = 'rgba(10, 84, 255, 0.98)';
        banner.style.boxShadow = '0 24px 48px rgba(10, 84, 255, 0.5)';
    }
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
}

function viewMatchSpectator() {
    const code = document.getElementById('matchCodeInput').value.trim().toUpperCase();
    if(code) window.location.href = `/scorecard/${code}`;
}

function executeAdminLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPassword').value;
    secureApiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username: user, password: pass })
    })
    .then(data => window.location.href = data.redirect)
    .catch(() => {});
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENHANCED ROSTER COMPILER WITH 1-LINE QUICK STATS HUD LAYOUT OVERLAYS
   ───────────────────────────────────────────────────────────────────────────── */
function loadPlayerRoster() {
    secureApiFetch('/api/players', { method: 'GET' })
    .then(players => {
        const container = document.getElementById('playerListContainer');
        const action = document.getElementById('actionContainer');
        if (!container) return;
        
        const count = Object.keys(players).length;
        let htmlBuffer = '';
        
        if(count === 0) {
            container.innerHTML = `<div class="empty-state-text">NO PROFILES RECORDED</div>`;
            action.innerHTML = `<button class="btn-full-width" onclick="togglePlayerModal(true)">+ ADD INITIAL PLAYER</button>`;
        } else {
            Object.values(players).forEach(p => {
                if (!p) return;
                
                const s = p.stats || { "matches": 0, "runs": 0, "balls_faced": 0, "fours": 0, "sixes": 0, "wickets": 0, "balls_bowled": 0, "runs_conceded": 0 };
                const batSr = s.balls_faced > 0 ? ((s.runs / s.balls_faced) * 100).toFixed(1) : "0.0";
                const bowlEcon = s.balls_bowled > 0 ? ((s.runs_conceded / (s.balls_bowled / 6)) ).toFixed(2) : "0.00";

                const dynamicSummaryString = (p.role === "Bowler") 
                    ? `M: ${s.matches} | Wkts: ${s.wickets} | Econ: ${bowlEcon}` 
                    : `M: ${s.matches} | Runs: ${s.runs} | S/R: ${batSr}`;

                htmlBuffer += `
                    <div class="search-profile-item" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 14px; margin-bottom: 14px;">
                        <div class="player-row-chip" 
                             style="border-bottom: none; padding: 12px 0;"
                             ondblclick="toggleAdvancedHudPopover('${p.id}')"
                             onmousedown="initializeHoldTimer(event, '${p.id}')"
                             onmouseup="clearHoldTimer(event)"
                             onmouseleave="clearHoldTimer(event)"
                             ontouchstart="initializeHoldTimer(event, '${p.id}')"
                             ontouchend="clearHoldTimer(event)">
                            <div>
                                <strong class="profile-name-string">${p.name}</strong> 
                                <span class="pool-player-meta" style="margin-top:2px;">${p.role} | ${p.hand}</span>
                                <span class="pool-player-meta" style="color: var(--electric-blue); font-weight:700; margin-top:4px;">${dynamicSummaryString}</span>
                            </div>
                            <span class="remove-player-trigger" onclick="deletePlayerProfile('${p.id}')">REMOVE</span>
                        </div>
                        
                        <div id="hud_popover_${p.id}" class="stats-popover-hud">
                            <span class="card-label" style="background: var(--cobalt-core); font-size: 0.65rem;">ADVANCED CAREER METRICS</span>
                            <div class="hud-metrics-grid">
                                <div class="hud-metric-box"><span>${s.matches}</span><small>Matches</small></div>
                                <div class="hud-metric-box"><span>${s.runs}</span><small>Runs</small></div>
                                <div class="hud-metric-box"><span>${batSr}</span><small>Bat S/R</small></div>
                                <div class="hud-metric-box"><span>${s.fours}/${s.sixes}</span><small>4s/6s</small></div>
                                <div class="hud-metric-box"><span>${s.wickets}</span><small>Wickets</small></div>
                                <div class="hud-metric-box"><span>${bowlEcon}</span><small>Econ</small></div>
                            </div>
                        </div>
                    </div>`;
            });
            container.innerHTML = htmlBuffer;
            if(count < 35) {
                action.innerHTML = `<button class="btn-full-width" onclick="togglePlayerModal(true)">+ ADD NEW PROFILE</button>`;
            }
        }
    }).catch(() => {});
}

function toggleAdvancedHudPopover(pid) {
    const el = document.getElementById(`hud_popover_${pid}`);
    if (el) el.classList.toggle('visible');
}

let structuralHoldTimerReference = null;

function initializeHoldTimer(event, pid) {
    if (structuralHoldTimerReference) clearTimeout(structuralHoldTimerReference);
    structuralHoldTimerReference = setTimeout(() => {
        toggleAdvancedHudPopover(pid);
    }, 600);
}

function clearHoldTimer(event) {
    if (structuralHoldTimerReference) {
        clearTimeout(structuralHoldTimerReference);
        structuralHoldTimerReference = null;
    }
}

function filterPlayerRosterFeed() {
    const searchString = document.getElementById('playerSearchBar').value.toLowerCase();
    const items = document.getElementsByClassName('search-profile-item');
    Array.from(items).forEach(item => {
        const nameText = item.querySelector('.profile-name-string').innerText.toLowerCase();
        item.style.display = nameText.includes(searchString) ? 'block' : 'none';
    });
}

function deletePlayerProfile(pid) {
    if (confirm("Are you sure you want to permanently erase this profile record from the database storage repository?")) {
        secureApiFetch(`/api/players/${pid}`, { method: 'DELETE' })
        .then(res => {
            triggerGlobalNotificationBanner(res.message, false);
            loadPlayerRoster();
        }).catch(() => {});
    }
}

function togglePlayerModal(show) {
    const modal = document.getElementById('playerModal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

function savePlayerProfile() {
    const pData = {
        name: document.getElementById('pName').value.trim(),
        role: document.getElementById('pRole').value,
        hand: document.getElementById('pHand').value
    };
    if(!pData.name) return triggerGlobalNotificationBanner("Identify Name Field Required", true);

    secureApiFetch('/api/players', {
        method: 'POST',
        body: JSON.stringify(pData)
    }).then(() => {
        togglePlayerModal(false);
        loadPlayerRoster();
    }).catch(() => {});
}

/* ─────────────────────────────────────────────────────────────────────────────
   DUAL PANELS STRUCTURAL ROSTER CONFIGURATOR WITH NO-CLONE IMPORT SYSTEM
   ───────────────────────────────────────────────────────────────────────────── */
let rosterMemory = [];
let historicalTeamsMemory = {};
let selectedTeamAPlayers = [];
let selectedTeamBPlayers = [];
let operationalNamingTarget = 'A';

function setupTeamConfigScreen() {
    secureApiFetch('/api/players', { method: 'GET' })
    .then(players => {
        rosterMemory = Object.values(players).sort((a,b) => a.name.localeCompare(b.name));
        rebuildSelectorDropdownPools();
        loadHistoricalTeamsList();
    }).catch(() => {});
}

function openNamingModal(target) {
    operationalNamingTarget = target;
    const currentVal = document.getElementById(`team${target}Name`).value;
    document.getElementById('tempTeamNameField').value = currentVal;
    document.getElementById('namingModalLabel').innerText = `SELECT TEAM ${target === 'A' ? '1' : '2'} BLUEPRINT`;
    
    const dropdown = document.getElementById('historicalTeamSelectorDropdown');
    if(dropdown) {
        let optionsHtml = `<option value="">-- Click to Select Saved Team --</option>`;
        Object.entries(historicalTeamsMemory).forEach(([key, t]) => {
            if(t) optionsHtml += `<option value="${key}">${t.name.toUpperCase()}</option>`;
        });
        dropdown.innerHTML = optionsHtml;
    }
    
    document.getElementById('namingModal').style.display = 'flex';
}

function closeNamingModal() {
    document.getElementById('namingModal').style.display = 'none';
}

function saveNamingModalValue() {
    const cleanName = document.getElementById('tempTeamNameField').value.trim() || `Team ${operationalNamingTarget === 'A' ? '1' : '2'}`;
    document.getElementById(`team${operationalNamingTarget}Name`).value = cleanName;
    document.getElementById(`labelTeam${operationalNamingTarget}Name`).innerText = cleanName.toUpperCase();
    closeNamingModal();
}

function importExistingTeamBlueprint(teamKey) {
    if (!teamKey || !historicalTeamsMemory[teamKey]) return;
    
    const teamBlueprint = historicalTeamsMemory[teamKey];
    document.getElementById(`team${operationalNamingTarget}Name`).value = teamBlueprint.name;
    document.getElementById(`labelTeam${operationalNamingTarget}Name`).innerText = teamBlueprint.name.toUpperCase();
    
    if (operationalNamingTarget === 'A') {
        selectedTeamAPlayers = [...(teamBlueprint.players || [])];
        document.getElementById('capA').value = teamBlueprint.captain || "";
    } else {
        selectedTeamBPlayers = [...(teamBlueprint.players || [])];
        document.getElementById('capB').value = teamBlueprint.captain || "";
    }
    
    closeNamingModal();
    rebuildSelectorDropdownPools();
}

function rebuildSelectorDropdownPools() {
    const selectA = document.getElementById('dropdownRosterA');
    const selectB = document.getElementById('dropdownRosterB');
    if (!selectA || !selectB) return;

    let baseA = `<option value="">+ Add Player to Team 1</option>`;
    let baseB = `<option value="">+ Add Player to Team 2</option>`;

    rosterMemory.forEach(p => {
        if (!selectedTeamAPlayers.includes(p.id) && !selectedTeamBPlayers.includes(p.id)) {
            baseA += `<option value="${p.id}">${p.name} (${p.role})</option>`;
            baseB += `<option value="${p.id}">${p.name} (${p.role})</option>`;
        }
    });

    selectA.innerHTML = baseA;
    selectB.innerHTML = baseB;

    syncPanelCaptainsDropdowns();
    renderPaneChipsList('A', selectedTeamAPlayers);
    renderPaneChipsList('B', selectedTeamBPlayers);
}

function syncPanelCaptainsDropdowns() {
    const capSelA = document.getElementById('capA');
    const capSelB = document.getElementById('capB');
    
    const activeCapA = capSelA.value;
    const activeCapB = capSelB.value;

    let htmlA = `<option value="">Select Capt</option>`;
    let htmlB = `<option value="">Select Capt</option>`;

    rosterMemory.forEach(p => {
        htmlA += `<option value="${p.id}">${p.name}</option>`;
        htmlB += `<option value="${p.id}">${p.name}</option>`;
    });

    capSelA.innerHTML = htmlA;
    capSelB.innerHTML = htmlB;

    capSelA.value = activeCapA;
    capSelB.value = activeCapB;
}

function allocateCaptainSync(panel) {
    const selectedCapId = document.getElementById(`cap${panel}`).value;
    if (!selectedCapId) return;

    if (panel === 'A') {
        if (selectedTeamBPlayers.includes(selectedCapId)) {
            selectedTeamBPlayers = selectedTeamBPlayers.filter(x => x !== selectedCapId);
        }
        if (!selectedTeamAPlayers.includes(selectedCapId)) {
            selectedTeamAPlayers.push(selectedCapId);
        }
    } else {
        if (selectedTeamAPlayers.includes(selectedCapId)) {
            selectedTeamAPlayers = selectedTeamAPlayers.filter(x => x !== selectedCapId);
        }
        if (!selectedTeamBPlayers.includes(selectedCapId)) {
            selectedTeamBPlayers.push(selectedCapId);
        }
    }
    rebuildSelectorDropdownPools();
}

function appendPlayerFromDropdown(panel) {
    const dropdown = document.getElementById(`dropdownRoster${panel}`);
    const pid = dropdown.value;
    if (!pid) return;

    if (panel === 'A') {
        selectedTeamAPlayers.push(pid);
    } else {
        selectedTeamBPlayers.push(pid);
    }
    dropdown.value = "";
    rebuildSelectorDropdownPools();
}

function renderPaneChipsList(panel, targetArray) {
    const container = document.getElementById(`team${panel}Players`);
    if (!container) return;
    
    let htmlContent = '';
    targetArray.forEach(id => {
        const p = rosterMemory.find(x => x.id === id);
        if (p) {
            htmlContent += `
            <div class="player-row-chip">
                <span>${p.name}</span>
                <span class="remove-player-trigger" onclick="removePlayerFromTeam('${id}', '${panel}')">x</span>
            </div>`;
        }
    });
    container.innerHTML = htmlContent;
}

function removePlayerFromTeam(id, panel) {
    if (panel === 'A') {
        selectedTeamAPlayers = selectedTeamAPlayers.filter(x => x !== id);
        if (document.getElementById('capA').value === id) document.getElementById('capA').value = "";
    } else {
        selectedTeamBPlayers = selectedTeamBPlayers.filter(x => x !== id);
        if (document.getElementById('capB').value === id) document.getElementById('capB').value = "";
    }
    rebuildSelectorDropdownPools();
}

function loadHistoricalTeamsList() {
    secureApiFetch('/api/teams', { method: 'GET' })
    .then(teams => {
        historicalTeamsMemory = teams;
        const container = document.getElementById('historicalTeamsContainer');
        if (!container) return;
        
        if (Object.keys(teams).length === 0) {
            container.innerHTML = `<div class="empty-state-text">NO CONFIGURATIONS SAVED</div>`;
            return;
        }
        
        let batchHtml = '';
        Object.values(teams).forEach(t => {
            if (!t) return;
            batchHtml += `
            <div class="player-row-chip" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span><strong>${t.name.toUpperCase()}</strong> <span class="pool-player-meta">${t.players ? t.players.length : 0} Squad Units</span></span>
                <span class="remove-player-trigger" onclick="deleteTeamRecord('${t.id}')">DROP</span>
            </div>`;
        });
        container.innerHTML = batchHtml;
    }).catch(() => {});
}

function deleteTeamRecord(tid) {
    if (confirm("Permanently erase this team record configuration blueprint?")) {
        secureApiFetch(`/api/teams/${tid}`, { method: 'DELETE' })
        .then(res => {
            triggerGlobalNotificationBanner(res.message, false);
            setupTeamConfigScreen();
        }).catch(() => {});
    }
}

function commitTeamConfiguration() {
    const nameA = document.getElementById('teamAName').value.trim();
    const nameB = document.getElementById('teamBName').value.trim();
    const cA = document.getElementById('capA').value;
    const cB = document.getElementById('capB').value;
    
    if(!cA || !cB) return triggerGlobalNotificationBanner("Select Captain for both teams first!", true);
    if(selectedTeamAPlayers.length < 1 || selectedTeamBPlayers.length < 1) {
        return triggerGlobalNotificationBanner("Roster sets require at least 1 unit element.", true);
    }
    
    const teamAData = { name: nameA, captain: cA, players: selectedTeamAPlayers };
    const teamBData = { name: nameB, captain: cB, players: selectedTeamBPlayers };
    
    Promise.all([
        secureApiFetch('/api/teams', { method:'POST', body:JSON.stringify(teamAData) }),
        secureApiFetch('/api/teams', { method:'POST', body:JSON.stringify(teamBData) })
    ]).then(() => {
        triggerGlobalNotificationBanner("✓ Teams Blueprint Saved Successfully", false);
        setTimeout(() => { window.location.href = '/home'; }, 1000);
    }).catch(() => {});
}

/* ─────────────────────────────────────────────────────────────────────────────
   UPGRADED MATCH ENGINE DYNAMIC PANELS & POOL SEGREGATION
   ───────────────────────────────────────────────────────────────────────────── */
let globalTeams = {};

function selectTossWinnerToggle(choice) {
    document.getElementById('mTossWinner').value = choice;
    document.getElementById('tossPillA').classList.toggle('active', choice === 'A');
    document.getElementById('tossPillB').classList.toggle('active', choice === 'B');
    syncMatchPlayers();
}

function selectDecisionToggle(choice) {
    document.getElementById('mDecision').value = choice;
    document.getElementById('decisionPillBat').classList.toggle('active', choice === 'Bat');
    document.getElementById('decisionPillBowl').classList.toggle('active', choice === 'Bowl');
    syncMatchPlayers();
}

function initMatchSetupFields() {
    secureApiFetch('/api/teams', { method: 'GET' })
    .then(teams => {
        globalTeams = teams;
        const selA = document.getElementById('mTeamA');
        const selB = document.getElementById('mTeamB');
        if (!selA || !selB) return;
        
        if (Object.keys(teams).length === 0) {
            triggerGlobalNotificationBanner("No teams found. Please create teams before starting a match.", true);
            window.location.href = '/home';
            return;
        }
        
        let optionsHtml = '';
        Object.entries(teams).forEach(([key, t]) => {
            optionsHtml += `<option value="${key}">${t.name}</option>`;
        });
        selA.innerHTML = optionsHtml;
        selB.innerHTML = optionsHtml;
        
        selA.selectedIndex = 0;
        if(selA.options.length > 1) selB.selectedIndex = 1;

        const updateLabelsAndPlayers = () => {
            const tAKey = selA.value;
            const tBKey = selB.value;
            if (globalTeams[tAKey] && globalTeams[tBKey]) {
                document.getElementById('tossPillA').innerText = globalTeams[tAKey].name.toUpperCase();
                document.getElementById('tossPillB').innerText = globalTeams[tBKey].name.toUpperCase();
            }
            syncMatchPlayers();
        };

        selA.onchange = updateLabelsAndPlayers;
        selB.onchange = updateLabelsAndPlayers;

        updateLabelsAndPlayers();
    }).catch(() => {});
}

function syncMatchPlayers() {
    secureApiFetch('/api/players', { method: 'GET' }).then(players => {
        const valA = document.getElementById('mTeamA').value;
        const valB = document.getElementById('mTeamB').value;
        const tossChoice = document.getElementById('mTossWinner').value;
        const decisionChoice = document.getElementById('mDecision').value;
        
        const tA = globalTeams[valA];
        const tB = globalTeams[valB];
        
        const striker = document.getElementById('mStriker');
        const nonStriker = document.getElementById('mNonStriker');
        const bowler = document.getElementById('mBowler');
        const keeper = document.getElementById('mKeeper');
        
        if (!striker || !nonStriker || !bowler || !keeper || !tA || !tB) return;
        
        let battingTeam = null;
        let bowlingTeam = null;

        if (tossChoice === 'A') {
            if (decisionChoice === 'Bat') {
                battingTeam = tA; bowlingTeam = tB;
            } else {
                battingTeam = tB; bowlingTeam = tA;
            }
        } else {
            if (decisionChoice === 'Bat') {
                battingTeam = tB; bowlingTeam = tA;
            } else {
                battingTeam = tA; bowlingTeam = tB;
            }
        }
        
        let battingHtml = '';
        let bowlingHtml = '';
        let defaultKeeperId = "";
        
        if (battingTeam && battingTeam.players) {
            battingTeam.players.forEach(pid => {
                const p = players[pid];
                if(p) battingHtml += `<option value="${pid}">${p.name}</option>`;
            });
        }
        if (bowlingTeam && bowlingTeam.players) {
            bowlingTeam.players.forEach(pid => {
                const p = players[pid];
                if(p) {
                    bowlingHtml += `<option value="${pid}">${p.name}</option>`;
                    if (p.role === "Wicketkeeper" && !defaultKeeperId) {
                        defaultKeeperId = pid;
                    }
                }
            });
        }
        
        striker.innerHTML = battingHtml;
        nonStriker.innerHTML = battingHtml;
        bowler.innerHTML = bowlingHtml;
        keeper.innerHTML = bowlingHtml;

        if(striker.options.length > 1) nonStriker.selectedIndex = 1;
        if(bowler.options.length > 1) keeper.selectedIndex = 0;
        
        if (defaultKeeperId) {
            keeper.value = defaultKeeperId;
        }
    }).catch(() => {});
}

function launchMatchEngine() {
    const tAKey = document.getElementById('mTeamA').value;
    const tBKey = document.getElementById('mTeamB').value;
    const tossChoice = document.getElementById('mTossWinner').value;
    const decisionChoice = document.getElementById('mDecision').value;

    if(!tAKey || !tBKey || tAKey === tBKey) {
        return triggerGlobalNotificationBanner("Select two unique opponent sides to continue.", true);
    }

    const strikerSelect = document.getElementById('mStriker');
    const nonStrikerSelect = document.getElementById('mNonStriker');
    const bowlerSelect = document.getElementById('mBowler');
    const keeperSelect = document.getElementById('mKeeper');

    if(!strikerSelect.value || !nonStrikerSelect.value || !bowlerSelect.value || !keeperSelect.value) {
        return triggerGlobalNotificationBanner("Assign active profiles to all open crease slots.", true);
    }

    const tossWinnerName = (tossChoice === 'A') ? globalTeams[tAKey].name : globalTeams[tBKey].name;
    let battingTeamName = "";
    let bowlingTeamName = "";

    if (tossChoice === 'A') {
        if (decisionChoice === 'Bat') {
            battingTeamName = globalTeams[tAKey].name; bowlingTeamName = globalTeams[tBKey].name;
        } else {
            battingTeamName = globalTeams[tBKey].name; bowlingTeamName = globalTeams[tAKey].name;
        }
    } else {
        if (decisionChoice === 'Bat') {
            battingTeamName = globalTeams[tBKey].name; bowlingTeamName = globalTeams[tAKey].name;
        } else {
            battingTeamName = globalTeams[tAKey].name; bowlingTeamName = globalTeams[tBKey].name;
        }
    }
    
    const payload = {
        team_a_name: globalTeams[tAKey].name,
        team_b_name: globalTeams[tBKey].name,
        max_overs: document.getElementById('mOvers').value,
        toss_winner: tossWinnerName,
        decision: decisionChoice,
        batting_team: battingTeamName,
        bowling_team: bowlingTeamName,
        striker_id: strikerSelect.value,
        striker_name: strikerSelect.options[strikerSelect.selectedIndex].text,
        non_striker_id: nonStrikerSelect.value,
        non_striker_name: nonStrikerSelect.options[nonStrikerSelect.selectedIndex].text,
        bowler_id: bowlerSelect.value,
        bowler_name: bowlerSelect.options[bowlerSelect.selectedIndex].text,
        wicketkeeper_id: keeperSelect.value
    };
    
    secureApiFetch('/api/match/create', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(data => window.location.href = `/scorecard/${data.match_code}`)
    .catch(() => {});
}

let liveStateMemory = null;
let currentOverBowlerPromptActive = false;
// SECURITY LOCK ADDED: Active modal blocking token flags
let currentBatsmanPromptActive = false;
let synchronizationLoopIntervalTimer = null;

function startLiveScoreSynchronizationLoop() {
    fetchLiveScoreboardData();
    synchronizationLoopIntervalTimer = setInterval(fetchLiveScoreboardData, 4000);
}

function fetchLiveScoreboardData() {
    if (!window.matchCode) return;
    fetch(`/api/match/live/${window.matchCode}`)
    .then(res => { if(res.ok) return res.json(); })
    .then(state => {
        if(state) {
            liveStateMemory = state;
            if (state.status === 'completed') {
                if (synchronizationLoopIntervalTimer) {
                    clearInterval(synchronizationLoopIntervalTimer);
                    synchronizationLoopIntervalTimer = null;
                }
            }
            updateLiveScoreboardUI(state);
        }
    }).catch(() => {});
}

function updateLiveScoreboardUI(state) {
    const inn = state.innings[`innings_${state.current_innings}`];
    if (!inn || !document.getElementById('liveBattingTeam')) return;
    
    document.getElementById('liveBattingTeam').innerText = `${inn.batting_team.toUpperCase()} [INNINGS ${state.current_innings}]`;
    document.getElementById('liveScoreDisplay').innerText = `${inn.total_runs}/${inn.wickets}`;
    document.getElementById('liveOversDisplay').innerText = Math.floor(inn.total_balls / 6) + "." + (inn.total_balls % 6);
    document.getElementById('maxOversDisplay').innerText = state.max_overs;
    
    if (inn.free_hit_active) {
        document.getElementById('liveBattingTeam').innerText += " [FREE HIT]";
    }
    
    if(inn.striker_id && inn.batsmen && inn.batsmen[inn.striker_id]) {
        const s = inn.batsmen[inn.striker_id];
        document.getElementById('rowStriker').innerHTML = `<span>* ${s.name}</span> <span>${s.runs}(${s.balls})</span>`;
    } else {
        document.getElementById('rowStriker').innerHTML = `<span class="captain-badge">[Vacant Crease Strike]</span> <span>-</span>`;
        // INTERCEPT TRIGGER: Guard against background layout polling overlaps using isolation flags
        if(window.isAdmin && state.status === 'live' && !currentBatsmanPromptActive) {
            promptNextPlayerReplacement('striker');
        }
    }

    if(inn.non_striker_id && inn.batsmen && inn.batsmen[inn.non_striker_id]) {
        const ns = inn.batsmen[inn.non_striker_id];
        document.getElementById('rowNonStriker').innerHTML = `<span>${ns.name}</span> <span>${ns.runs}(${ns.balls})</span>`;
    } else {
        document.getElementById('rowNonStriker').innerHTML = `<span class="captain-badge">[Vacant Crease Non-Strike]</span> <span>-</span>`;
        // INTERCEPT TRIGGER: Guard against background layout polling overlaps using isolation flags
        if(window.isAdmin && state.status === 'live' && !currentBatsmanPromptActive) {
            promptNextPlayerReplacement('non_striker');
        }
    }

    if(inn.current_bowler_id && inn.bowlers && inn.bowlers[inn.current_bowler_id]) {
        const b = inn.bowlers[inn.current_bowler_id];
        document.getElementById('rowBowler').innerHTML = `<span>${b.name}</span> <span>${b.overs_bowled}-${b.maidens}-${b.runs}-${b.wickets}</span>`;
    }

    const crr = (inn.total_runs / (inn.total_balls / 6 || 1)).toFixed(2);
    document.getElementById('crrVal').innerText = crr;
    
    if(parseInt(state.current_innings) === 2) {
        const target = state.innings.innings_1.total_runs + 1;
        const runsNeeded = target - inn.total_runs;
        const totalMaxBalls = state.max_overs * 6;
        const ballsRemaining = totalMaxBalls - inn.total_balls;
        const rrr = (runsNeeded / (ballsRemaining / 6 || 1)).toFixed(2);
        document.getElementById('rrrVal').innerText = `${rrr} (Need ${runsNeeded} off ${ballsRemaining} bls)`;
        
        if(inn.total_runs >= target && state.status === 'live' && window.isAdmin) {
            triggerMatchCompletionPopup();
        } else if((inn.wickets >= 10 || ballsRemaining <= 0) && state.status === 'live' && window.isAdmin) {
            triggerMatchCompletionPopup();
        } else if (state.status === 'completed') {
            triggerMatchCompletionPopup();
        }
    } else {
        const totalMaxBalls = state.max_overs * 6;
        const ballsRemaining = totalMaxBalls - inn.total_balls;
        if((inn.wickets >= 10 || ballsRemaining <= 0) && state.status === 'live' && window.isAdmin) {
            triggerInningsBreakPopup();
        }
    }

    if(window.isAdmin && inn.total_balls > 0 && inn.total_balls % 6 === 0 && state.status === 'live') {
        const expectedOvers = inn.total_balls / 6;
        if(inn.bowlers && inn.bowlers[inn.current_bowler_id] && inn.bowlers[inn.current_bowler_id].balls == expectedOvers * 6) {
             if (!currentOverBowlerPromptActive) {
                 promptNextBowlerAssignment();
             }
        }
    }
}

function submitBallRecord(type, runs, extraType=null, dismissal=null, fielderId=null, runOutBatsmanId=null, bowlerId=null, bowlerName=null, batsmanId=null, batsmanName=null, positionKey=null) {
    const payload = { 
        event_type: type, 
        runs_scored: runs, 
        extra_type: extraType, 
        dismissal: dismissal, 
        fielder_id: fielderId,
        run_out_batsman_id: runOutBatsmanId,
        bowler_id: bowlerId,
        bowler_name: bowlerName,
        batsman_id: batsmanId,
        batsman_name: batsmanName,
        position_key: positionKey
    };
    secureApiFetch(`/api/match/update/${window.matchCode}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(data => {
        updateLiveScoreboardUI(data.state);
    }).catch(() => {});
}

function submitUndoTransactionRequest() {
    if(confirm("Are you sure you want to completely erase the last recorded delivery event?")) {
        submitBallRecord('UNDO', 0);
    }
}

function triggerExtraPlusPopup() { document.getElementById('extraPlusModal').style.display = 'flex'; }
function commitExtraPlusAdjustment() {
    const type = document.getElementById('extType').value;
    const runs = parseInt(document.getElementById('extRuns').value || 0);
    document.getElementById('extraPlusModal').style.display = 'none';
    submitBallRecord('EXTRA', runs, type);
}

function triggerWicketDismissal(type) {
    if(confirm(`Confirm operational dismissal: ${type}?`)) {
        submitBallRecord('WICKET', 0, null, type);
    }
}

function triggerRunOutModal() {
    secureApiFetch('/api/players', { method: 'GET' }).then(players => {
        const sel = document.getElementById('roFielder');
        if (!sel) return;
        let optionsHtml = '';
        Object.values(players).forEach(p => { 
            optionsHtml += `<option value="${p.id}">${p.name}</option>`; 
        });
        sel.innerHTML = optionsHtml;
        document.getElementById('runOutModal').style.display = 'flex';
    }).catch(() => {});
}

function commitRunOutDismissal() {
    const targetKey = document.getElementById('roTargetBatsman').value;
    const fId = document.getElementById('roFielder').value;
    const inn = liveStateMemory.innings[`innings_${liveStateMemory.current_innings}`];
    const runOutBatsmanId = (targetKey === 'striker') ? inn.striker_id : inn.non_striker_id;
    
    document.getElementById('runOutModal').style.display = 'none';
    submitBallRecord('WICKET', 0, null, 'Run Out', fId, runOutBatsmanId);
}

function promptNextPlayerReplacement(keyPosition) {
    currentBatsmanPromptActive = true;
    trackingReplacementKey = keyPosition;
    
    secureApiFetch('/api/teams', { method: 'GET' }).then(teams => {
        secureApiFetch('/api/players', { method: 'GET' }).then(players => {
            const sel = document.getElementById('nextBatsmanSelect');
            if (!sel) return;
            
            const inn = liveStateMemory.innings[`innings_${liveStateMemory.current_innings}`];
            const targetTeamObject = Object.values(teams).find(t => t.name === inn.batting_team);
            
            let optionsHtml = '';
            if (targetTeamObject && targetTeamObject.players) {
                targetTeamObject.players.forEach(pid => {
                    const p = players[pid];
                    if (p && (!inn.batsmen || !inn.batsmen[pid] || inn.batsmen[pid].out_status === 'not out')) {
                        if (pid !== inn.striker_id && pid !== inn.non_striker_id) {
                            optionsHtml += `<option value="${pid}">${p.name}</option>`;
                        }
                    }
                });
            }
            sel.innerHTML = optionsHtml;
            document.getElementById('newBatsmanModal').style.display = 'flex';
        });
    }).catch(() => {});
}

function commitNewBatsman() {
    const sel = document.getElementById('nextBatsmanSelect');
    const pid = sel.value;
    if(!pid) return;
    const name = sel.options[sel.selectedIndex].text;
    
    document.getElementById('newBatsmanModal').style.display = 'none';
    currentBatsmanPromptActive = false; // Lift protection block trigger securely
    
    submitBallRecord('BATSMAN_CHANGE', 0, null, null, null, null, null, null, pid, name, trackingReplacementKey);
}

function promptNextBowlerAssignment() {
    currentOverBowlerPromptActive = true;
    
    secureApiFetch('/api/teams', { method: 'GET' }).then(teams => {
        secureApiFetch('/api/players', { method: 'GET' }).then(players => {
            const sel = document.getElementById('nextBowlerSelect');
            if (!sel) return;
            
            const inn = liveStateMemory.innings[`innings_${liveStateMemory.current_innings}`];
            const targetTeamObject = Object.values(teams).find(t => t.name === inn.bowling_team);
            const activeOldBowlerId = inn.current_bowler_id;
            
            let optionsHtml = '';
            if (targetTeamObject && targetTeamObject.players) {
                targetTeamObject.players.forEach(pid => {
                    const p = players[pid];
                    if (p && pid !== activeOldBowlerId) {
                        optionsHtml += `<option value="${pid}">${p.name}</option>`;
                    }
                });
            }
            sel.innerHTML = optionsHtml;
            document.getElementById('newBowlerModal').style.display = 'flex';
        });
    }).catch(() => {});
}

function commitNewBowler() {
    const sel = document.getElementById('nextBowlerSelect');
    const pid = sel.value;
    if(!pid) return;
    const name = sel.options[sel.selectedIndex].text;
    
    document.getElementById('newBowlerModal').style.display = 'none';
    currentOverBowlerPromptActive = false;
    
    submitBallRecord('BOWLER_CHANGE', 0, null, null, null, null, pid, name);
}

function triggerInningsBreakPopup() {
    const inn = liveStateMemory.innings.innings_1;
    document.getElementById('innSumScore').innerText = `${inn.total_runs}/${inn.wickets}`;
    document.getElementById('innSumTopPerformers').innerHTML = `
        <strong>First Innings Concluded.</strong><br>
        Target operational threshold set to: <strong>${inn.total_runs + 1} runs</strong>.
    `;
    const btn = document.getElementById('innSumActionBtn');
    btn.innerText = "START SECOND INNINGS";
    btn.onclick = launchSecondInningsCreaseSetup;
    document.getElementById('inningsSummaryModal').style.display = 'flex';
}

function launchSecondInningsCreaseSetup() {
    document.getElementById('inningsSummaryModal').style.display = 'none';
    
    secureApiFetch('/api/teams', { method: 'GET' }).then(teams => {
        secureApiFetch('/api/players', { method: 'GET' }).then(players => {
            const inn1 = liveStateMemory.innings.innings_1;
            
            const nextBattingTeamName = inn1.bowling_team;
            const nextBowlingTeamName = inn1.batting_team;
            
            const batTeamObj = Object.values(teams).find(t => t.name === nextBattingTeamName);
            const bowlTeamObj = Object.values(teams).find(t => t.name === nextBowlingTeamName);
            
            if(!batTeamObj || !bowlTeamObj || batTeamObj.players.length < 2 || bowlTeamObj.players.length < 1) {
                return triggerGlobalNotificationBanner("Insufficient setup profiles to initialize crease tracking.", true);
            }
            
            let autodetectedKeeperId = bowlTeamObj.players[0];
            bowlTeamObj.players.forEach(pid => {
                const p = players[pid];
                if(p && p.role === "Wicketkeeper") {
                    autodetectedKeeperId = pid;
                }
            });

            const bId = bowlTeamObj.players[0];
            const bName = players[bId] ? players[bId].name : "Bowler";
            
            const sId = batTeamObj.players[0];
            const sName = players[sId] ? players[sId].name : "Striker";
            
            const nsId = batTeamObj.players[1];
            const nsName = players[nsId] ? players[nsId].name : "Non-Striker";

            secureApiFetch(`/api/match/next-innings/${window.matchCode}`, {
                 method: 'POST',
                 body: JSON.stringify({
                     striker_id: sId, 
                     striker_name: sName,
                     non_striker_id: nsId,
                     non_striker_name: nsName,
                     bowler_id: bId,
                     bowler_name: bName,
                     wicketkeeper_id: autodetectedKeeperId
                 })
            }).then(() => location.reload());
        });
    }).catch(() => {});
}

function triggerMatchCompletionPopup() {
    if (liveStateMemory && liveStateMemory.status === 'completed') {
        document.getElementById('innSumScore').innerText = "MATCH COMPLETED";
        document.getElementById('innSumTopPerformers').innerHTML = `<strong>WINNER: ${liveStateMemory.winner.toUpperCase()}</strong>`;
        const btn = document.getElementById('innSumActionBtn');
        btn.innerText = "VIEW DETAILED SCORECARD";
        btn.onclick = () => { window.location.href = `/detailed-score/${window.matchCode}`; };
        document.getElementById('inningsSummaryModal').style.display = 'flex';
        return;
    }

    secureApiFetch(`/api/match/complete/${window.matchCode}`, { method: 'POST' })
    .then(data => {
        document.getElementById('innSumScore').innerText = "MATCH COMPLETED";
        document.getElementById('innSumTopPerformers').innerHTML = `<strong>WINNER: ${data.winner.toUpperCase()}</strong>`;
        const btn = document.getElementById('innSumActionBtn');
        btn.innerText = "VIEW DETAILED SCORECARD";
        btn.onclick = () => { window.location.href = `/detailed-score/${window.matchCode}`; };
        document.getElementById('inningsSummaryModal').style.display = 'flex';
    }).catch(() => {});
}

function renderDetailedStatisticsView(matchCode) {
    const area = document.getElementById('detailedOutputArea');
    if (!area) return;

    fetch(`/api/match/live/${matchCode}`)
    .then(res => res.json())
    .then(state => {
        if (!state || !state.innings) return;
        
        const banner = document.getElementById('matchWinnerBanner');
        if (state.status === 'completed' && banner) {
            banner.innerText = `WINNER: ${state.winner.toUpperCase()}`;
            banner.style.display = 'block';
        }

        let htmlContent = '';
        Object.entries(state.innings).forEach(([key, inn]) => {
            if (!inn) return;
            const titleLabel = key.replace('_', ' ').toUpperCase();
            
            htmlContent += `
            <div class="bento-card full-width">
                <span class="card-label">${titleLabel} - ${inn.batting_team.toUpperCase()}</span>
                <h3>${inn.total_runs} / ${inn.wickets} <span class="pool-player-meta">(${Math.floor(inn.total_balls / 6)}.${inn.total_balls % 6} Overs)</span></h3>
                <span class="card-sub-label">Batting Performance Matrix</span>
                <table>
                    <thead>
                        <tr>
                            <th class="text-left">Batsman</th>
                            <th>R</th>
                            <th>B</th>
                            <th>4s</th>
                            <th>6s</th>
                            <th class="text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            if (inn.batsmen) {
                Object.values(inn.batsmen).forEach(b => {
                    if (!b.name) return;
                    htmlContent += `
                            <tr>
                                <td><strong>${b.name}</strong></td>
                                <td class="text-center">${b.runs}</td>
                                <td class="text-center">${b.balls}</td>
                                <td class="text-center">${b.fours}</td>
                                <td class="text-center">${b.sixes}</td>
                                <td class="text-right pool-player-meta">${b.out_status ? b.out_status.toUpperCase() : 'NOT OUT'}</td>
                            </tr>`;
                });
            }

            htmlContent += `
                    </tbody>
                </table>
                <span class="card-sub-label">Bowling Efficiency Matrix</span>
                <table>
                    <thead>
                        <tr>
                            <th class="text-left">Bowler</th>
                            <th>O</th>
                            <th>M</th>
                            <th>R</th>
                            <th>W</th>
                        </tr>
                    </thead>
                    <tbody>`;

            if (inn.bowlers) {
                Object.values(inn.bowlers).forEach(b => {
                    if (!b.name) return;
                    htmlContent += `
                            <tr>
                                <td><strong>${b.name}</strong></td>
                                <td class="text-center">${b.overs_bowled}</td>
                                <td class="text-center">${b.maidens}</td>
                                <td class="text-center">${b.runs}</td>
                                <td class="text-center">${b.wickets}</td>
                            </tr>`;
                });
            }

            htmlContent += `
                    </tbody>
                </table>
                <div class="pool-player-meta">
                    <strong>Extras:</strong> WD: ${inn.extras.wd}, NB: ${inn.extras.nb}, B: ${inn.extras.b}, LB: ${inn.extras.lb} | Total: ${inn.extras.total}
                </div>
            </div>`;
        });
        area.innerHTML = htmlContent;
    }).catch(() => {
        area.innerHTML = `<div class="empty-state-text">Failed to retrieve comprehensive match metrics.</div>`;
    });
}