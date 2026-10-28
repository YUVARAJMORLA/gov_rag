#!/bin/bash

# Graceful cleanup on termination
cleanup() {
    echo "Shutting down GovAssist services..."
    kill -TERM "$PY_PID" "$NODE_PID" 2>/dev/null || true
    wait "$PY_PID" "$NODE_PID" 2>/dev/null || true
    exit 0
}

trap cleanup TERM INT

echo "Starting Python RAG AI Bridge on port 5001..."
python python_bridge.py &
PY_PID=$!

echo "Starting Node.js Express server on port ${PORT:-5000}..."
node backend/src/server.js &
NODE_PID=$!

# Wait for both processes or exit if one dies
wait -n "$PY_PID" "$NODE_PID"
EXIT_CODE=$?

echo "A primary service exited with code $EXIT_CODE. Exiting container..."
cleanup
