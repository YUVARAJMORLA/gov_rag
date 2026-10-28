const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, ChatSession } = require('../models/store');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_gov_rag_jwt_secret_key_2026_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: String(user._id || user.id),
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Clean and extract 12-digit Aadhaar / SSN (format: 0000-0000-0000)
const cleanSSN = (ssn) => {
  if (!ssn) return null;
  const digits = String(ssn).replace(/\D/g, '');
  // Accepts 12-digit Aadhaar (primary) or 9-digit SSN (legacy)
  return (digits.length === 12 || digits.length === 9) ? digits : null;
};

// Strong Password Validator (min 8 chars, 1 lower, 1 upper, 1 number, 1 special symbol)
const validateStrongPassword = (pw) => {
  if (!pw || pw.length < 8) {
    return 'Password must be at least 8 characters in length.';
  }
  if (!/[a-z]/.test(pw)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[A-Z]/.test(pw)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/\d/.test(pw)) {
    return 'Password must contain at least one numeric digit (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw)) {
    return 'Password must contain at least one special character / symbol (!@#$%^&* etc.).';
  }
  return null;
};

// 1. REGISTER
exports.register = async (req, res) => {
  try {
    const { username, fullName, email, ssn, password, confirmPassword } = req.body;

    if (!username || !fullName || !email || !ssn || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields: Username, Full Name, Email, SSN, and Password.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    const pwError = validateStrongPassword(password);
    if (pwError) {
      return res.status(400).json({
        success: false,
        error: pwError
      });
    }

    // Validate 12-digit Aadhaar / SSN
    const cleanedSSN = cleanSSN(ssn);
    if (!cleanedSSN || cleanedSSN.length !== 12) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 12-digit Aadhaar / SSN (format: 0000-0000-0000).'
      });
    }


    // Check existing username
    const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        error: 'Username is already registered. Please choose another username or log in.'
      });
    }

    // Check existing email
    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'Email address is already registered to another account.'
      });
    }

    // Hash Password and SSN
    const passwordHash = await bcrypt.hash(password, 10);
    const ssnHash = await bcrypt.hash(cleanedSSN, 10);
    const ssnLast4 = cleanedSSN.slice(-4);

    // Create User in MongoDB / Datastore
    const newUser = await User.create({
      username: username.trim().toLowerCase(),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      ssnHash,
      ssnLast4,
      passwordHash,
      role: 'user',
      isActive: true,
      createdAt: new Date().toISOString()
    });

    // Create an initial default chat session for the user
    const defaultSession = await ChatSession.create({
      userId: String(newUser._id || newUser.id),
      title: 'Welcome Session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to the Gov Schemes RAG Assistant.',
      token,
      user: {
        id: String(newUser._id || newUser.id),
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        ssnLast4: newUser.ssnLast4
      },
      defaultSessionId: String(defaultSession._id || defaultSession.id)
    });
  } catch (err) {
    console.error('[AUTH REGISTER ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during registration. Please try again.'
    });
  }
};

// 2. LOGIN (Supports Username OR Email)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const identifier = (username || req.body.email || req.body.identifier || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your username or email address and password.'
      });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Your account is currently inactive or suspended. Please contact the administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
      });
    }

    // Update lastLogin
    await User.findByIdAndUpdate(user._id || user.id, { lastLogin: new Date().toISOString() });

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: String(user._id || user.id),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        ssnLast4: user.ssnLast4
      }
    });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during login.'
    });
  }
};

// 3. FORGOT PASSWORD (Verified via 12-digit Aadhaar/SSN + Username/Email)
exports.forgotPassword = async (req, res) => {
  try {
    const { username, ssn, newPassword, confirmPassword } = req.body;
    const identifier = (username || req.body.email || '').trim().toLowerCase();

    if (!identifier || !ssn || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Username or Email, 12-digit Aadhaar/SSN, and your New Password.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match.'
      });
    }

    const pwError = validateStrongPassword(newPassword);
    if (pwError) {
      return res.status(400).json({
        success: false,
        error: pwError
      });
    }

    const cleanedSSN = cleanSSN(ssn);

    if (!cleanedSSN) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 12-digit Aadhaar / SSN (format: 0000-0000-0000).'
      });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No registered user account found with this username or email.'
      });
    }

    // Verify SSN match against stored bcrypt hash
    const isSSNValid = await bcrypt.compare(cleanedSSN, user.ssnHash);
    if (!isSSNValid) {
      return res.status(401).json({
        success: false,
        error: 'Identity verification failed. The provided SSN does not match our records for this user account.'
      });
    }

    // SSN verified! Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(user._id || user.id, {
      passwordHash: newPasswordHash,
      updatedAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: 'Password reset successful! You may now sign in using your new password.'
    });
  } catch (err) {
    console.error('[AUTH FORGOT PASSWORD ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during password recovery.'
    });
  }
};

// 4. GET CURRENT AUTHENTICATED USER
exports.getMe = async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
};
