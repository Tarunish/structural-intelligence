# Team Setup Guide — Autonomous Structural Intelligence System

## Folder Structure

```
structural-intelligence/
├── backend/
│   ├── main.py                     ← FastAPI server (run this)
│   ├── requirements.txt            ← Python dependencies
│   ├── parser/
│   │   └── floor_plan_parser.py    ← Stage 1+2: OpenCV wall detection
│   └── materials/
│       └── material_engine.py      ← Stage 4+5: Material analysis + Claude API
├── frontend/
│   ├── index.html                  ← Open this in browser (no build needed)
│   └── src/
│       └── stellar-integration.js  ← Stellar Web3 bonus
├── contracts/
│   └── hello-world/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs              ← Soroban smart contract (Rust)
├── architecture.html               ← Architecture diagram
├── README.md
├── .env.example                    ← Copy to .env and fill API key
└── SETUP.md                        ← This file
```

---

## Member 1 — 3D Frontend (index.html + Three.js)

### Your job:
- Wire `index.html` to call the backend API
- Render walls in 3D using Three.js
- Show the material report and Claude explanation in the UI

### Steps:
```bash
# 1. Just open the frontend — no install needed
cd structural-intelligence/frontend
# Open index.html in Chrome/Firefox directly

# 2. If backend is running, the upload button should work
# If not, click "USE SAMPLE (Plan B)" for offline demo
```

---

## Member 2 — Backend + CV Parser

### Your job:
- Get the backend running
- Test the parser on floor plan images
- Make sure the full pipeline API works

### Steps:
```bash
# 1. Go to backend folder
cd structural-intelligence/backend

# 2. Create virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your API key
cp ../.env.example ../.env
# Edit .env and add your ANTHROPIC_API_KEY

# 5. Run the backend server
export ANTHROPIC_API_KEY=your_key_here   # Mac/Linux
# OR on Windows:
set ANTHROPIC_API_KEY=your_key_here

uvicorn main:app --reload --port 8000

# 6. Test it (open in browser or run curl):
# http://localhost:8000/health
# http://localhost:8000/docs   ← Swagger UI to test all endpoints

# 7. Test the full pipeline with fallback data:
curl -X POST "http://localhost:8000/api/full-pipeline?use_fallback=true"
```

### To test with a real floor plan image:
```bash
python parser/floor_plan_parser.py --image path/to/plan.png --output parsed.json
python materials/material_engine.py --parsed parsed.json
```

---

## Member 3 — Web3 / Stellar Blockchain

### Your job:
- Deploy the Soroban smart contract to Stellar Testnet
- Update CONTRACT_ID in the frontend
- Get block explorer screenshot for README

### Steps:
```bash
# 1. Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. Install Stellar CLI
cargo install --locked stellar-cli --features opt

# 3. Create a testnet account
stellar keys generate --global myaccount --network testnet
stellar keys address myaccount   # copy this address

# 4. Fund it (free testnet XLM)
# Go to: https://friendbot.stellar.org/?addr=YOUR_ADDRESS

# 5. Build the contract
cd structural-intelligence/contracts/hello-world
stellar contract build

# 6. Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/structural_intelligence_contract.wasm \
  --network testnet \
  --source myaccount

# → Copy the CONTRACT_ID it prints

# 7. Update the frontend
# Open frontend/src/stellar-integration.js
# Find: CONTRACT_ID: "YOUR_CONTRACT_ID_HERE"
# Replace with your actual contract ID

# 8. Check your contract on block explorer:
# https://stellar.expert/explorer/testnet
# Search for your contract ID → take a screenshot for README
```

---

## Running Everything Together (Demo Day)

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate
export ANTHROPIC_API_KEY=your_key
uvicorn main:app --port 8000

# Terminal 2 — Frontend
# Just open frontend/index.html in browser
# Upload a floor plan image → see 3D model + analysis

# If CV parsing fails on a floor plan image:
# Click "USE SAMPLE" — this uses built-in fallback data
# DISCLOSE THIS to judges during demo — it's allowed and scored fairly
```

---

## Quick Checklist Before Demo

- [ ] Backend starts without errors on port 8000
- [ ] `/health` endpoint returns `{"status": "healthy", "api_key_set": true}`
- [ ] Upload Plan B image → 3D model renders in browser
- [ ] Material report shows in UI with Claude explanation
- [ ] Stellar contract deployed, CONTRACT_ID updated in stellar-integration.js
- [ ] Block explorer screenshot added to README
- [ ] README has all required sections (see hackathon requirements)
