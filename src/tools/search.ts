import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BeckHttpClient } from '../http/client.js';
import { parseSearchResults } from '../extractors/search-results.js';
import { parseDocument } from '../extractors/document.js';
import type { SearchResponse } from '../shared/types.js';

const DOCUMENT_TYPES = {
  all: undefined,
  ges: 'ges',       // Rechtsvorschriften (laws)
  buch: 'buch',     // Kommentare, Handbücher
  aufs: 'aufs',     // Aufsätze (articles)
  form: 'form',     // Formulare
  sonst: 'sonst',   // Meldungen, Anmerkungen
  lex: 'lex',       // Lexika
  verwan: 'verwan', // Verwaltungsvorschriften
} as const;

const LEGAL_AREAS = {
  ZivilR: 'ZivilR',
  HaWiR: 'HaWiR',
  ZiBeR: 'ZiBeR',
  InsolvR: 'InsolvR',
  ArbR: 'ArbR',
  SozR: 'SozR',
  OeR: 'OeR',
  StrafR: 'StrafR',
  EuropaR: 'EuropaR',
  SteuerR: 'SteuerR',
} as const;

export function registerSearchTool(server: McpServer, http: BeckHttpClient) {
  server.registerTool(
    'beck_search',
    {
      title: 'Search beck-online',
      description:
        'Search the beck-online German legal database. Returns a list of matching documents (commentaries, laws, court decisions, articles). Use documentType to filter by category.',
      inputSchema: z.object({
        query: z.string().describe('Search query (e.g., "Mietvertrag Kündigung" or "§ 823 BGB")'),
        documentType: z
          .enum(['all', 'ges', 'buch', 'aufs', 'form', 'sonst', 'lex', 'verwan'])
          .optional()
          .default('all')
          .describe('Filter by document type: ges=laws, buch=commentaries, aufs=articles, form=forms'),
        legalArea: z
          .enum(['ZivilR', 'HaWiR', 'ZiBeR', 'InsolvR', 'ArbR', 'SozR', 'OeR', 'StrafR', 'EuropaR', 'SteuerR'])
          .optional()
          .describe('Filter by legal area'),
        sort: z.enum(['relevance', 'date']).optional().default('relevance').describe('Sort order'),
        page: z.number().int().min(1).optional().default(1).describe('Page number (results are paginated)'),
      }),
    },
    async ({ query, documentType, legalArea, sort, page }) => {
      // Build search URL
      let url = `/Search?pagenr=${page}&words=${encodeURIComponent(query)}&RBSORT=${sort === 'date' ? 'Date' : 'Score'}`;

      if (documentType && documentType !== 'all') {
        url += `&Addfilter=spubtyp0:${documentType}`;
      }
      if (legalArea) {
        url += `&Addfilter=staxrechtsgebiet0:${legalArea}`;
      }

      // First request without following redirects to detect norm jumps
      const result = await http.get(url);

      // Handle norm detection redirect (e.g., "§ 823 BGB" → direct document)
      if (result.status === 302) {
        const redirectUrl = result.url;

        // Follow the redirect chain to get the actual document
        const docResult = await http.getWithRedirects(redirectUrl);
        if (docResult.status === 200) {
          const vpathMatch = docResult.url.match(/vpath=([^&]+)/);
          const vpath = vpathMatch ? decodeURIComponent(vpathMatch[1]) : '';
          const doc = parseDocument(docResult.body, vpath);

          return {
            content: [
              {
                type: 'text' as const,
                text: `**Norm detected — direct jump to document:**\n\n# ${doc.title}\n\n${doc.metadata ? `*${doc.metadata}*\n\n` : ''}${doc.content.substring(0, 3000)}${doc.content.length > 3000 ? '\n\n*[Document truncated. Use beck_get_document to retrieve full content.]*' : ''}\n\n**vpath:** \`${vpath}\``,
              },
            ],
          };
        }
      }

      // Normal search results
      const searchResponse = parseSearchResults(result.body, page);

      if (searchResponse.results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No results found for this query.' }],
        };
      }

      const lines: string[] = [
        `**Search results for "${query}"** (page ${searchResponse.currentPage}/${searchResponse.totalPages}):\n`,
      ];

      for (const r of searchResponse.results) {
        lines.push(`${r.position}. **${r.sourceTitle}**`);
        if (r.sectionTitle) lines.push(`   ${r.sectionTitle}`);
        if (r.citation) lines.push(`   *${r.citation}*`);
        if (r.vpath) lines.push(`   vpath: \`${r.vpath}\``);
        lines.push('');
      }

      if (searchResponse.totalPages > page) {
        lines.push(`*More results available — use page: ${page + 1} to see next page.*`);
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
