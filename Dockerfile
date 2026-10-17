FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY connectors ./connectors
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@atlas/gateway"]
