const jwt = require('jsonwebtoken');
const { User } = require('../models/store');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_gov_rag_jwt_secret_key_2026_production';

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No bearer token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token.'
      });
    }

    // Load user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account associated with this token no longer exists.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated by an administrator. Please contact support.'
      });
    }

    // Attach sanitized user to request object
    req.user = {
      _id: String(user._id || user.id),
      id: String(user._id || user.id),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      ssnLast4: user.ssnLast4
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
};

module.exports = authenticate;
