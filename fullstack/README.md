# Hello World — MindStudio App

A minimal starter app that generates creative AI greetings. Demonstrates the core MindStudio app lifecycle: spec, method, table, and web interface.

## What it does

Enter a name, get a unique AI-generated greeting. Greetings stream in real-time and are saved to a database.

## Structure

```
mindstudio.json              ← manifest
src/
  app.md                     ← spec (what the app does)
  interfaces/
    @brand/visual.md         ← design tokens (colors, typography, spacing)
    @brand/voice.md          ← tone and terminology
    web.md                   ← web interface spec
dist/
  methods/
    src/
      helloWorld.ts          ← backend method (AI greeting + db write)
      tables/default.ts      ← greetings table definition
    package.json
  interfaces/
    web/                     ← React frontend (Vite + styled-components)
```

## Stack

- **Backend:** TypeScript method using `@mindstudio-ai/agent` for AI text generation and database access
- **Frontend:** React + Vite + styled-components + framer-motion
- **Database:** SQLite (managed by the platform, defined as TypeScript interfaces)
- **AI:** MindStudio SDK — no API keys to configure

## Developing

Edit files in `dist/` — changes take effect immediately. The platform transpiles methods per-request and the frontend uses Vite HMR.

## Deploying

```bash
git push origin main
```

The platform builds and deploys automatically.
