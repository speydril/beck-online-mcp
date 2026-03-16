#!/usr/bin/env node
/**
 * Standalone login script — opens a browser for you to log in manually.
 * Once you're on the beck-online homepage, cookies are saved automatically.
 *
 * Usage: npx tsx src/login-cli.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-chromium';
import { config } from './config.js';
import type { CookieData } from './shared/types.js';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const page = await context.newPage();

console.log('Opening beck-online login page — please log in manually.');
await page.goto(`${config.baseUrl}/Konto/IdentityProviderLogin`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

// Wait until we land on a beck-online page that isn't login/error
console.log('Waiting for successful login...');
await page.waitForURL(
  (url) =>
    url.hostname.includes('beck-online.beck.de') &&
    !url.pathname.includes('/Login') &&
    !url.pathname.includes('/Konto/IdentityProviderLogin'),
  { timeout: 300000 } // 5 minutes to log in
);

console.log('Login detected! Saving cookies...');

const allCookies = await context.cookies();
const beckCookies: CookieData[] = allCookies
  .filter((c) => c.domain.includes('beck'))
  .map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
  }));

const dir = path.dirname(config.cookiePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(config.cookiePath, JSON.stringify(beckCookies, null, 2));

console.log(`Cookies saved to ${config.cookiePath}`);
await browser.close();
