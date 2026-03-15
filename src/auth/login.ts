import { chromium } from 'playwright-chromium';
import * as readline from 'node:readline';
import { config } from '../config.js';
import { BeckAuthError } from '../shared/errors.js';
import type { CookieData } from '../shared/types.js';

export async function loginWithBrowser(): Promise<CookieData[]> {
  console.error('[beck-mcp] Launching browser for authentication...');

  const browser = await chromium.launch({
    headless: config.headless,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Navigate to login entry point
    console.error('[beck-mcp] Navigating to login...');
    await page.goto(`${config.baseUrl}/Konto/IdentityProviderLogin`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(3000);

    const url = page.url();
    console.error(`[beck-mcp] At: ${url}`);

    // Already authenticated?
    if (url.includes('beck-online.beck.de') && !url.includes('Error/44') && !url.includes('Login')) {
      console.error('[beck-mcp] Already authenticated.');
      return extractCookies(context);
    }
    if (url.includes('Notification') || url.includes('Error/44')) {
      console.error('[beck-mcp] Device authorization page — logged in.');
      return extractCookies(context);
    }

    if (!url.includes('account.beck.de')) {
      throw new BeckAuthError(`Unexpected page during login: ${url}`);
    }

    // Dismiss cookie consent overlay
    await dismissCookieConsent(page);

    // Fill login form
    const usernameField = page.locator('input[name="Input.Username"]');
    await usernameField.waitFor({ state: 'visible', timeout: 10000 });

    console.error('[beck-mcp] Filling credentials...');
    await usernameField.fill(config.username);
    await page.locator('input[name="Input.Password"]').fill(config.password);
    await page.locator('[data-testid="submitButton"]').click();

    // Wait for response
    await page.waitForTimeout(3000);
    const afterLoginUrl = page.url();
    console.error(`[beck-mcp] After login: ${afterLoginUrl}`);

    // Handle 2FA if required
    if (afterLoginUrl.includes('TwoFactorAuthentication')) {
      console.error('[beck-mcp] 2FA required — prompting for code...');
      await dismissCookieConsent(page);

      const code = await promptForCode();
      const codeInput = page.locator('input[name="Input.Code"]');
      await codeInput.waitFor({ state: 'visible', timeout: 5000 });
      await codeInput.fill(code);
      await page.locator('[data-testid="submitButton"]').click();

      try {
        await page.waitForURL(/beck-online\.beck\.de/, { timeout: 30000 });
      } catch {
        const stuckUrl = page.url();
        if (stuckUrl.includes('TwoFactorAuthentication')) {
          throw new BeckAuthError('2FA code was invalid. Please try again.');
        }
      }
    } else if (afterLoginUrl.includes('account.beck.de') && !afterLoginUrl.includes('authorize')) {
      const errorText = await page.textContent('body').catch(() => '');
      if (errorText?.includes('ungültig') || errorText?.includes('Invalid')) {
        throw new BeckAuthError('Invalid username or password.');
      }
    }

    // Wait for final redirect to beck-online
    if (!page.url().includes('beck-online.beck.de')) {
      try {
        await page.waitForURL(/beck-online\.beck\.de/, { timeout: 15000 });
      } catch {
        // May already be there
      }
    }

    const finalUrl = page.url();
    console.error(`[beck-mcp] Final: ${finalUrl}`);

    if (finalUrl.includes('Error') && !finalUrl.includes('Notification') && !finalUrl.includes('Error/44')) {
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText?.includes('2-Faktor-Authentifizierung')) {
        throw new BeckAuthError('2FA must be set up at the Mein-Beck Portal first.');
      }
    }

    console.error('[beck-mcp] Login successful.');
    return extractCookies(context);
  } finally {
    await browser.close();
    console.error('[beck-mcp] Browser closed.');
  }
}

async function dismissCookieConsent(page: import('playwright-chromium').Page) {
  try {
    await page.waitForTimeout(1500);
    for (const text of ['Alle Cookies akzeptieren', 'Accept all cookies']) {
      const btn = page.locator(`button:has-text("${text}")`);
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
        return;
      }
    }
    // Force-remove overlay if buttons not found
    await page.evaluate(() => document.getElementById('usercentrics-root')?.remove());
  } catch {
    await page.evaluate(() => document.getElementById('usercentrics-root')?.remove()).catch(() => {});
  }
}

async function promptForCode(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question('[beck-mcp] Enter 2FA code from your authenticator app: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function extractCookies(context: import('playwright-chromium').BrowserContext): Promise<CookieData[]> {
  const allCookies = await context.cookies();
  return allCookies
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
}
