const { ChatSession, ChatMessage } = require('../models/store');

// 1. GET ALL SESSIONS FOR CURRENT USER (Strict Isolation)
exports.getUserSessions = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const sessions = await ChatSession.find({ userId });

    // Fetch message counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (s) => {
        const sId = String(s._id || s.id);
        const count = await ChatMessage.countDocuments({ sessionId: sId, userId });
        return {
          id: sId,
          _id: sId,
          title: s.title,
          userId: s.userId,
          messageCount: count,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        };
      })
    );

    return res.json({
      success: true,
      sessions: sessionsWithCounts
    });
  } catch (err) {
    console.error('[GET SESSIONS ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user chat sessions.'
    });
  }
};

// 2. CREATE NEW SESSION
exports.createSession = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const title = req.body.title || 'New Conversation';

    const newSession = await ChatSession.create({
      userId,
      title: title.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const sId = String(newSession._id || newSession.id);

    return res.status(201).json({
      success: true,
      session: {
        id: sId,
        _id: sId,
        title: newSession.title,
        userId: newSession.userId,
        messageCount: 0,
        createdAt: newSession.createdAt,
        updatedAt: newSession.updatedAt
      }
    });
  } catch (err) {
    console.error('[CREATE SESSION ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create new chat session.'
    });
  }
};

// 3. GET MESSAGES FOR A SPECIFIC SESSION (Strict Ownership Verification)
exports.getSessionMessages = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const { sessionId } = req.params;

    // Strict Isolation Check: Ensure session belongs to this user
    let session = await ChatSession.findById(sessionId);
    if (!session) {
      session = await ChatSession.findOne({ _id: sessionId });
    }
    if (!session || String(session.userId) !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or you do not have permission to access it.'
      });
    }

    const messages = await ChatMessage.find({ sessionId: String(sessionId), userId });

    return res.json({
      success: true,
      session: {
        id: String(session._id || session.id),
        title: session.title,
        userId: session.userId,
        userName: req.user.username,
        createdAt: session.createdAt
      },
      messages: messages.map((m) => ({
        id: String(m._id || m.id),
        _id: String(m._id || m.id),
        sessionId: String(m.sessionId),
        userId: String(m.userId),
        userName: req.user.username,
        questionId: m.questionId,
        role: m.role,
        content: m.content,
        maskedContent: m.maskedContent,
        modelUsed: m.modelUsed,
        retrievedChunks: m.retrievedChunks || [],
        retrievedScores: m.retrievedScores || [],
        metrics: m.metrics || {},
        feedbackRating: m.feedbackRating,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    console.error('[GET SESSION MESSAGES ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve session messages.'
    });
  }
};


// 4. RENAME SESSION
exports.renameSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Session title cannot be empty.'
      });
    }

    // Verify ownership
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied.'
      });
    }

    const updated = await ChatSession.findByIdAndUpdate(
      sessionId,
      { title: title.trim(), updatedAt: new Date().toISOString() },
      { new: true }
    );

    return res.json({
      success: true,
      session: {
        id: String(updated._id || updated.id),
        title: updated.title,
        updatedAt: updated.updatedAt
      }
    });
  } catch (err) {
    console.error('[RENAME SESSION ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to rename chat session.'
    });
  }
};

// 5. DELETE SESSION & ITS MESSAGES
exports.deleteSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.params;

    // Verify ownership
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied.'
      });
    }

    await ChatMessage.deleteMany({ sessionId, userId });
    await ChatSession.deleteOne({ _id: sessionId, userId });

    return res.json({
      success: true,
      message: 'Chat session and history successfully deleted.'
    });
  } catch (err) {
    console.error('[DELETE SESSION ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete chat session.'
    });
  }
};
