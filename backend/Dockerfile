# ── Stage 1: build ─────────────────────────────────────
FROM node:22-alpine AS build

# native deps for better-sqlite3 and bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Copy SQL migration files that tsc doesn't emit
RUN cp -r src/db/migrations dist/db/migrations

# ── Stage 2: production ───────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output + migrations from build stage
COPY --from=build /app/dist ./dist

# Copy better-auth migration SQL for entrypoint bootstrap
COPY --from=build /app/better-auth_migrations ./better-auth_migrations

# Copy and prepare entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Clean up build tools after native modules are built
RUN apk del python3 make g++

EXPOSE 3000

CMD ["./entrypoint.sh"]
