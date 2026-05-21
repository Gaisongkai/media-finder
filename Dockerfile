# ============================================================
# Media Finder — Docker 镜像
# 单容器：Express API + React 前端静态文件，一个端口搞定
# ============================================================

# ── Stage 1: 安装全部依赖 ────────────────────────────────────
FROM node:24-alpine AS deps
RUN npm install -g pnpm@10

WORKDIR /app

# 先只复制 package.json 文件，利用 Docker 层缓存
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-spec/package.json        lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json         lib/api-zod/
COPY lib/db/package.json              lib/db/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/media-finder/package.json artifacts/media-finder/
COPY scripts/package.json             scripts/

RUN pnpm install --frozen-lockfile

# ── Stage 2: 编译共享 lib（api-zod, api-client-react 等）────
FROM deps AS libs
COPY . .
RUN pnpm run typecheck:libs

# ── Stage 3: 构建前端静态文件 ────────────────────────────────
FROM libs AS frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/media-finder run build

# ── Stage 4: 构建后端 Bundle ─────────────────────────────────
FROM libs AS backend
ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build

# ── Stage 5: 最终运行镜像 ────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# 只复制编译产物，保持镜像最小
COPY --from=backend  /app/artifacts/api-server/dist  ./dist
COPY --from=frontend /app/artifacts/media-finder/dist/public ./public

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV SERVE_STATIC_DIR=/app/public

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
