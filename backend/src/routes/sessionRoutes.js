const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authenticate = require('../middleware/auth');

// All session endpoints require valid JWT authentication
router.use(authenticate);

// List all sessions belonging to the current user
router.get('/', sessionController.getUserSessions);

// Create new session for current user
router.post('/', sessionController.createSession);

// Get messages for a session (strictly isolated to owner)
router.get('/:sessionId/messages', sessionController.getSessionMessages);

// Rename session
router.put('/:sessionId', sessionController.renameSession);

// Delete session and its messages
router.delete('/:sessionId', sessionController.deleteSession);

module.exports = router;
