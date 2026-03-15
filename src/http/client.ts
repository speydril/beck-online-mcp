import { config } from '../config.js';
import { Session } from '../auth/session.js';
import { RateLimiter } from '../shared/rate-limiter.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class BeckHttpClient {
  private rateLimiter: RateLimiter;
  private retrying = false;

  constructor(private session: Session) {
    this.rateLimiter = new RateLimiter(config.rateLimitMs);
  }

  /**
   * Make a GET request to beck-online. Redirects are handled manually to preserve cookies.
   * Returns the first redirect location if it's a non-auth redirect (e.g., norm detection).
   */
  async get(urlPath: string): Promise<{ status: number; body: string; url: string }> {
    await this.session.ensureAuthenticated();
    await this.rateLimiter.acquire();

    const fullUrl = urlPath.startsWith('http') ? urlPath : `${config.baseUrl}${urlPath}`;

    const response = await fetch(fullUrl, {
      headers: {
        Cookie: this.session.getCookieHeader(),
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') ?? '';

      // Auth failure redirect
      if (location.includes('/Login') || location.includes('/Error/103')) {
        if (!this.retrying) {
          this.retrying = true;
          await this.session.handleSessionExpired();
          const result = await this.get(urlPath);
          this.retrying = false;
          return result;
        }
        this.retrying = false;
        return { status: 401, body: 'Authentication failed after retry', url: fullUrl };
      }

      // Other redirect — return as 302 so caller can decide
      return { status: 302, body: '', url: location };
    }

    const body = await response.text();

    // Check for auth error in body
    if (body.includes('Sie können das gewünschte Dokument nur aufrufen, wenn Sie eingeloggt sind')) {
      if (!this.retrying) {
        this.retrying = true;
        await this.session.handleSessionExpired();
        const result = await this.get(urlPath);
        this.retrying = false;
        return result;
      }
      this.retrying = false;
    }

    return { status: response.status, body, url: response.url };
  }

  /**
   * Make a GET request, automatically following redirects while preserving cookies.
   * Each redirect is a new request with the full cookie header.
   */
  async getWithRedirects(urlPath: string): Promise<{ status: number; body: string; url: string }> {
    let currentPath = urlPath;
    let redirectCount = 0;
    const maxRedirects = 10;

    while (redirectCount < maxRedirects) {
      const result = await this.get(currentPath);
      if (result.status !== 302) {
        return result;
      }
      // Resolve relative URLs
      if (result.url.startsWith('/')) {
        currentPath = result.url;
      } else if (result.url.startsWith('http')) {
        currentPath = result.url;
      } else {
        currentPath = `/${result.url}`;
      }
      redirectCount++;
    }

    throw new Error(`Too many redirects following ${urlPath}`);
  }
}
