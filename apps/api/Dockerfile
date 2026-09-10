FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npx tsx apps/api/src/main.ts"]
