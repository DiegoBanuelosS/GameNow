FROM node:22-bookworm-slim
WORKDIR /app
COPY API/package.json API/package-lock.json ./
RUN npm ci
COPY API/ ./
COPY WWW/public /WWW/public
RUN npx tsc -p tsconfig.json
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "dist/src/index.js"]
