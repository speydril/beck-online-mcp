import path from 'node:path';
import os from 'node:os';

export const config = {
  username: process.env.BECK_USERNAME ?? '',
  password: process.env.BECK_PASSWORD ?? '',
  headless: process.env.BECK_HEADLESS !== 'false',
  rateLimitMs: parseInt(process.env.BECK_RATE_LIMIT_MS || '2000', 10),
  cookiePath: path.join(os.homedir(), '.beck-online-mcp', 'cookies.json'),
  baseUrl: 'https://beck-online.beck.de',
  accountUrl: 'https://account.beck.de',
} as const;

export function validateConfig() {
  if (!config.username || !config.password) {
    console.error('Error: BECK_USERNAME and BECK_PASSWORD environment variables are required.');
    console.error('Set them in your MCP client config or export them in your shell.');
    process.exit(1);
  }
}
