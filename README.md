# Autonomous Structural Intelligence System

## Project Description

An AI-powered pipeline that reads a digital floor plan image, reconstructs it as a 3D structural model, recommends optimal construction materials, and explains every decision in plain language — all in one end-to-end system.

## Project Vision

Construction planning today requires expensive structural engineers for even basic decisions. Our system democratises this expertise — any architect, builder, or homeowner can upload a floor plan and instantly receive a 3D model, material recommendations, and structural concerns backed by AI reasoning.

## Key Features

- **Floor Plan Parsing** — OpenCV-based wall, room, and opening detection from image
- **3D Model Generation** — Real-time Three.js browser viewer with orbit/pan/zoom controls
- **Material Tradeoff Engine** — Weighted cost × strength × durability scoring per element type
- **LLM Explainability** — Plain-English structural analysis using Claude Sonnet API
- **Stellar Blockchain Audit** — Immutable on-chain record of every structural analysis
- **Fallback Mode** — Manual coordinates available if CV detection fails (disclosed to judges)

## Architecture

```
Floor Plan Image
      │
      ▼
┌─────────────────┐
│  Stage 1: Parse │  OpenCV → walls, rooms, openings
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 2: Geo   │  Classify load-bearing vs partition
│  Reconstruction │  Build node-edge graph
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 3: 3D    │  Three.js extrusion, viewable in browser
│  Generation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 4: Mat.  │  Cost-strength tradeoff scoring
│  Analysis       │  2-3 ranked options per element
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 5: LLM   │  Claude API → plain-English explanation
│  Explainability │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Web3 Bonus     │  Stellar Soroban smart contract
│  Blockchain     │  Stores analysis hash on-chain
└─────────────────┘
```

## Deployed Smart Contract Details

**Network:** Stellar Testnet  
**Contract ID:** `CCDNP7UJSSS77IQFWHHG6JOFRHM6IBTUZL5UGYXPV36F4KFMR76YNG3R`

### Block Explorer Screenshots

![Contract Deployment Transaction](screenshots/contract-deployment.png)
![Contract Explorer](screenshots/contract-explorer.png)

## UI Screenshots

![3D Model - Sample Plan B](screenshots/ui-demo.png)

## Project Setup Guide

### Backend

```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key_here
python -m uvicorn main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome.

If backend is not running, click **"USE SAMPLE (Plan B)"** — the frontend works fully offline with embedded demo data.

### Smart Contract Deployment

```bash
# Install Stellar CLI
cargo install --locked stellar-cli

# Build contract
cd contracts/hello-world
stellar contract build

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/structural_intelligence_contract.wasm \
  --network testnet \
  --source myaccount

# Update CONTRACT_ID in frontend/src/stellar-integration.js
```

### Running the Full Pipeline

```bash
# Parse a floor plan image
python backend/parser/floor_plan_parser.py --image your_plan.png --output parsed.json

# Run material analysis
python backend/materials/material_engine.py --parsed parsed.json

# Or use the API
curl -X POST http://localhost:8001/api/full-pipeline?use_fallback=true
```

## Future Scope

- Multi-storey support with inter-floor structural dependency analysis
- Real-time construction material price API integration (live market data)
- Structural validation rule engine (detect load path failures, missing columns)
- PDF cost breakdown report export
- Mobile camera input for real-time floor plan scanning
- BIM (Building Information Modeling) file export (IFC format)
- Layout optimisation engine for wall placement suggestions

## Tech Stack

- **Backend:** Python, FastAPI, OpenCV, Shapely
- **Frontend:** React, Vite, Three.js (@react-three/fiber), Framer Motion
- **AI/LLM:** Anthropic Claude Sonnet API
- **Blockchain:** Stellar Soroban (Rust smart contract), Stellar SDK (JS)
