import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BeckHttpClient } from '../http/client.js';
import { registerSearchTool } from './search.js';
import { registerGetDocumentTool } from './get-document.js';
import { registerGetTocTool } from './get-toc.js';

export function registerAllTools(server: McpServer, http: BeckHttpClient) {
  registerSearchTool(server, http);
  registerGetDocumentTool(server, http);
  registerGetTocTool(server, http);
}
