const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (from backend/.env and root .env)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { connectDB, getDBStatus } = require('./config/db');
const { User, ChatSession } = require('./models/store');

const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows flex for Web Speech API and inline assets
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this client. Please slow down and try again later.'
  }
});
app.use('/api/', apiLimiter);

// API Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Gov Schemes MERN AI Platform',
    database: getDBStatus()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Static frontend serving if dist built
const fs = require('fs');
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER GLOBAL ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Seed Initial Admin & Citizen Users if non-existent
const seedInitialUsers = async () => {
  try {
    // 1. Seed Administrator
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const existingAdmin = await User.findOne({ username: adminUsername });

    if (!existingAdmin) {
      console.log(`[SEED] Creating default Administrator account (${adminUsername})...`);
      const adminPass = process.env.ADMIN_PASSWORD || 'AdminPassword@123';
      const adminSSN = (process.env.ADMIN_SSN || '0000-0000-0000').replace(/\D/g, '');
      const passHash = await bcrypt.hash(adminPass, 10);
      const ssnHash = await bcrypt.hash(adminSSN, 10);

      const adminUser = await User.create({
        username: adminUsername,
        fullName: process.env.ADMIN_FULL_NAME || 'System Administrator',
        email: (process.env.ADMIN_EMAIL || 'admin@govschemes.gov').toLowerCase(),
        ssnHash,
        ssnLast4: adminSSN.slice(-4),
        passwordHash: passHash,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString()
      });

      // Default Admin Welcome Session
      await ChatSession.create({
        userId: String(adminUser._id || adminUser.id),
        title: 'Admin Intelligence & Overview',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ [SEED] Administrator created: username="${adminUsername}", role="admin"`);
    }

    // 2. Seed Demo Citizen User
    const demoUsername = (process.env.DEMO_USER_USERNAME || 'citizen1').toLowerCase();
    const existingDemo = await User.findOne({ username: demoUsername });

    if (!existingDemo) {
      console.log(`[SEED] Creating demo Citizen user (${demoUsername})...`);
      const demoPass = process.env.DEMO_USER_PASSWORD || 'UserPassword@123';
      const demoSSN = (process.env.DEMO_USER_SSN || '1234-5678-9012').replace(/\D/g, '');
      const passHash = await bcrypt.hash(demoPass, 10);
      const ssnHash = await bcrypt.hash(demoSSN, 10);

      const demoUser = await User.create({
        username: demoUsername,
        fullName: process.env.DEMO_USER_FULL_NAME || 'Rajesh Sharma',
        email: (process.env.DEMO_USER_EMAIL || 'rajesh.sharma@example.com').toLowerCase(),
        ssnHash,
        ssnLast4: demoSSN.slice(-4),
        passwordHash: passHash,
        role: 'user',
        isActive: true,
        createdAt: new Date().toISOString()
      });

      // Default Citizen Welcome Session
      await ChatSession.create({
        userId: String(demoUser._id || demoUser.id),
        title: 'Ayushman Bharat & PM-KISAN Inquiry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ [SEED] Demo citizen user created: username="${demoUsername}", role="user"`);
    }
  } catch (seedErr) {
    console.error('[SEED ERROR]', seedErr);
  }
};

// Start Server
const startServer = async () => {
  await connectDB();
  await seedInitialUsers();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Gov Schemes MERN Server running on port ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🛡️ JWT & RBAC Auth active with strict user isolation`);
    console.log(`======================================================\n`);
  });
};

startServer();
