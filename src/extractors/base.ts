import TurndownService from 'turndown';

let _turndown: TurndownService | null = null;

export function getTurndown(): TurndownService {
  if (_turndown) return _turndown;

  _turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Remove nav chrome, scripts, styles
  _turndown.remove(['script', 'style', 'nav', 'iframe', 'noscript']);

  // Keep tables
  _turndown.addRule('table', {
    filter: 'table',
    replacement: (content, node) => {
      return '\n\n' + content + '\n\n';
    },
  });

  return _turndown;
}

export function cleanHtml(html: string): string {
  // Remove common beck-online chrome patterns
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script[\s\S]*?<\/script>/gi, '') // scripts
    .replace(/<style[\s\S]*?<\/style>/gi, ''); // styles
}
