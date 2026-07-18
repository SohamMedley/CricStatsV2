\# CricStats



\## Run Project



```bash

cd "DirectoryTo\\CricStats"

pip install -r backend/requirements.txt

python -m backend.app

```



\*\*Firebase Console:\*\* https://console.firebase.google.com/



\---



\# CricStats – Project Summary



\## 1. Project Overview



CricStats is a \*\*mobile-first cricket scoring web application\*\* built for local cricket matches. Two predefined admins can manage players, teams, live matches, and scoring, while spectators can view a \*\*real-time read-only scorecard\*\* using a unique match code.



\---



\## 2. Technology Stack



\- \*\*Frontend:\*\* HTML, CSS, JavaScript

\- \*\*Backend:\*\* Python

\- \*\*Database:\*\* Firebase

\- \*\*Platform:\*\* Mobile-first web application (not desktop-focused)



\---



\## 3. UI \& Theme



\- Japanese-inspired minimal UI

\- Bento Grid layout

\- Primary Color: Beige

\- Secondary Colors: Red \& Black

\- Optimized for mobile devices only



\---



\## 4. Authentication



\- No user registration

\- Only two predefined admin accounts



| Admin | Password |

|-------|----------|

| Admin1 | Delta247 |

| Admin2 | Gamma247 |



\### Features



\- Hidden cricket-ball icon on `index.html` opens the admin login page.

\- Cricket-ball icon must be built using \*\*HTML/CSS only\*\* (no SVG or image).



\---



\## 5. Folder Structure



```

CricStats/

│

├── frontend/

│   ├── templates/

│   │   ├── index.html

│   │   ├── login.html

│   │   ├── home.html

│   │   ├── player.html

│   │   ├── team.html

│   │   ├── match.html

│   │   ├── scorecard.html

│   │   └── detailed\_score.html

│   │

│   ├── css/

│   │   └── style.css

│   │

│   └── js/

│       └── script.js

│

├── backend/

│   ├── app.py

│   ├── firebase\_config.py

│   ├── routes.py

│   ├── auth.py

│   ├── match\_logic.py

│   ├── score\_engine.py

│   ├── utils.py

│   ├── requirements.txt

│   └── config.py

│

├── README.md

└── .gitignore

```



\---



\## 6. Website Flow



```

index.html

&#x20;   │

&#x20;   ├── View Match

&#x20;   │      │

&#x20;   │      ▼

&#x20;   │  Live Read-only Scorecard

&#x20;   │

&#x20;   ▼

(Hidden Cricket Ball)

&#x20;   │

&#x20;   ▼

login.html

&#x20;   │

&#x20;   ▼

home.html

&#x20;├── Player Profiles

&#x20;├── Create Teams

&#x20;└── Create Match

```



\---



\# 7. Pages \& Features



\## index.html



\- CricStats logo/typography

\- Match code input

\- "View Match" button

\- Hidden cricket-ball admin button



\---



\## login.html



\- Admin selector (Admin1/Admin2)

\- Password input

\- Login button



\---



\## home.html



Japanese Bento Dashboard



\- Create Player Profile

\- Create Team

\- Create Match



\---



\## player.html



\### Player Management



Displays:



\- Existing players list

\- Center "+" button when no players exist

\- Bottom-right "+" button after players are created



\### Player Details



\- Player Name

\- Role

&#x20; - Batsman

&#x20; - Bowler

&#x20; - All-rounder

&#x20; - Wicketkeeper

\- Batting Hand

&#x20; - Right-handed

&#x20; - Left-handed

\- Save Player



\*\*Maximum Players:\*\* \~35



\---



\## team.html



\### Team Creation



Two vertical panels:



\- Team A

\- Team B



\### Features



\- Rename team

\- Select captain first

\- Search player

\- A–Z sorted player list

\- Add remaining players

\- Save Team

\- Create More Teams



\---



\## match.html



\### Match Setup



Select:



\- Team A

\- Team B



Then configure:



\- Toss winner

\- Bat/Bowl decision

\- Opening Batsman 1

\- Opening Batsman 2

\- Opening Bowler

\- Wicketkeeper



\### Overs Dropdown



\- 1

\- 2

\- 4

\- 5

\- 6

\- 7



\- Start Match button



\---



\## scorecard.html



\### Top Section



\- Match Code

\- Copy Button



\### Live Match Information



\- Batting Team

\- Score

\- Overs

\- Current Batsmen

\- Current Bowler

\- Run Rate (Auto)

\- Required Calculations (Auto)



\### Wicket Buttons



\- Catch Out

\- Run Out

\- Bowled

\- Stumped



\### Run Out Popup



\- Select Fielder

\- Update Dismissal



\### Run Buttons



\- 1

\- 2

\- 3

\- 4

\- 5

\- 6



\### Extras



\- NB

\- WD

\- B

\- LB



Additional "+" button allows adding runs after an extra.



Examples:



\- NB + 6

\- WD + 2



\### Automatic Live Updates



Python backend automatically updates:



\- Runs

\- Wickets

\- Overs

\- Strike rotation

\- Bowler figures

\- Run Rate



Live score refreshes every \*\*3–5 seconds\*\*.



\---



\## 8. First Innings Summary



After the first innings, display a popup containing:



\- Team Score

\- Wickets

\- Overs

\- Top 2 Batsmen

\- Best Bowler

\- Start Second Innings button



\---



\## 9. Second Innings



Repeat setup:



\- Select opening batsmen

\- Select bowler

\- Select wicketkeeper



Continue live scoring.



\---



\## 10. Match Result



After the second innings:



Popup displays:



\- First Innings Summary

\- Second Innings Summary

\- Winning Team

\- View Full Score button



\---



\## 11. detailed\_score.html



\### Complete Scorecard



\#### Batting



\- Runs

\- Balls

\- 4s

\- 6s

\- Strike Rate

\- Dismissal



\#### Bowling



\- Overs

\- Maidens (Optional)

\- Runs

\- Wickets

\- Economy



\#### Fielding



\- Run Outs

\- Stumpings

\- Catches



\#### Match Result



\- Winner



\---



\## 12. Spectator Mode



Workflow:



```

Audience

&#x20;    │

Enter Match Code

&#x20;    │

&#x20;    ▼

Read-only Live Scorecard

```



\- Spectators cannot edit anything.

\- Admins update scores.

\- Viewers receive live updates automatically.



\---



\## 13. Firebase Database



Store:



\- Admins

\- Players

\- Teams

\- Matches

\- Match Codes

\- Live Scores

\- Batting Statistics

\- Bowling Statistics

\- Fielding Statistics

\- Match Results



\---



\## 14. Core Functionalities



\- Mobile-first responsive design

\- Japanese-inspired Bento UI

\- Hidden admin login

\- Two fixed admin accounts

\- Player profile management

\- Team management

\- Match creation

\- Live scoring

\- Automatic score calculations

\- First \& second innings summaries

\- Detailed scorecard

\- Unique shareable match code

\- Read-only spectator mode

\- Firebase cloud database

\- Python backend scoring engine



