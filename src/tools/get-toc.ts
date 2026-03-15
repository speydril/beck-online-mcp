import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BeckHttpClient } from '../http/client.js';
import { parseToc } from '../extractors/toc.js';
import type { TocEntry } from '../shared/types.js';

export function registerGetTocTool(server: McpServer, http: BeckHttpClient) {
  server.registerTool(
    'beck_get_toc',
    {
      title: 'Get table of contents',
      description:
        'Get the table of contents / navigation tree for a beck-online commentary or handbook. Use this to discover available sections before retrieving specific documents.',
      inputSchema: z.object({
        vpath: z
          .string()
          .describe(
            'Vpath to the Inhaltsverzeichnis (table of contents) page, e.g., "bibdata/komm/BoScKeKoEUDA_1/cont/BoScKeKoEUDA.Inhaltsverzeichnis.htm"',
          ),
      }),
    },
    async ({ vpath }) => {
      const url = `/Dokument?vpath=${encodeURIComponent(vpath)}`;
      const result = await http.getWithRedirects(url);

      if (result.status !== 200) {
        return {
          content: [{ type: 'text' as const, text: `Could not load TOC page for vpath: ${vpath}` }],
        };
      }

      const entries = parseToc(result.body);

      if (entries.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No table of contents entries found. The page may not have a standard TOC structure.\n\nvpath: \`${vpath}\``,
            },
          ],
        };
      }

      const lines = ['# Table of Contents\n'];

      function renderEntry(entry: TocEntry) {
        const indent = '  '.repeat(entry.depth);
        const vpathInfo = entry.vpath ? ` — vpath: \`${entry.vpath}\`` : '';
        lines.push(`${indent}- **${entry.title}**${vpathInfo}`);
        if (entry.children) {
          for (const child of entry.children) {
            renderEntry(child);
          }
        }
      }

      for (const entry of entries) {
        renderEntry(entry);
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
