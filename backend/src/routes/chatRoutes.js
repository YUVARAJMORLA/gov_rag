const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticate = require('../middleware/auth');

// All chat endpoints require valid JWT authentication
router.use(authenticate);

// Send text query or transcribed voice turn
router.post('/query', chatController.sendQuery);

// Submit feedback rating (1-5 stars) linked to questionId
router.post('/feedback', chatController.submitFeedback);

// Synthesize high-quality neural speech audio (Telugu, Hindi, Nova Sonic)
router.post('/synthesize-speech', chatController.synthesizeSpeech);

// Launch Microsoft Edge on Windows for enterprise speech services
router.post('/launch-edge', chatController.launchEdge);

module.exports = router;

