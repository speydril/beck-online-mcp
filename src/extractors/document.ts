import * as cheerio from 'cheerio';
import { getTurndown, cleanHtml } from './base.js';
import type { DocumentContent } from '../shared/types.js';

export function parseDocument(html: string, vpath: string): DocumentContent {
  const cleaned = cleanHtml(html);
  const $ = cheerio.load(cleaned);
  const turndown = getTurndown();

  // Extract title from <title> tag (most reliable on beck-online)
  let title = $('title').text().replace(/\s*-\s*beck-online\s*$/, '').trim();
  // Fallback to other selectors
  if (!title || title === 'Captcha' || title === 'Meldung') {
    title =
      $('.doc-title, .dokumenttitel, #dokumenttitel').first().text().trim() ||
      $('h1').first().text().trim() ||
      '';
  }

  // Extract metadata from breadcrumb
  const metaParts: string[] = [];
  $('.breadcrumb a, .dokumentpfad a').each((_, el) => {
    const text = $(el).text().trim();
    if (text) metaParts.push(text);
  });

  // The main document content is in #bo_center on beck-online
  let contentEl = $('#bo_center');

  // Check if bo_center has a Turnstile captcha (content not loaded)
  const centerHtml = contentEl.html() ?? '';
  if (centerHtml.includes('turnstile') || centerHtml.includes('Captcha/ValidateCaptchaResult')) {
    // Content is behind Turnstile — try to use the TOC from #bo_left instead
    const tocEl = $('#toccontent, #doktoc, #bo_left_content');
    if (tocEl.length) {
      return {
        title,
        metadata: metaParts.join(' > '),
        content: '[Document content requires Cloudflare Turnstile verification and cannot be loaded via HTTP. The table of contents is available — use beck_get_toc with this vpath to browse sections.]',
        vpath,
      };
    }
  }

  // Check for subscription error
  if (contentEl.text().includes('nicht von Ihrem Abonnement') || contentEl.text().includes('eingeloggt')) {
    const errorText = contentEl.text().trim().substring(0, 300);
    return {
      title,
      metadata: metaParts.join(' > '),
      content: `[Access denied] ${errorText}`,
      vpath,
    };
  }

  // Fallback selectors if #bo_center is empty or not found
  if (!contentEl.length || contentEl.text().trim().length < 50) {
    contentEl = $('#dokument, #dokumentinhalt, .dokument-content, main').first();
  }

  // Remove unwanted elements from the content
  contentEl.find('.toolbar, .toolleiste, #doktoc, #toccontent, #bo_left, .spalte-links').remove();
  contentEl.find('[class*="druckexport"], [class*="DruckExport"], [class*="Fingerprint"]').remove();
  contentEl.find('.treffer-navigation, .breadcrumb, .searchBarOption').remove();
  contentEl.find('button, input, select, .turnstile-container').remove();
  contentEl.find('[id="turnstile-container"]').remove();

  // Convert cross-reference links
  contentEl.find('a[href*="vpath="]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/vpath=([^&]+)/);
    if (match) {
      $(el).attr('href', `beck://doc/${decodeURIComponent(match[1])}`);
    }
  });

  const contentHtmlFinal = contentEl.html() ?? '';
  let markdown = turndown.turndown(contentHtmlFinal);

  // Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+$/gm, '')
    .trim();

  return {
    title,
    metadata: metaParts.join(' > '),
    content: markdown,
    vpath,
  };
}
