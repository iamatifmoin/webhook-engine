FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --omit=dev --workspace @debales/api

COPY --from=builder /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
