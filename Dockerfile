# Container image for the pg-boss WORKER (routing + SLA sweeps).
# Deploy to Railway, Fly.io, or any container host. The web app deploys to
# Vercel/Render separately (see README "Deployment").
FROM node:20-slim

WORKDIR /app

# Prisma's query engine needs OpenSSL on Debian slim images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps first for better layer caching. The schema is copied before
# install so the `postinstall` hook (prisma generate) can find it.
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# App source.
COPY tsconfig.json ./
COPY src ./src

CMD ["npm", "run", "worker"]
