import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { loginWithBrowser } from './login.js';
import { BeckSessionExpiredError } from '../shared/errors.js';
import type { CookieData } from '../shared/types.js';

export class Session {
  private cookies: CookieData[] = [];
  private cookieHeader = '';

  async ensureAuthenticated(): Promise<void> {
    if (this.cookieHeader) return;

    // Try loading saved cookies
    if (fs.existsSync(config.cookiePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(config.cookiePath, 'utf-8')) as CookieData[];
        if (this.areCookiesValid(data)) {
          this.setCookies(data);
          console.error('[beck-mcp] Loaded saved session cookies.');
          return;
        }
        console.error('[beck-mcp] Saved cookies expired, re-authenticating...');
      } catch {
        console.error('[beck-mcp] Failed to load saved cookies, re-authenticating...');
      }
    }

    throw new BeckSessionExpiredError(
      'No valid session found. Please run "npm run login" in the beck-mcp project directory to authenticate, then retry.'
    );
  }

  async login(): Promise<void> {
    const cookies = await loginWithBrowser();
    this.setCookies(cookies);
    this.saveCookies(cookies);
  }

  getCookieHeader(): string {
    return this.cookieHeader;
  }

  isSessionExpiredResponse(status: number, url: string, body?: string): boolean {
    if (status === 302) return true;
    if (url.includes('/Login') || url.includes('/Error/103')) return true;
    if (body?.includes('Aus Sicherheitsgründen wurde Ihnen der weitere Zugriff')) return true;
    return false;
  }

  async handleSessionExpired(): Promise<void> {
    console.error('[beck-mcp] Session expired. Please run "npm run login" in the beck-mcp directory to re-authenticate.');
    this.cookies = [];
    this.cookieHeader = '';
    throw new BeckSessionExpiredError(
      'Session expired. Please run "npm run login" in the beck-mcp project directory to re-authenticate, then retry.'
    );
  }

  private setCookies(cookies: CookieData[]) {
    this.cookies = cookies;
    // Build cookie header for beck-online.beck.de requests
    this.cookieHeader = cookies
      .filter((c) => c.domain.includes('beck-online.beck.de') || c.domain === '.beck.de')
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  private areCookiesValid(cookies: CookieData[]): boolean {
    const authCookie = cookies.find((c) => c.name === 'beck-online.auth');
    if (!authCookie) return false;

    // Session cookies (expires = -1 or 0) are valid as long as they exist
    // Time-limited cookies: check expiry
    const now = Date.now() / 1000;
    for (const c of cookies) {
      if (c.expires > 0 && c.expires < now) {
        return false;
      }
    }
    return true;
  }

  private saveCookies(cookies: CookieData[]) {
    const dir = path.dirname(config.cookiePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(config.cookiePath, JSON.stringify(cookies, null, 2));
    console.error(`[beck-mcp] Cookies saved to ${config.cookiePath}`);
  }
}
