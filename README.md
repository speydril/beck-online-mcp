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
git clone https://github.com/speydril/beck-online-mcp.git
cd beck-online-mcp
npm install
npx playwright install chromium
npm run build
```

### 2. First login

On first use, run with `BECK_HEADLESS=false` so you can see the browser and complete 2FA:

```bash
BECK_USERNAME=your-user BECK_PASSWORD=your-pass BECK_HEADLESS=false npm run dev
```

The server will:
1. Open a Chromium browser
2. Navigate to beck-online's OAuth login (account.beck.de)
3. Fill your credentials automatically
4. Prompt you in the terminal for your 2FA code (from your authenticator app)
5. Save session cookies to `~/.beck-online-mcp/cookies.json`
6. Close the browser

After that, all requests use fast HTTP with the saved cookies. The browser only re-opens when the session expires.

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

## Troubleshooting

**"Session expired" on every request**
Your cookies have expired. Delete `~/.beck-online-mcp/cookies.json` and run with `BECK_HEADLESS=false` to re-authenticate.

**"Access denied" for a document**
The document is not included in your beck-online subscription. Search results may include documents from modules you don't have access to.

**"Cloudflare Turnstile" message**
Some document pages require a Turnstile challenge that can't be solved via HTTP. The TOC (`beck_get_toc`) is usually still accessible. Try accessing the document directly in your browser.

**Browser doesn't open during login**
Make sure Chromium is installed: `npx playwright install chromium`

**2FA code prompt doesn't appear**
The 2FA prompt is sent to stderr. If using Claude Desktop, set `BECK_HEADLESS=false` and run manually first to complete the initial login, then switch back to headless for Claude Desktop.

## License

MIT
