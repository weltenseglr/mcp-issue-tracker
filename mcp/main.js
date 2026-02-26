import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { randomUUID } from "node:crypto";
import apiBasedTools from "./api-based-tools.js";

const app = express();
app.use(express.json());

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api";

// Session store: sessionId → transport
const transports = {};

/**
 * Create a fresh MCP server instance with all tools and resources registered.
 */
function createMcpServer() {
  const server = new McpServer({
    name: "issues-tracker-server",
    version: "1.0.0",
  });

  // Register API-based tools (issues, tags, users, health, etc.)
  apiBasedTools(server);

  // Register the database schema resource — fetches from backend HTTP endpoint
  // instead of reading the SQLite file directly (works in containers)
  server.resource("database-schema", "schema://database", {
    title: "Database Schema",
    description: "SQLite schema for the issues database",
    mimeType: "text/plain",
  }, async (uri) => {
    const resp = await fetch(`${API_BASE_URL}/schema`);
    if (!resp.ok) {
      throw new Error(`Failed to fetch schema: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: data.schema,
        },
      ],
    };
  });

  return server;
}

// ─── POST /mcp ────────────────────────────────────────────────────────────────
// Handles client→server JSON-RPC messages. Creates a new session on initialize.
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  // Existing session — route message to its transport
  if (sessionId && transports[sessionId]) {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — must be an initialize request
  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
    });

    // Clean up session when transport closes
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id && transports[id]) {
        delete transports[id];
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // Invalid request
  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32600, message: "Bad request: missing session ID or not an initialize request" },
    id: null,
  });
});

// ─── GET /mcp ─────────────────────────────────────────────────────────────────
// SSE stream for server→client notifications (optional, spec-compliant)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Bad request: invalid or missing session ID" },
      id: null,
    });
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

// ─── DELETE /mcp ──────────────────────────────────────────────────────────────
// Closes a session explicitly
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].close();
    delete transports[sessionId];
  }
  res.status(204).end();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", sessions: Object.keys(transports).length });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "4000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP Streamable HTTP server listening on http://0.0.0.0:${PORT}/mcp`);
  console.log(`Backend API: ${API_BASE_URL}`);
});
