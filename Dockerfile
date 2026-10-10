FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies into temp directory for caching
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Release image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# Ensure data directory exists for SQLite storage
RUN mkdir -p /app/data

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
