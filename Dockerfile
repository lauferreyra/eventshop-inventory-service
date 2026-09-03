FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --include=dev

COPY prisma ./prisma

COPY prisma.config.ts ./

COPY src/prisma ./src/prisma

COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]