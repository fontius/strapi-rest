FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@latest
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
# COPY --from=builder /app/.env.production ./ 
RUN npm ci --omit=dev --legacy-peer-deps
EXPOSE 3000
CMD ["npm", "start"]
