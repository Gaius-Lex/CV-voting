FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM alpine:latest

# Copy built assets from builder stage
COPY --from=builder /app/dist /build

# Copy build files to shared volume and exit
CMD ["sh", "-c", "cp -r /build/* /usr/share/nginx/html/ && echo 'Frontend build copied to shared volume' && sleep infinity"] 