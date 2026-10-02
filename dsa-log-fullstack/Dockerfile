# Alternative deployment: any container host (Render, Fly.io, Railway, AWS App Runner/ECS, a VPS).
# Build:  docker build -t dsa-log .
# Run:    docker run -p 3000:3000 -e JWT_SECRET=<64+ random hex chars> -v dsa-data:/data dsa-log
FROM node:22-slim
WORKDIR /app

# install dependencies first so Docker can cache this layer
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY client ./client

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/dsa-log.db
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3000
WORKDIR /app/server
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
