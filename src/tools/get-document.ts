import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BeckHttpClient } from '../http/client.js';
import { parseDocument } from '../extractors/document.js';
import { BeckDocumentNotFoundError } from '../shared/errors.js';

export function registerGetDocumentTool(server: McpServer, http: BeckHttpClient) {
  server.registerTool(
    'beck_get_document',
    {
      title: 'Get beck-online document',
      description:
        'Retrieve the full content of a specific document from beck-online by its vpath. Use beck_search first to find vpaths.',
      inputSchema: z.object({
        vpath: z
          .string()
          .describe('Document vpath (e.g., "bibdata/ges/bgb/cont/bgb.p823.htm"). Get this from beck_search results.'),
      }),
    },
    async ({ vpath }) => {
      const url = `/Dokument?vpath=${encodeURIComponent(vpath)}`;
      const result = await http.getWithRedirects(url);

      if (result.status !== 200) {
        throw new BeckDocumentNotFoundError(vpath);
      }

      const doc = parseDocument(result.body, vpath);

      const MAX_LENGTH = 8000;
      const truncated = doc.content.length > MAX_LENGTH;
      const content = truncated ? doc.content.substring(0, MAX_LENGTH) : doc.content;

      const output = [
        `# ${doc.title}`,
        doc.metadata ? `\n*${doc.metadata}*` : '',
        `\n**vpath:** \`${vpath}\`\n`,
        '---\n',
        content,
      ];

      if (truncated) {
        output.push(
          '\n\n---\n*[Document truncated due to length. The full document is longer than what can be displayed here.]*',
        );
      }

      return {
        content: [{ type: 'text' as const, text: output.join('\n') }],
      };
    },
  );
}
