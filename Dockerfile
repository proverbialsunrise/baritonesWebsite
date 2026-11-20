FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY app.js server.js ./
COPY lib ./lib
COPY views ./views
COPY data ./data
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4952

USER node
EXPOSE 4952

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4952) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
