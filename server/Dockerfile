FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY templates ./templates
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 8099

USER node

CMD ["npx", "tsx", "src/index.ts"]
