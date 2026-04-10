# syntax=docker/dockerfile:1

FROM node:22-alpine

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=tracker-server-pnpm-store,target=/pnpm/store \
    corepack prepare pnpm@10.10.0 --activate && \
    pnpm install --frozen-lockfile --prod

COPY src ./src
COPY tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "const port = process.env.PORT ?? 3000; fetch('http://127.0.0.1:' + port + '/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "prod"]
