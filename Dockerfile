# ==============================================================================
# Unified Single-Container Deployment (Optimized for Render, Railway & Cloud Run)
# Runs both Python RAG AI Bridge (:5001) and Node.js Web Server (:PORT)
# ==============================================================================

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Unified Runner (Python 3.12 + Node 20)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_BRIDGE_PORT=5001 \
    PYTHON_BRIDGE_URL=http://127.0.0.1:5001 \
    NODE_ENV=production

WORKDIR /app

# Install Node.js, curl, and process tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Node backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy application files
COPY python_bridge.py db_connector.py rag_service.py guardrails.py tts_service.py nova_live_session.py ./
COPY backend/src ./backend/src

# Copy pre-built React frontend from stage 1
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Expose web port (Render sets $PORT dynamically)
EXPOSE 5000

# Copy and configure entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/bin/bash", "/app/entrypoint.sh"]

