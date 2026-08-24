FROM node:20-bookworm-slim

# Install Python 3, pip and essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY python_engine/requirements.txt python_engine/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r python_engine/requirements.txt

# Install Node dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy full application codebase
COPY . .

# Build Next.js application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Ensure startup script permissions
RUN chmod +x start.sh

# Expose ports
EXPOSE 3000 8000

CMD ["./start.sh"]
