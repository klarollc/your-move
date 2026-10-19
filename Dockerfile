# syntax=docker/dockerfile:1
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci
RUN npm run build --workspace @cuckcode/web
RUN npm run build --workspace @cuckcode/server
RUN npm prune --omit=dev

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "run", "start:hosted", "--workspace", "@cuckcode/server"]
