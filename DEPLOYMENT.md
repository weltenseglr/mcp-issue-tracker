# Deployment Guide

This guide covers running the Issue Tracker stack with Podman containers.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Podman Network                      │
│                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │
│  │  frontend   │    │   backend   │    │   mcp    │  │
│  │  :5173(dev) │    │   :3000     │    │  :4000   │  │
│  │  :80 (prod) │───>│  Fastify    │<───│ Streambl │  │
│  │  nginx/vite │    │  SQLite     │    │ HTTP MCP │  │
│  └─────────────┘    └─────────────┘    └──────────┘  │
└──────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ browser                            │ OpenCode
     port 5173/80                       type: "remote"
                                    http://localhost:4000/mcp
```

Three containerized services:

- **backend** — Fastify API server with SQLite, runs on port 3000
- **frontend** — Vite dev server (dev) or nginx serving built assets (prod)
- **mcp** — MCP server using Streamable HTTP transport, runs on port 4000

The MCP server connects to the backend over the container network. OpenCode connects to the MCP server from the host via HTTP.

---

## Prerequisites

- [Podman](https://podman.io/) and `podman-compose` installed
- For Quadlet deployment: Podman 4.4+ with systemd

---

## 1. Development (Local)

```bash
# Copy and edit the backend env file
cp backend/.env.template backend/.env
# Edit backend/.env — at minimum, set BETTER_AUTH_SECRET

# Start all services
podman-compose -f podman-compose.dev.yml up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:3000       |
| MCP      | http://localhost:4000/mcp   |
| Health   | http://localhost:3000/health |

### Seed the database (optional)

```bash
podman exec -it issue-tracker-dev-backend-1 node dist/db/seed.js
```

### Stop

```bash
podman-compose -f podman-compose.dev.yml down
```

---

## 2. Production

```bash
# Copy and edit the production env file
cp .env.prod.template .env

# Edit .env:
#   BETTER_AUTH_SECRET=<strong-random-secret>
#   BETTER_AUTH_BASE_URL=http://your-server-ip-or-domain
#   FRONTEND_URL=http://your-server-ip-or-domain

# Build and start
podman-compose -f podman-compose.prod.yml up --build -d
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost (port 80)  |
| API      | http://localhost/api (proxied by nginx) |
| MCP      | http://localhost:4000/mcp   |

In production, nginx proxies `/api` requests to the backend container — no CORS needed (same origin).

### Stop

```bash
podman-compose -f podman-compose.prod.yml down
```

### Data persistence

The SQLite database is stored in a named volume (`issues-db`). Data survives `down` and `up` cycles. To fully reset:

```bash
podman-compose -f podman-compose.prod.yml down -v  # removes volumes too
```

---

## 3. Quadlet (Systemd) Deployment

For persistent rootless Podman deployment on a server using systemd user units.

### Build images first

```bash
podman build -t issue-tracker-backend ./backend
podman build -t issue-tracker-frontend --target prod ./frontend
podman build -t issue-tracker-mcp ./mcp
```

### Install units

```bash
cd quadlet
./install.sh
```

This copies unit files (including the shared `issue-tracker.network`) to `~/.config/containers/systemd/` and creates `~/.config/issue-tracker/prod.env` from the template. Containers use explicit `ContainerName=` directives (`backend`, `frontend`, `mcp`) for DNS resolution on the shared network — matching the same hostnames used in `podman-compose`.

### Configure

```bash
# Edit the production env file
nano ~/.config/issue-tracker/prod.env
```

### Start services

```bash
systemctl --user start issue-tracker-backend issue-tracker-frontend issue-tracker-mcp
```

### Enable on boot

```bash
# Enable lingering so user services start without login
loginctl enable-linger $USER

systemctl --user enable issue-tracker-backend issue-tracker-frontend issue-tracker-mcp
```

### Check status

```bash
systemctl --user status issue-tracker-backend issue-tracker-frontend issue-tracker-mcp
journalctl --user -u issue-tracker-backend -f
```

---

## 4. OpenCode MCP Configuration

Add to your OpenCode config (`opencode.json` or equivalent):
> **Note:** This project uses a repo-local `opencode.jsonc` for the issue-tracker MCP. Add this file to your project root to enable the MCP. The MCP server is bound to localhost on the host (`127.0.0.1:4000`) by default.


Add `opencode.jsonc` to your project root:

```jsonc
{
  "mcp": {
    "issue-tracker": {
      "type": "remote",
      "url": "http://localhost:4000/mcp",
      "enabled": true
    },
    "issue-tracker-fallback": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "http://localhost:4000/mcp", "--transport", "http-only"],
      "enabled": false
    }
  }
}
```

### Option B: Fallback via mcp-remote proxy

If native Streamable HTTP doesn't work with your OpenCode version:

```jsonc
{
  "mcp": {
    "issue-tracker": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "http://localhost:4000/mcp", "--transport", "http-only"],
      "enabled": true
    }
  }
}
```

### Option C: Legacy stdio (host-only, no container)

If you prefer running the MCP server directly on the host without containers:

```jsonc
{
  "mcp": {
    "issue-tracker": {
      "type": "local",
      "command": ["node", "/path/to/mcp-issue-tracker/mcp/main.js"],
      "environment": {
        "API_BASE_URL": "http://localhost:3000/api"
      },
      "enabled": true
    }
  }
}
```

> Note: The stdio transport was replaced with Streamable HTTP. For legacy stdio, use the original upstream version or run the containerized version with Options A/B.

---

## 5. Environment Variables Reference

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `database.sqlite` (relative) | Path to SQLite database file |
| `BETTER_AUTH_SECRET` | — | **Required.** Secret for session encryption |
| `BETTER_AUTH_BASE_URL` | `http://localhost:3000` | Backend's public URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Comma-separated allowed origins |
| `NODE_ENV` | `development` | `development` or `production` |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Logging level |

### MCP Server

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3000/api` | Backend API URL |
| `PORT` | `4000` | MCP server port |

### Frontend (build-time only)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | API base URL (relative works with nginx proxy) |

---

## Troubleshooting

### better-sqlite3 build fails in Alpine container

If the native module fails to build, switch the backend Dockerfile base image:

```dockerfile
# Change FROM node:22-alpine to:
FROM node:22-slim
```

### Vite HMR not working in dev container

Add to `frontend/vite.config.ts`:

```typescript
server: {
  host: '0.0.0.0',
  hmr: {
    host: 'localhost',
  },
  // ... existing proxy config
}
```

### MCP connection issues with OpenCode

1. Verify the MCP server is running: `curl http://localhost:4000/health`
2. Try the mcp-remote fallback (Option B above)
3. Check logs: `podman logs issue-tracker-dev-mcp-1`
