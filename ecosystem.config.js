module.exports = {
  apps: [
    {
      name: 'python-rag-bridge',
      script: 'python_bridge.py',
      interpreter: 'python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
        PYTHON_BRIDGE_PORT: 5001
      }
    },
    {
      name: 'mern-backend',
      script: 'backend/src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        PYTHON_BRIDGE_URL: 'http://127.0.0.1:5001'
      }
    }
  ]
};

