# MCP Agent

A small TypeScript service built with `@inngest/agent-kit` that runs a content-creation agent over MCP.

## What it does

- Starts a local server from `src/index.ts`
- Configures an OpenAI-backed agent for content creation
- Connects to a Neon MCP server through Smithery
- Uses a `done` tool to mark completion and store run metadata

## Prerequisites

- Node.js 18+ recommended
- An OpenAI API key
- A Smithery API key
- Optional: a custom Smithery server URL

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp src/.env.example src/.env
   ```

3. Fill in `src/.env` with your values:

   ```env
   OPENAI_API_KEY=your_openai_key
   SMITHERY_API_KEY=your_smithery_key
   SMITHERY_SERVER_URL=https://server.smithery.ai/neon/mcp
   MAX_ROUTER_ATTEMPTS=3
   PORT=3010
   ```

## Run

Start the app with:

```bash
npm start
```

The server listens on `PORT` and defaults to `3010`.

## Project structure

```text
package.json
src/
  index.ts
  .env.example
```

## Notes

- `src/.env` is intentionally ignored by Git.
- The app exits early if `OPENAI_API_KEY` or `SMITHERY_API_KEY` is missing.
- The current default model in `src/index.ts` is `gpt-4o-mini`.
