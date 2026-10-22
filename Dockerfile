# ترب‌جو — production image: Next.js standalone server + prebuilt catalog.
#
# Install, build and cleanup happen in ONE layer: committing pnpm's node_modules and store
# (hundreds of thousands of files) as their own layer takes longer than remote builders allow.
# Only the standalone server (/srv) and the unpacked catalog end up in the image.
FROM node:20-bookworm-slim
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_TYPECHECK=1 NODE_OPTIONS=--max-old-space-size=1024
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /build
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm build \
 && mkdir -p /srv && cp -a .next/standalone/. /srv/ \
 && mkdir -p /srv/.next && cp -r .next/static /srv/.next/static\
 && cp -r public /srv/public \
 && rm -rf /srv/data && mkdir -p /srv/data/store \
 && for f in data/packed/*.gz; do gunzip -c "$f" > "/srv/data/$(basename "$f" .gz)"; done \
 && cd / && rm -rf /build /root/.local/share/pnpm /root/.cache /root/.npm /tmp/*
WORKDIR /srv
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NODE_OPTIONS=--max-old-space-size=1536
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD curl -fsS http://localhost:3000/api/ready || exit 1
# Catalog in /srv/data; /srv/data/store is the persistent disk (accounts, chats, seller answers).
CMD ["node", "server.js"]
