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

# Stage 2: Production Unified Runner (Python 3.11 + Node 20)
FROM python:3.11-slim

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
RUN pip install --no-cache-dir -r requirements.txt

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

# Create lightweight production entrypoint script
RUN echo '#!/bin/sh\n\
echo "Starting Python RAG AI Bridge on port 5001..."\n\
python python_bridge.py &\n\
PY_PID=$!\n\
\n\
echo "Starting Node.js Express server on port ${PORT:-5000}..."\n\
node backend/src/server.js &\n\
NODE_PID=$!\n\
\n\
trap "kill $PY_PID $NODE_PID" SIGTERM SIGINT\n\
wait -n\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]

