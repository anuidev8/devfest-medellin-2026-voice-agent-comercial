# NoShy brain: Google ADK agent + AG-UI bridge (src/server.ts) — Cloud Run / Railway / Fly.
#   gcloud run deploy noshy-agent --source packages/agent --region us-central1 ...
# (see docs/guides/deploy/04-deploy-cloud.md)
FROM node:24-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Cloud Run injects PORT (8080); server.ts reads process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/server.js"]
