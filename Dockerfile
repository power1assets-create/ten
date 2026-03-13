# Dockerfile — สำหรับ build และ run CRM App ใน container
# Multi-stage ไม่จำเป็นสำหรับ Node.js app เล็กๆ ใช้ single stage พอ

# ใช้ Node.js 20 LTS บน Alpine (image เล็ก ~50MB)
FROM node:20-alpine

# กำหนด working directory ใน container
WORKDIR /app

# Copy package files ก่อน เพื่อ cache layer ของ npm install
COPY package*.json ./

# ติดตั้ง dependencies (production only)
RUN npm install --omit=dev

# Copy source code ทั้งหมด
COPY . .

# เปิด port 3000
EXPOSE 3000

# Environment variables ที่ต้องการ (override ตอน run)
ENV NODE_ENV=production
ENV PORT=3000

# คำสั่งรัน app
CMD ["node", "server.js"]

# ─── วิธีใช้ ───────────────────────────────────────────────────────────────────
# Build:  docker build -t crm-app .
# Run:    docker run -p 3000:3000 \
#           -e DB_HOST=host.docker.internal \
#           -e DB_NAME=crmdb \
#           -e DB_USER=postgres \
#           -e DB_PASSWORD=yourpassword \
#           crm-app
