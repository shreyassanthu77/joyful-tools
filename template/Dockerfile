FROM oven/bun:1.2 AS builder

RUN apt update && apt install -y python3 build-essential

WORKDIR /app

COPY package.json .npmrc ./

RUN bun install

COPY . .

RUN bun run --bun build

FROM oven/bun:1.2 AS resolved

WORKDIR /app

COPY --from=builder /app/package.json /app/.npmrc /app/bun.lock ./

RUN bun install --production --frozen-lockfile

FROM denoland/deno:distroless-2.3.6

WORKDIR /app

COPY --from=builder /app/build /app
COPY --from=resolved /app/node_modules ./node_modules
COPY --from=resolved /app/bun.lock /app/package.json /app/.npmrc ./

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["run", "-A", "index.js"]
