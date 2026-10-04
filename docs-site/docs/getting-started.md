---
sidebar_position: 2
title: Getting started
---

# Getting started

## Requirements

- Node.js 20 or later
- Optional: an OpenAI-compatible local LLM server (for example Ollama or llama.cpp) for AI-assisted contract extraction

## Run the app

```bash
npm install
npm run dev          # http://localhost:5555
```

The first request creates `data/solvent.db` and migrates it. Each account (tenant) is its own SQLite file under `data/`. The `data/` folder is git-ignored.

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on port 5555 |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit and golden tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright) |
| `npm run typecheck` | TypeScript checks |

## First steps

1. Open **Income and balances** and add your bank accounts with their current balances and minimum reserves.
2. Add your recurring **income** (salary, rent received, and so on).
3. Open **Loans and expenses** and add your loans and recurring expenses. You can also start a loan from a contract PDF.
4. Go back to the **Dashboard** to see your effort rate and liquidity projection.
5. Use **New Analysis** (in the sidebar) to create a what-if scenario in **Simulation**.

The dashboard's **Suggestions** wizards walk you through the same steps.

## This documentation site

```bash
cd docs-site
npm install
npm start                                   # http://localhost:3000
node scripts/capture-screenshots.mjs        # refresh screenshots (app must be running)
```
