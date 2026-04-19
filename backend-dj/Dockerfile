# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Create non-root user for security
RUN addgroup -S djapp && adduser -S djapp -G djapp

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure uploads directory exists
RUN mkdir -p /app/uploads/photos

RUN chown -R djapp:djapp /app
USER djapp

EXPOSE 4000
CMD ["node", "src/app.js"]
