# Multi-stage enterprise container build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY config/ ./config/
RUN mkdir -p /app/data/reports

VOLUME ["/app/data/reports"]

CMD ["node", "dist/index.js"]
