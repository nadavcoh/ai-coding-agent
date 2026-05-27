# AI Coding Agent

A production-ready AI coding agent built with **Next.js 14**, **Google Gemini**, and **GitHub** integration. The agent can explore repositories, read code, and propose changes — with a mandatory human-in-the-loop approval gate before any code is committed.

## Features

- 🤖 **Gemini-powered** — uses `gemini-2.5-flash` for intelligent code analysis
- 🐙 **GitHub integration** — reads repo structure, file contents, and proposes commits via Octokit REST API (no git CLI)
- 🔒 **Human-in-the-loop** — all code pushes require explicit approval via a diff viewer
- 🛡️ **Basic Auth** — entire app protected with HTTP Basic Auth via Next.js middleware
- ⚡ **Streaming** — real-time AI responses with Vercel AI SDK
- 🎨 **Dark UI** — clean developer-focused interface

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | TailwindCSS + shadcn/ui |
| AI | Vercel AI SDK + `@ai-sdk/google` |
| GitHub | `@octokit/rest` |
| Validation | Zod |
| Deployment | Vercel |

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo>
cd ai-coding-agent
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key        # From Google AI Studio
GITHUB_TOKEN=your_github_pat             # Fine-grained PAT (Contents read/write)
BASIC_AUTH_USER=admin                     # Optional but recommended
BASIC_AUTH_PASSWORD=your_strong_password
```

**GitHub Token Scopes** (Fine-grained PAT):
- Repository permissions → `Contents`: Read and write
- Repository permissions → `Metadata`: Read

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be prompted for Basic Auth credentials.

## Deploying to Vercel

```bash
npx vercel deploy
```

Add the environment variables in your Vercel project settings under **Settings → Environment Variables**.

## How It Works

### Security Architecture

```
Browser Request
    │
    ▼
middleware.ts ──── Basic Auth check ──── 401 if invalid
    │
    ▼
Next.js Route Handler
    │ (GEMINI_API_KEY, GITHUB_TOKEN — server-side only)
    ▼
Vercel AI SDK → Gemini API
    │
    ├── read_repository_structure → Octokit.git.getTree
    ├── read_file_contents → Octokit.repos.getContent  
    └── propose_github_push → Returns to client (no auto-commit)
                                    │
                                    ▼
                           Human reviews diff
                                    │
                           Approve/Reject
                                    │
                           POST /api/github/push
                                    │
                           Octokit.repos.createOrUpdateFileContents
```

### Human-in-the-Loop

When the AI decides to propose a code change, it uses the `propose_github_push` tool. This **does not automatically commit** — instead:

1. The frontend intercepts the tool call
2. A **diff viewer** renders showing original vs. proposed code
3. The user clicks **"Approve & Commit to GitHub"** or **"Reject"**
4. Only on approval does the server actually call `createOrUpdateFileContents`

### Serverless GitHub Operations

All GitHub operations use the REST API via Octokit — no `git clone`, no shell commands, no local filesystem. This is required for Vercel's stateless serverless environment.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # AI streaming endpoint + tools
│   │   └── github/
│   │       ├── push/route.ts      # Secure commit endpoint
│   │       └── repos/route.ts     # List accessible repos
│   ├── layout.tsx
│   └── page.tsx                   # Dashboard page
├── components/
│   ├── chat-interface.tsx         # Main chat UI + state management
│   ├── diff-viewer.tsx            # Code diff + approve/reject
│   ├── message-renderer.tsx       # Markdown renderer
│   ├── sidebar.tsx                # Repository browser
│   ├── tool-result-card.tsx       # Tool execution status
│   ├── code-block.tsx             # Syntax-highlighted code
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── github.ts                  # Octokit utilities (server-only)
│   ├── tools.ts                   # Zod schemas for AI tools
│   └── utils.ts                   # Shared utilities
├── middleware.ts                  # Basic Auth guard
└── vercel.json                    # Function timeout config
```

## License

MIT
