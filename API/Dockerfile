FROM node:22-bookworm-slim
WORKDIR /app
COPY API/package.json API/package-lock.json ./
RUN npm ci
COPY API/ ./
COPY WWW/public /WWW/public
RUN mkdir -p /app/data/downloads \
  && if [ -d /WWW/public/downloads ]; then cp -a /WWW/public/downloads/. /app/data/downloads/; fi
RUN npx tsc -p tsconfig.json
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "dist/src/index.js"]
