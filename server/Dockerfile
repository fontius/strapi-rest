FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@latest && npm ci --omit=dev --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 1337
CMD ["npm", "run", "start"]
