# Chromium comes from the distro package below — Puppeteer must never download
# its own copy. The v22+ variable is PUPPETEER_SKIP_DOWNLOAD; the older
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is kept for compatibility.
ARG SKIP_DOWNLOAD=true

# ---- Build stage ----
FROM node:20-slim AS builder
ARG SKIP_DOWNLOAD
ENV PUPPETEER_SKIP_DOWNLOAD=$SKIP_DOWNLOAD \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=$SKIP_DOWNLOAD

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runner
ARG SKIP_DOWNLOAD
ENV PUPPETEER_SKIP_DOWNLOAD=$SKIP_DOWNLOAD \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=$SKIP_DOWNLOAD \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Install Chromium + required system libs for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Uploads are written at runtime, so the unprivileged user must own them.
# The subdirs must exist in the image: a named volume seeds itself from this
# path, and an empty /app/uploads seeds an empty, root-owned volume.
RUN mkdir -p uploads/logos uploads/signatures && chown -R node:node /app

# Drop root: a Chromium exploit should not land on a root shell.
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
