FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production
EXPOSE 5173

CMD ["node", "server.js"]
