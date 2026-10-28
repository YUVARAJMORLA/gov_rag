const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { isMongoActive } = require('../config/db');
const { MongoUser, MongoChatSession, MongoChatMessage } = require('./schemas');

const DATA_DIR = path.join(__dirname, '../../data');

const getFilePath = (name) => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return path.join(DATA_DIR, `${name}.json`);
};

const readLocalData = (name) => {
  const filePath = getFilePath(name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
};

const writeLocalData = (name, items) => {
  const filePath = getFilePath(name);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
};

// Generic match helper for simple Mongo-like queries
const matchesQuery = (item, query = {}) => {
  for (const [key, val] of Object.entries(query)) {
    if (key === '_id' || key === 'id') {
      const itemKey = item._id || item.id;
      if (String(itemKey) !== String(val)) return false;
    } else if (key === 'userId') {
      if (String(item.userId) !== String(val)) return false;
    } else if (key === 'sessionId') {
      if (String(item.sessionId) !== String(val)) return false;
    } else if (typeof val === 'object' && val !== null) {
      // support $ne
      if (val.$ne !== undefined && item[key] === val.$ne) return false;
    } else if (item[key] !== val) {
      return false;
    }
  }
  return true;
};

// ==================================================================
// USER REPOSITORY
// ==================================================================
const User = {
  async findOne(query) {
    if (isMongoActive()) return await MongoUser.findOne(query);
    const users = readLocalData('users');
    const u = users.find((item) => matchesQuery(item, query));
    return u ? { ...u } : null;
  },

  async findById(id) {
    if (isMongoActive()) return await MongoUser.findById(id);
    const users = readLocalData('users');
    const u = users.find((item) => String(item._id || item.id) === String(id));
    return u ? { ...u } : null;
  },

  async find(query = {}) {
    if (isMongoActive()) return await MongoUser.find(query).sort({ createdAt: -1 });
    const users = readLocalData('users');
    return users.filter((item) => matchesQuery(item, query)).reverse();
  },

  async create(data) {
    if (isMongoActive()) return await MongoUser.create(data);
    const users = readLocalData('users');
    const newUser = {
      _id: uuidv4(),
      ...data,
      createdAt: data.createdAt || new Date().toISOString()
    };
    users.push(newUser);
    writeLocalData('users', users);
    return { ...newUser };
  },

  async findByIdAndUpdate(id, update, options = {}) {
    if (isMongoActive()) return await MongoUser.findByIdAndUpdate(id, update, options);
    const users = readLocalData('users');
    const idx = users.findIndex((item) => String(item._id || item.id) === String(id));
    if (idx === -1) return null;

    const fieldsToUpdate = update.$set ? { ...update.$set } : { ...update };
    users[idx] = { ...users[idx], ...fieldsToUpdate };
    writeLocalData('users', users);
    return { ...users[idx] };
  },

  async countDocuments(query = {}) {
    if (isMongoActive()) return await MongoUser.countDocuments(query);
    const users = readLocalData('users');
    return users.filter((item) => matchesQuery(item, query)).length;
  }
};

// ==================================================================
// CHAT SESSION REPOSITORY
// ==================================================================
const ChatSession = {
  async find(query = {}) {
    if (isMongoActive()) return await MongoChatSession.find(query).sort({ updatedAt: -1 });
    const sessions = readLocalData('sessions');
    return sessions
      .filter((item) => matchesQuery(item, query))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  },

  async findById(id) {
    if (isMongoActive()) return await MongoChatSession.findById(id);
    const sessions = readLocalData('sessions');
    const s = sessions.find((item) => String(item._id || item.id) === String(id));
    return s ? { ...s } : null;
  },

  async findOne(query) {
    if (isMongoActive()) return await MongoChatSession.findOne(query);
    const sessions = readLocalData('sessions');
    const s = sessions.find((item) => matchesQuery(item, query));
    return s ? { ...s } : null;
  },

  async create(data) {
    if (isMongoActive()) return await MongoChatSession.create(data);
    const sessions = readLocalData('sessions');
    const newSession = {
      _id: uuidv4(),
      title: data.title || 'New Conversation',
      userId: String(data.userId),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    };
    sessions.push(newSession);
    writeLocalData('sessions', sessions);
    return { ...newSession };
  },

  async findByIdAndUpdate(id, update, options = {}) {
    if (isMongoActive()) return await MongoChatSession.findByIdAndUpdate(id, update, options);
    const sessions = readLocalData('sessions');
    const idx = sessions.findIndex((item) => String(item._id || item.id) === String(id));
    if (idx === -1) return null;

    const fieldsToUpdate = update.$set ? { ...update.$set } : { ...update };
    sessions[idx] = { ...sessions[idx], ...fieldsToUpdate, updatedAt: new Date().toISOString() };
    writeLocalData('sessions', sessions);
    return { ...sessions[idx] };
  },

  async deleteOne(query) {
    if (isMongoActive()) return await MongoChatSession.deleteOne(query);
    let sessions = readLocalData('sessions');
    const initialLen = sessions.length;
    sessions = sessions.filter((item) => !matchesQuery(item, query));
    writeLocalData('sessions', sessions);
    return { deletedCount: initialLen - sessions.length };
  }
};

// ==================================================================
// CHAT MESSAGE REPOSITORY
// ==================================================================
const ChatMessage = {
  async find(query = {}) {
    if (isMongoActive()) return await MongoChatMessage.find(query).sort({ createdAt: 1 });
    const messages = readLocalData('messages');
    return messages
      .filter((item) => matchesQuery(item, query))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async findOne(query) {
    if (isMongoActive()) return await MongoChatMessage.findOne(query);
    const messages = readLocalData('messages');
    const m = messages.find((item) => matchesQuery(item, query));
    return m ? { ...m } : null;
  },

  async create(data) {
    if (isMongoActive()) return await MongoChatMessage.create(data);
    const messages = readLocalData('messages');
    const newMsg = {
      _id: uuidv4(),
      ...data,
      sessionId: String(data.sessionId),
      userId: String(data.userId),
      createdAt: data.createdAt || new Date().toISOString()
    };
    messages.push(newMsg);
    writeLocalData('messages', messages);
    return { ...newMsg };
  },

  async updateOne(query, update) {
    if (isMongoActive()) return await MongoChatMessage.updateOne(query, update);
    const messages = readLocalData('messages');
    const idx = messages.findIndex((item) => matchesQuery(item, query));
    if (idx === -1) return { modifiedCount: 0 };

    const fieldsToUpdate = update.$set ? { ...update.$set } : { ...update };
    messages[idx] = { ...messages[idx], ...fieldsToUpdate };
    writeLocalData('messages', messages);
    return { modifiedCount: 1 };
  },

  async deleteMany(query) {
    if (isMongoActive()) return await MongoChatMessage.deleteMany(query);
    let messages = readLocalData('messages');
    const initialLen = messages.length;
    messages = messages.filter((item) => !matchesQuery(item, query));
    writeLocalData('messages', messages);
    return { deletedCount: initialLen - messages.length };
  },

  async countDocuments(query = {}) {
    if (isMongoActive()) return await MongoChatMessage.countDocuments(query);
    const messages = readLocalData('messages');
    return messages.filter((item) => matchesQuery(item, query)).length;
  }
};

module.exports = {
  User,
  ChatSession,
  ChatMessage
};
