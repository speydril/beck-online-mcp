import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config, validateConfig } from './config.js';
import { Session } from './auth/session.js';
import { BeckHttpClient } from './http/client.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  validateConfig();

  const session = new Session();
  const http = new BeckHttpClient(session);

  const server = new McpServer({
    name: 'beck-online-mcp',
    version: '0.1.0',
  });

  registerAllTools(server, http);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[beck-mcp] Server running on stdio.');

  process.on('SIGINT', () => {
    console.error('[beck-mcp] Shutting down...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[beck-mcp] Fatal error:', err);
  process.exit(1);
});
