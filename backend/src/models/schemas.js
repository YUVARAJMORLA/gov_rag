const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  ssnHash: { type: String, required: true },
  ssnLast4: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null }
});

const ChatSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: 'New Conversation' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ChatMessageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  questionId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  maskedContent: { type: String, default: '' },
  modelUsed: { type: String, default: 'Auto' },
  retrievedChunks: { type: [String], default: [] },
  retrievedScores: { type: [Number], default: [] },
  metrics: {
    latencyMs: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    inputCost: { type: Number, default: 0 },
    outputCost: { type: Number, default: 0 },
    llmAbleToAnswer: { type: Boolean, default: true },
    piiMasked: { type: Boolean, default: false },
    injectionDetected: { type: Boolean, default: false }
  },
  feedbackRating: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});


const MongoUser = mongoose.model('User', UserSchema);
const MongoChatSession = mongoose.model('ChatSession', ChatSessionSchema);
const MongoChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

module.exports = {
  MongoUser,
  MongoChatSession,
  MongoChatMessage
};
