#!/usr/bin/env bash
# ==============================================================================
# GovAssist AI - Production Launcher for Linux / macOS / Cloud VMs
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo " Starting GovAssist AI Platform (Databricks + Bedrock RAG)"
echo "=========================================================="

# Check Python environment
PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
  if command -v python &>/dev/null; then
    PYTHON_CMD="python"
  else
    echo "❌ Python is not installed. Please install Python 3.10+."
    exit 1
  fi
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 18+."
  exit 1
fi

# Ensure frontend is built
if [ ! -d "frontend/dist" ]; then
  echo "📦 Building frontend production assets..."
  npm --prefix frontend install
  npm --prefix frontend run build
fi

# Ensure backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  npm --prefix backend install
fi

echo "🚀 [1/2] Starting Python RAG AI Bridge on port 5001..."
$PYTHON_CMD python_bridge.py &
PY_PID=$!

echo "🚀 [2/2] Starting Node.js Backend on port 5000..."
node backend/src/server.js &
NODE_PID=$!

cleanup() {
  echo ""
  echo "🛑 Stopping services gracefully..."
  kill $PY_PID 2>/dev/null || true
  kill $NODE_PID 2>/dev/null || true
  wait $PY_PID 2>/dev/null || true
  wait $NODE_PID 2>/dev/null || true
  echo "✅ All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "=========================================================="
echo "  GovAssist Platform is ONLINE!"
echo "  Web Application: http://localhost:5000"
echo "  Health API:      http://localhost:5000/health"
echo "  Admin Login:     admin / AdminPassword@123"
echo "  Citizen Demo:    citizen1 / UserPassword@123"
echo "=========================================================="
echo "Press Ctrl+C to stop all services."
echo ""

wait

