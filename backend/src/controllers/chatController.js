const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { ChatSession, ChatMessage } = require('../models/store');

const PYTHON_BRIDGE_URL = process.env.PYTHON_BRIDGE_URL || 'http://127.0.0.1:5001';

// 1. SEND CHAT QUERY (Text or Transcribed Voice)
exports.sendQuery = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, query, model = 'Auto', numResults = 5, targetLanguage = 'en' } = req.body;

    if (!sessionId || !query || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Both sessionId and a non-empty query are required.'
      });
    }

    // Verify session ownership
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or access denied.'
      });
    }

    const questionId = uuidv4();

    // Determine if this is the first interaction in this session
    const priorUserMessagesCount = await ChatMessage.countDocuments({ sessionId, role: 'user' });
    const isFirstTurn = priorUserMessagesCount === 0;

    // 1. Record User Prompt in MongoDB (Private to this user)
    const userMsg = await ChatMessage.create({
      sessionId,
      userId,
      questionId,
      role: 'user',
      content: query.trim(),
      maskedContent: query.trim(),
      createdAt: new Date().toISOString()
    });

    // 2. Call Python RAG Engine (Invokes Guardrails, Vector Search, Bedrock / Databricks LLM)
    // Telemetry and anonymous question_id are logged to Databricks tables by Python service.
    // Notice: User identity (SSN, name, email) is NOT passed to Databricks!
    let ragResponse = null;
    try {
      const response = await axios.post(`${PYTHON_BRIDGE_URL}/api/rag/query`, {
        query: query.trim(),
        model,
        num_results: Number(numResults) || 5,
        is_first_turn: isFirstTurn,
        target_language: targetLanguage
      }, { timeout: 60000 });

      if (response.data && response.data.success) {
        ragResponse = response.data.data;
      } else {
        throw new Error(response.data?.error || 'RAG engine returned unsuccessful response');
      }
    } catch (pyErr) {
      console.error('[PYTHON RAG CALL ERROR]', pyErr.message);
      // Fallback response if python service is temporarily busy or starting
      ragResponse = {
        question_id: questionId,
        answer: `I received your query regarding government schemes: "${query.trim()}". However, the AI inference engine is currently processing higher traffic or reconnecting. Please retry in a few moments.`,
        model_used: model || 'Fallback',
        masked_question: query.trim(),
        retrieved_chunks: [],
        retrieved_scores: [],
        latency_ms: 120,
        input_tokens: 0,
        output_tokens: 0,
        input_cost: 0,
        output_cost: 0,
        llm_able_to_answer: false,
        security: { pii_masked: false, injection_detected: false }
      };
    }

    // Sync questionId if Python generated a separate one
    const finalQuestionId = ragResponse.question_id || questionId;

    // 3. Record Assistant Response in MongoDB under user's private session
    const assistantMsg = await ChatMessage.create({
      sessionId,
      userId,
      questionId: finalQuestionId,
      role: 'assistant',
      content: ragResponse.answer,
      maskedContent: ragResponse.masked_question || query.trim(),
      modelUsed: ragResponse.model_used || model,
      retrievedChunks: ragResponse.retrieved_chunks || [],
      retrievedScores: ragResponse.retrieved_scores || [],
      metrics: {
        latencyMs: ragResponse.latency_ms || 0,
        inputTokens: ragResponse.input_tokens || 0,
        outputTokens: ragResponse.output_tokens || 0,
        inputCost: ragResponse.input_cost || 0,
        outputCost: ragResponse.output_cost || 0,
        llmAbleToAnswer: ragResponse.llm_able_to_answer !== undefined ? ragResponse.llm_able_to_answer : true,
        piiMasked: ragResponse.security?.pii_masked || false,
        piiCategories: ragResponse.security?.pii_categories || [],
        injectionDetected: ragResponse.security?.injection_detected || false,
        injectionCategory: ragResponse.security?.injection_category || null,
        injectionCategories: ragResponse.security?.injection_categories || [],
        safetyViolated: ragResponse.security?.safety_violated || false,
        safetyCategories: ragResponse.security?.safety_categories || [],
        hasMultipleThreats: ragResponse.security?.has_multiple_threats || false
      },
      createdAt: new Date().toISOString()
    });

    // Auto rename session if it has default title
    let updatedSessionTitle = session.title;
    if (
      !session.title ||
      session.title === 'New Conversation' ||
      session.title === 'Welcome Session' ||
      session.title.startsWith('Inquiry #')
    ) {
      const trimmedQuery = query.trim();
      updatedSessionTitle = trimmedQuery.length > 36 ? trimmedQuery.substring(0, 33) + '...' : trimmedQuery;
      await ChatSession.findByIdAndUpdate(sessionId, {
        title: updatedSessionTitle,
        updatedAt: new Date().toISOString()
      });
    } else {
      await ChatSession.findByIdAndUpdate(sessionId, {
        updatedAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      questionId: finalQuestionId,
      sessionTitle: updatedSessionTitle,
      userMessage: {
        id: String(userMsg._id || userMsg.id),
        questionId: finalQuestionId,
        role: 'user',
        content: userMsg.content,
        createdAt: userMsg.createdAt
      },
      assistantMessage: {
        id: String(assistantMsg._id || assistantMsg.id),
        questionId: finalQuestionId,
        role: 'assistant',
        content: assistantMsg.content,
        maskedContent: assistantMsg.maskedContent,
        modelUsed: assistantMsg.modelUsed,
        audioBase64: ragResponse.audio_base64 || null,
        retrievedChunks: assistantMsg.retrievedChunks,
        retrievedScores: assistantMsg.retrievedScores,
        metrics: assistantMsg.metrics,
        createdAt: assistantMsg.createdAt
      }
    });
  } catch (err) {
    console.error('[SEND QUERY ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing your question.'
    });
  }
};

// 2. SUBMIT FEEDBACK (1-5 RATING) - Idempotent
exports.submitFeedback = async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id);
    const { questionId, rating, feedbackText, sessionId } = req.body;

    if (!questionId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'questionId and numeric rating (1-5) are required.'
      });
    }

    // Check if feedback was already recorded for this question to prevent duplicate Databricks rows
    const existingMsg = await ChatMessage.findOne({ questionId, userId });
    if (existingMsg && existingMsg.feedbackRating !== null && existingMsg.feedbackRating !== undefined) {
      return res.json({
        success: true,
        alreadySubmitted: true,
        message: `Feedback rating of ${existingMsg.feedbackRating}/5 is already recorded!`
      });
    }

    // 1. Update message in MongoDB
    await ChatMessage.updateOne(
      { questionId, userId },
      { $set: { feedbackRating: Number(rating) } }
    );

    // 2. Forward to Python service to log into Databricks rag_feedback table
    try {
      await axios.post(`${PYTHON_BRIDGE_URL}/api/databricks/feedback`, {
        question_id: questionId,
        rating: Number(rating),
        feedback: feedbackText || `rating_${rating}`
      }, { timeout: 10000 });
    } catch (dbErr) {
      console.warn('[DATABRICKS FEEDBACK LOG WARNING]', dbErr.message);
    }

    return res.json({
      success: true,
      message: `Feedback rating of ${rating}/5 successfully recorded!`
    });

  } catch (err) {
    console.error('[FEEDBACK ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to record feedback.'
    });
  }
};

// 3. SYNTHESIZE SPEECH (Neural TTS for Telugu, Hindi, Nova Sonic)
exports.synthesizeSpeech = async (req, res) => {
  try {
    const { text, targetLanguage = 'en', voiceGender = 'Female', isNovaSonic = false } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required for speech synthesis.' });
    }

    const response = await axios.post(`${PYTHON_BRIDGE_URL}/api/voice/synthesize`, {
      text: text.trim(),
      target_language: targetLanguage,
      voice_gender: voiceGender,
      is_nova_sonic: isNovaSonic
    }, { timeout: 30000 });

    if (response.data && response.data.success) {
      return res.json({
        success: true,
        audioBase64: response.data.audio_base64,
        targetLanguage
      });
    } else {
      return res.status(500).json({
        success: false,
        error: response.data?.error || 'Speech synthesis failed'
      });
    }
  } catch (err) {
    console.error('[SPEECH SYNTHESIS CONTROLLER ERROR]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to synthesize speech audio.'
    });
  }
};

// 4. LAUNCH MICROSOFT EDGE (For Enterprise Speech Recognition)
exports.launchEdge = async (req, res) => {
  try {
    const { exec } = require('child_process');
    const targetUrl = req.body?.url || 'http://localhost:3000';
    exec(`start msedge "${targetUrl}"`, (err) => {
      if (err) {
        console.warn('[LAUNCH EDGE NOTICE]', err.message);
      }
    });
    return res.json({
      success: true,
      message: 'Launching Microsoft Edge for Windows speech recognition...'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

