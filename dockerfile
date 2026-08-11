FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p src/uploads/siwes

# Install Libreoffice
RUN apt-get update && apt-get install -y \
    libreoffice \ 
    libreoffice-writer \ 
    && rm -rf /var/lib/apt/lists/*

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]