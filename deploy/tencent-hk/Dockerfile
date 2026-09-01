FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run prepare:beta-prisma \
  && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
     DATABASE_URL_UNPOOLED="postgresql://build:build@localhost:5432/build" \
     npx prisma generate --schema .beta-prisma/schema.prisma \
  && npx next build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.beta-prisma ./.beta-prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --schema .beta-prisma/schema.prisma && npx next start -H 0.0.0.0 -p 3000"]

