# beck-online MCP Server

An MCP (Model Context Protocol) server for [beck-online.beck.de](https://beck-online.beck.de) — Germany's leading legal database by C.H. Beck Verlag.

Allows AI assistants like Claude to search and retrieve legal documents (commentaries, articles, court decisions, laws) from beck-online using your subscription credentials.

## Features

- **`beck_search`** — Search across all beck-online content with filters by document type and legal area
- **`beck_get_document`** — Retrieve full document content as Markdown
- **`beck_get_toc`** — Get table of contents for commentaries and handbooks

## Prerequisites

- Node.js >= 20
- A beck-online subscription (university or professional)
- 2FA set up on your beck account

## Setup

### 1. Install

```bash
git clone https://github.com/YOUR_USERNAME/beck-online-mcp.git
cd beck-online-mcp
npm install
npx playwright install chromium
npm run build
```

### 2. First login

On first use, the server launches a browser for OAuth login + 2FA. You'll need to enter your 2FA code when prompted. After login, session cookies are saved to `~/.beck-online-mcp/cookies.json` and the browser closes. Subsequent requests use fast HTTP — no browser needed until the session expires.

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "beck-online": {
      "command": "node",
      "args": ["/path/to/beck-online-mcp/dist/index.js"],
      "env": {
        "BECK_USERNAME": "your-username",
        "BECK_PASSWORD": "your-password"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BECK_USERNAME` | Yes | | beck-online username |
| `BECK_PASSWORD` | Yes | | beck-online password |
| `BECK_HEADLESS` | No | `true` | Set to `false` to see the browser during login |
| `BECK_RATE_LIMIT_MS` | No | `2000` | Minimum ms between HTTP requests |

## Tools

### `beck_search`

Search beck-online. Returns a list of matching documents with vpaths for retrieval.

**Parameters:**
- `query` (required) — Search terms, e.g. "Mietvertrag Kündigung" or "§ 823 BGB"
- `documentType` — Filter: `all`, `ges` (laws), `buch` (commentaries), `aufs` (articles), `form` (forms), `lex` (lexica)
- `legalArea` — Filter: `ZivilR`, `HaWiR`, `ArbR`, `SozR`, `OeR`, `StrafR`, `EuropaR`, `SteuerR`
- `sort` — `relevance` (default) or `date`
- `page` — Page number for pagination

### `beck_get_document`

Retrieve a document by its vpath (from search results).

**Parameters:**
- `vpath` (required) — Document path, e.g. `bibdata/lex/cre_34/cont/cre.vertrag.htm`

### `beck_get_toc`

Get the table of contents for a commentary or handbook.

**Parameters:**
- `vpath` (required) — Path to the Inhaltsverzeichnis page

## Architecture

```
Login (one-time, Playwright)  →  Session cookies  →  Fast HTTP requests (fetch)
     OAuth + 2FA                   saved to disk         search, documents, TOC
```

- **Login**: Playwright opens a browser for the OAuth2/OIDC flow via `account.beck.de`, including 2FA. Cookies are extracted and saved.
- **All tool calls**: Plain HTTP `fetch()` with session cookies. Sub-second responses.
- **Session expiry**: Automatically detected (302 to login page). Re-launches browser for re-auth.

## Development

```bash
npm run dev          # Run with tsx (needs BECK_USERNAME/BECK_PASSWORD env vars)
npm run build        # Build with tsup
npm test             # Run tests
```

## License

MIT
