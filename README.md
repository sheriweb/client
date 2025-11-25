# React Frontend (Vite + Tailwind)

Simple React app for importing/searching websites and scraping details from a FastAPI backend.

## Requirements
- Node.js 18+
- npm (or pnpm/yarn)

## Setup (local)
1) Install deps
```
npm install
```

2) Configure API base URL
- Create `.env` (or `.env.local`) and set:
```
VITE_API_BASE=http://localhost:8010
```

3) Run dev server
```
npm run dev
```
Open http://localhost:5173

## Build
```
npm run build
npm run preview  # optional local preview
```

## Environment
- `VITE_API_BASE` — Backend API base (e.g. https://your-api.onrender.com)

## Deployment (Netlify)
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: set `VITE_API_BASE`

## Features
- Import CSV/XLSX with flexible header detection
- Google Maps listings import (with aggressive mode)
- Enrich per row and “Get details (all)” with concurrency
- Results pagination and CSV export
- Clear results
