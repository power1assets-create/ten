# Dockerfile — Railway deployment
FROM node:20-alpine

WORKDIR /app

# Copy package files ก่อน → cache npm install layer
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Railway inject PORT เอง — ไม่ต้อง hardcode
EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
