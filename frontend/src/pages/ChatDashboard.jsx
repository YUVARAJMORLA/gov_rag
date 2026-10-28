import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionAPI, chatAPI } from '../services/api';
import { voiceAssistant, cleanSpeechRepetitions } from '../services/speechService';
import {
  MessageSquare, Plus, Trash2, Edit2, Check, X, Send, Mic, MicOff,
  Volume2, VolumeX, Shield, User, LogOut, ChevronDown, ChevronRight,
  Star, Sparkles, Terminal, Activity, Layers, Cpu, CheckCircle2, AlertTriangle, ShieldAlert,
  Radio, PhoneOff, Repeat, Menu, Globe, Palette, Type, Sliders, Eye, CheckCheck,
  PanelLeft, PanelLeftClose
} from 'lucide-react';


export const ChatDashboard = ({ onNavigate }) => {
  const { user, isAdmin, logout } = useAuth();

  // Dynamic Color Theme (8 rich accessibility-tested themes)
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('gov_rag_theme') || 'default-dark';
  });

  // Dynamic Typography & Accessibility states (Synced with Admin Console)
  const [textSize, setTextSize] = useState(() => localStorage.getItem('gov_rag_text_size') || 'normal');
  const [lineHeight, setLineHeight] = useState(() => localStorage.getItem('gov_rag_line_height') || 'normal');
  const [indicMode, setIndicMode] = useState(() => localStorage.getItem('gov_rag_indic_mode') !== 'false');
  const [isTextMenuOpen, setIsTextMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('gov_rag_theme', currentTheme);
  }, [currentTheme]);

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('gov_rag_theme', newTheme);
  };

  const applyTextSize = (size) => {
    setTextSize(size);
    document.documentElement.setAttribute('data-text-size', size);
    localStorage.setItem('gov_rag_text_size', size);
  };

  const applyLineHeight = (lh) => {
    setLineHeight(lh);
    document.documentElement.setAttribute('data-line-height', lh);
    localStorage.setItem('gov_rag_line_height', lh);
  };

  const toggleIndicMode = () => {
    const next = !indicMode;
    setIndicMode(next);
    document.documentElement.setAttribute('data-indic-mode', String(next));
    localStorage.setItem('gov_rag_indic_mode', String(next));
  };

  const applyElderPreset = () => {
    applyTextSize('large');
    applyLineHeight('spacious');
    setIndicMode(true);
    document.documentElement.setAttribute('data-indic-mode', 'true');
    localStorage.setItem('gov_rag_indic_mode', 'true');
    handleThemeChange('elder-high-contrast');
  };

  const resetTypography = () => {
    applyTextSize('normal');
    applyLineHeight('normal');
    setIndicMode(true);
    document.documentElement.setAttribute('data-indic-mode', 'true');
    localStorage.setItem('gov_rag_indic_mode', 'true');
  };

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Desktop & Mobile Collapsible Sidebar State (ChatGPT feature)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('gov_rag_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('gov_rag_sidebar_open', String(next));
      return next;
    });
    // On mobile screens, also toggle drawer
    setIsMobileSidebarOpen((prev) => !prev);
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar like ChatGPT
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Beta Regional Translation State (English / Hindi / Telugu)
  const [targetLanguage, setTargetLanguage] = useState('en');

  // Input & Query state
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('Auto');
  const [lastNormalModel, setLastNormalModel] = useState('Auto');
  const [numResults, setNumResults] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingSessionId, setSubmittingSessionId] = useState(null);

  // Active Session Ref to prevent async convo bleeding
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Voice modes & state
  // voiceMode: 'type1' = Push-to-Talk (Normal Chat Models) | 'type2' = Voice-to-Voice Hands-Free (Exclusively Nova Sonic 2.5)
  const [voiceMode, setVoiceMode] = useState('type1');
  const [autoSendVoice, setAutoSendVoice] = useState(() => {
    const saved = localStorage.getItem('gov_rag_auto_send');
    return saved !== null ? saved === 'true' : true;
  });
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [autoSpeakAnswers, setAutoSpeakAnswers] = useState(false);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState('');
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState(null);
  const [isHandsFreeActive, setIsHandsFreeActive] = useState(false);
  const handsFreeActiveRef = useRef(false);

  // Available Speech Synthesis Voices (Male and Female)
  const [voiceList, setVoiceList] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');

  useEffect(() => {
    voiceAssistant.setLanguage(targetLanguage);
    const list = voiceAssistant.getAvailableVoices();
    setVoiceList(list);
    const saved = voiceAssistant.getSelectedVoice();
    if (saved) {
      setSelectedVoiceId(saved);
    } else if (list.length > 0) {
      const def = list[0].id;
      setSelectedVoiceId(def);
      voiceAssistant.setSelectedVoice(def);
    }

    voiceAssistant.onVoicesChanged((updated) => {
      setVoiceList(updated);
      const current = voiceAssistant.getSelectedVoice();
      if (current) {
        setSelectedVoiceId(current);
      } else if (updated.length > 0) {
        const def = updated[0].id;
        setSelectedVoiceId(def);
        voiceAssistant.setSelectedVoice(def);
      }
    });
  }, [targetLanguage]);

  const handleSelectVoice = (newVoiceId) => {
    setSelectedVoiceId(newVoiceId);
    voiceAssistant.setSelectedVoice(newVoiceId);
  };

  const handlePreviewVoice = () => {
    let previewText = 'Hello! This is your government schemes voice assistant. Ready to assist.';
    if (targetLanguage === 'hi') {
      previewText = 'नमस्ते! यह आपका सरकारी योजना सहायक स्वर है। मैं आपकी सहायता के लिए तैयार हूँ।';
    } else if (targetLanguage === 'te') {
      previewText = 'నమస్కారం! ఇది మీ ప్రభుత్వ సంక్షేమ పథకాల ఏఐ స్వరం. నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.';
    }
    voiceAssistant.speakMultilingual({
      text: previewText,
      targetLanguage,
      preferredVoiceId: selectedVoiceId,
      isNovaSonic: selectedModel === 'amazon.nova-2-5-sonic'
    });
  };

  // Dynamic model switcher: Normal chat models for Type 1, Nova Sonic exclusively for Type 2
  const handleModelChange = (newModel) => {
    if (newModel === 'amazon.nova-2-5-sonic') {
      setVoiceMode('type2');
      setSelectedModel('amazon.nova-2-5-sonic');
      setAutoSpeakAnswers(true);
      setAutoSendVoice(true);
      if (targetLanguage === 'en') {
        setSelectedVoiceId('nova-sonic-voice');
        voiceAssistant.setSelectedVoice('nova-sonic-voice');
      }
      setVoiceStatusNotice('⚡ Amazon Nova 2.5 Sonic Voice-to-Voice activated');
      setTimeout(() => setVoiceStatusNotice(''), 3000);
      if (!isHandsFreeActive) {
        startContinuousVoice();
      }
    } else {
      setSelectedModel(newModel);
      setLastNormalModel(newModel);
      if (voiceMode === 'type2') {
        setVoiceMode('type1');
        if (isHandsFreeActive) stopContinuousVoice();
      }
      const modelLabels = {
        'Auto': 'Auto (Gemma 3 12B IT)',
        'google.gemma-3-12b-it': 'Google Gemma 3 12B IT',
        'nvidia.nemotron-super-3-120b': 'NVIDIA Nemotron 120B',
        'mistral.devstral-2-123b': 'Mistral Devstral 123B',
        'databricks-meta-llama-3-3-70b-instruct': 'Databricks Llama 3.3 70B'
      };
      setVoiceStatusNotice(`🤖 Switched to chat model: ${modelLabels[newModel] || newModel}`);
      setTimeout(() => setVoiceStatusNotice(''), 2500);
    }
  };

  // Launch Microsoft Edge for native Windows Speech Services
  const handleLaunchEdge = async () => {
    try {
      setVoiceStatusNotice('🚀 Launching Microsoft Edge for Windows speech recognition...');
      const targetUrl = window.location.origin;
      await chatAPI.launchEdge(targetUrl);
      setTimeout(() => {
        setVoiceStatusNotice('✅ Microsoft Edge opened! Please continue in Edge where Windows speech is active.');
      }, 1500);
    } catch (_) {
      window.location.href = `microsoft-edge:${window.location.origin}/`;
    }
  };

  // Rename session inline state
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Expanded telemetry cards (Admin only)
  const [expandedTelemetry, setExpandedTelemetry] = useState({});

  // Feedback states
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [submittingFeedback, setSubmittingFeedback] = useState({});

  const chatEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, voiceStatusNotice]);

  // Load user sessions on mount or when user changes
  useEffect(() => {
    loadSessions();
  }, [user?.id]);

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await sessionAPI.getSessions();
      if (res.data?.success) {
        const userSessions = res.data.sessions || [];
        setSessions(userSessions);
        if (userSessions.length > 0) {
          const firstId = userSessions[0].id || userSessions[0]._id;
          setActiveSessionId(firstId);
          loadSessionMessages(firstId);
        } else {
          // Auto create initial session
          handleCreateSession();
        }
      }
    } catch (err) {
      console.error('Failed to load user sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSelectSession = (sId) => {
    setIsMobileSidebarOpen(false);
    if (sId === activeSessionId) return;
    setActiveSessionId(sId);
    loadSessionMessages(sId);
  };

  const loadSessionMessages = async (sId) => {
    try {
      setMessagesLoading(true);
      const res = await sessionAPI.getSessionMessages(sId);
      if (res.data?.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages for session:', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleCreateSession = async () => {
    setIsMobileSidebarOpen(false);
    try {
      const res = await sessionAPI.createSession(`New Conversation`);
      if (res.data?.success) {
        const newS = res.data.session;
        setSessions([newS, ...sessions]);
        setActiveSessionId(newS.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = async (sId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this session and its history?')) return;

    try {
      await sessionAPI.deleteSession(sId);
      const remaining = sessions.filter((s) => s.id !== sId);
      setSessions(remaining);
      if (activeSessionId === sId) {
        if (remaining.length > 0) {
          const nextId = remaining[0].id || remaining[0]._id;
          setActiveSessionId(nextId);
          loadSessionMessages(nextId);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleStartRename = (s, e) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitle(s.title);
  };

  const handleSaveRename = async (sId, e) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      await sessionAPI.renameSession(sId, editTitle.trim());
      setSessions(sessions.map((s) => (s.id === sId ? { ...s, title: editTitle.trim() } : s)));
      setEditingSessionId(null);
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  // Submit User Query
  const handleSendMessage = async (textToSend = null, isFromVoice = false) => {
    const text = (textToSend !== null ? textToSend : inputText).trim();
    if (!text || (submittingSessionId && submittingSessionId === activeSessionId)) return;

    let currSessionId = activeSessionId;
    if (!currSessionId) {
      try {
        const initTitle = text.length > 36 ? text.substring(0, 33) + '...' : text;
        const res = await sessionAPI.createSession(initTitle);
        currSessionId = res.data.session.id;
        setSessions([res.data.session, ...sessions]);
        setActiveSessionId(currSessionId);
      } catch (e) {
        return;
      }
    }

    setInputText('');
    setInterimText('');
    setIsSubmitting(true);
    setSubmittingSessionId(currSessionId);
    if (isFromVoice) {
      setVoiceStatusNotice(`⚡ Querying government schemes for: "${text}"...`);
    }

    // Optimistic UI user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };

    // Only add optimistic user message to view if still on this session
    if (activeSessionIdRef.current === currSessionId) {
      setMessages((prev) => [...prev, tempUserMsg]);
    }

    // Auto-detect Indic script (Telugu or Hindi) or Romanized keywords
    let effectiveLanguage = targetLanguage;
    if (
      /[\u0C00-\u0C7F]/.test(text) ||
      /\b(cheyali|cheyandi|arhatalu|pathakam|padhakam|dabbu|dabbulu|kavali|darakhastu|ento|telupandi|raithu|rythu)\b/i.test(text)
    ) {
      effectiveLanguage = 'te';
      if (targetLanguage !== 'te') {
        setTargetLanguage('te');
        voiceAssistant.setLanguage('te');
      }
    } else if (
      /[\u0900-\u097F]/.test(text) ||
      /\b(kaise|karein|karna|patrata|kitna|kitne|paise|rupya|bataiye|chahiye|dastavez|kagaz|kisko|milega)\b/i.test(text)
    ) {
      effectiveLanguage = 'hi';
      if (targetLanguage !== 'hi') {
        setTargetLanguage('hi');
        voiceAssistant.setLanguage('hi');
      }
    }

    try {
      const modelToUse = voiceMode === 'type2'
        ? 'amazon.nova-2-5-sonic'
        : (selectedModel === 'amazon.nova-2-5-sonic' ? (lastNormalModel || 'Auto') : selectedModel);
      const isVoiceTurn = Boolean(isFromVoice || voiceMode === 'type2');
      const res = await chatAPI.sendQuery(currSessionId, text, modelToUse, numResults, effectiveLanguage, isVoiceTurn);
      if (res.data?.success) {
        const { assistantMessage, sessionTitle } = res.data;

        // CRITICAL BUG FIX: Only inject response if citizen is STILL viewing this session!
        if (activeSessionIdRef.current === currSessionId) {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempUserMsg.id),
            res.data.userMessage,
            assistantMessage
          ]);
        }

        // Auto rename session from first question
        if (sessionTitle) {
          setSessions((prev) =>
            prev.map((s) => (s.id === currSessionId ? { ...s, title: sessionTitle } : s))
          );
        } else {
          const currentSession = sessions.find((s) => s.id === currSessionId);
          if (
            currentSession &&
            (currentSession.title.startsWith('New') ||
             currentSession.title.startsWith('Inquiry #') ||
             currentSession.title === 'Welcome Session')
          ) {
            const autoTitle = text.length > 36 ? `${text.slice(0, 33)}...` : text;
            sessionAPI.renameSession(currSessionId, autoTitle);
            setSessions((prev) =>
              prev.map((s) => (s.id === currSessionId ? { ...s, title: autoTitle } : s))
            );
          }
        }

        // Voice handling (Only if currently in active session)
        if (activeSessionIdRef.current === currSessionId) {
          const isNova = selectedModel === 'amazon.nova-2-5-sonic' || (assistantMessage?.modelUsed || '').toLowerCase().includes('nova') || voiceMode === 'type2';
          if (handsFreeActiveRef.current && assistantMessage?.content) {
            // Type 2 Continuous Voice-to-Voice: speak answer aloud in matched language, then auto-listen again
            setVoiceStatusNotice(effectiveLanguage === 'hi' ? '⏳ आवाज़ तैयार हो रही है...' : (effectiveLanguage === 'te' ? '⏳ ఆడియో సిద్ధమవుతోంది...' : '⏳ Preparing Amazon Nova 2.5 Sonic voice response...'));
            voiceAssistant.speakMultilingual({
              text: assistantMessage.content,
              targetLanguage: effectiveLanguage,
              preferredVoiceId: (isNova && effectiveLanguage === 'en') ? 'nova-sonic-voice' : selectedVoiceId,
              audioBase64: assistantMessage?.audioBase64,
              isNovaSonic: isNova,
              onStart: () => {
                setCurrentlySpeakingId(assistantMessage.id);
                setVoiceStatusNotice(effectiveLanguage === 'hi' ? '🔊 सहायक उत्तर बोल रहा है...' : (effectiveLanguage === 'te' ? '🔊 సహాయకుడు సమాధానం చెబుతున్నాడు...' : '🔊 Amazon Nova 2.5 Sonic speaking response aloud...'));
              },
              onEnd: () => {
                setCurrentlySpeakingId(null);
                if (handsFreeActiveRef.current && activeSessionIdRef.current === currSessionId) {
                  const notice = effectiveLanguage === 'hi' ? '🎙️ सुन रहा हूँ... अगला प्रश्न बोलिए' : (effectiveLanguage === 'te' ? '🎙️ వింటున్నాను... తర్వాతి ప్రశ్న మాట్లాడండి' : '🎙️ Nova Sonic listening... Speak your next question');
                  setVoiceStatusNotice(notice);
                  setTimeout(() => {
                    if (handsFreeActiveRef.current && activeSessionIdRef.current === currSessionId) {
                      startContinuousVoiceListen();
                    }
                  }, 350);
                } else {
                  setVoiceStatusNotice('');
                }
              }
            });
          } else if ((isFromVoice || autoSpeakAnswers) && assistantMessage?.content) {
            // Type 1 Push-to-Talk OR Voice Out: speak answer aloud in synchronized, matched language
            playVoiceResponse(assistantMessage.id, assistantMessage.content, assistantMessage?.audioBase64, assistantMessage?.modelUsed);
          }
        }
      }
    } catch (err) {
      console.error('Chat query error:', err);
      if (activeSessionIdRef.current === currSessionId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ We encountered an issue communicating with the AI pipeline. Please try again in a few moments.',
            createdAt: new Date().toISOString()
          }
        ]);
      }
      if (handsFreeActiveRef.current && activeSessionIdRef.current === currSessionId) {
        setVoiceStatusNotice('⚠️ Inquiry error. You may ask again or click End Voice Session.');
        setTimeout(() => {
          if (handsFreeActiveRef.current && activeSessionIdRef.current === currSessionId) {
            startContinuousVoiceListen();
          }
        }, 2000);
      }
    } finally {
      setIsSubmitting(false);
      setSubmittingSessionId((cur) => (cur === currSessionId ? null : cur));
      if (!handsFreeActiveRef.current) {
        setVoiceStatusNotice('');
      }
    }
  };

  // Continuous Voice to Voice (Type 2 - Powered by Amazon Nova 2.5 Sonic)
  const startContinuousVoice = () => {
    setIsHandsFreeActive(true);
    handsFreeActiveRef.current = true;
    setVoiceMode('type2');
    setSelectedModel('amazon.nova-2-5-sonic');
    setAutoSpeakAnswers(true);
    setAutoSendVoice(true);
    if (targetLanguage === 'en') {
      setSelectedVoiceId('nova-sonic-voice');
      voiceAssistant.setSelectedVoice('nova-sonic-voice');
    }
    setVoiceStatusNotice('⚡ Amazon Nova 2.5 Sonic Voice-to-Voice active (Ultra Low-Latency Voice AI)');
    startContinuousVoiceListen();
  };

  const stopContinuousVoice = () => {
    setIsHandsFreeActive(false);
    handsFreeActiveRef.current = false;
    voiceAssistant.stopListening();
    voiceAssistant.stopSpeaking();
    setIsListening(false);
    setVoiceStatusNotice('');
    setCurrentlySpeakingId(null);
  };

  const startContinuousVoiceListen = () => {
    if (!handsFreeActiveRef.current) return;
    const activeMicLang = targetLanguage;
    setVoiceStatusNotice('⏳ Connecting Nova Sonic voice microphone...');
    voiceAssistant.startListening({
      lang: activeMicLang,
      onStart: () => {
        setIsListening(true);
        setVoiceStatusNotice(
          activeMicLang === 'hi'
            ? '🎙️ आवाज़ सुन रहा हूँ... पूरा प्रश्न बोलिए'
            : (activeMicLang === 'te'
              ? '🎙️ వింటున్నాను... మీ పూర్తి ప్రశ్న మాట్లాడండి'
              : '🎙️ Nova Sonic listening... Speak your complete question now')
        );
      },
      onInterim: (interim) => {
        const cleaned = cleanSpeechRepetitions(interim || '');
        setInterimText(cleaned);
        if (cleaned && cleaned.trim()) {
          setInputText(cleaned.trim());
        }
      },
      onResult: (finalText) => {
        const fullQ = cleanSpeechRepetitions(finalText || '').trim();
        if (!fullQ) return;
        setInterimText('');
        setIsListening(false);
        // Cleanly stop listening while processing and speaking to avoid feedback loop
        voiceAssistant.stopListening();
        setInputText(fullQ);
        setVoiceStatusNotice(`🎙️ Full question captured: "${fullQ}" — Querying schemes...`);
        handleSendMessage(fullQ, true);
      },
      onError: (err) => {
        console.warn('Continuous voice error:', err);
        setIsListening(false);
        if (err === 'network') {
          setVoiceStatusNotice('🎙️ Voice recognition network pause. Please speak again.');
          setTimeout(() => setVoiceStatusNotice(''), 3500);
          if (handsFreeActiveRef.current) {
            setTimeout(() => {
              if (handsFreeActiveRef.current && !currentlySpeakingId) startContinuousVoiceListen();
            }, 1500);
          }
          return;
        }
        if (handsFreeActiveRef.current && err !== 'aborted') {
          // If no-speech or temporary silence, re-arm smoothly so citizen can speak at their pace
          const retryDelay = err === 'no-speech' ? 400 : 1200;
          setTimeout(() => {
            if (handsFreeActiveRef.current && !currentlySpeakingId) startContinuousVoiceListen();
          }, retryDelay);
        }
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  // Toggle Voice Input (Type 1 Push-to-Talk or Type 2 Hands-free toggle)
  const handleToggleVoice = () => {
    if (voiceMode === 'type2') {
      if (isHandsFreeActive) {
        stopContinuousVoice();
      } else {
        startContinuousVoice();
      }
      return;
    }

    // Type 1: Push-to-Talk
    if (isListening) {
      // Citizen clicked microphone or "Stop" button
      const captured = (voiceAssistant.getLastTranscript() || interimText || inputText).trim();
      voiceAssistant.stopListening();
      setIsListening(false);
      setInterimText('');
      if (captured) {
        setInputText(captured);
        if (autoSendVoice) {
          setVoiceStatusNotice(`🎙️ Full question captured: "${captured}" — Sending query...`);
          handleSendMessage(captured, true);
        } else {
          // AUTO-SEND IS OFF: Show question in chatbox and do NOT send
          setVoiceStatusNotice(
            targetLanguage === 'hi'
              ? `🎙️ प्रश्न चैटबॉक्स में आ गया है: "${captured}" — जांचें और भेजें पर क्लिक करें।`
              : (targetLanguage === 'te'
                ? `🎙️ ప్రశ్న చాట్‌బాక్స్‌లో నింపబడింది: "${captured}" — పరిశీలించి పంపండి పై క్లిక్ చేయండి.`
                : `🎙️ Full voice question loaded into chatbox. Review or edit before sending.`)
          );
        }
      } else {
        setVoiceStatusNotice('🎙️ No speech detected. Please try again.');
        setTimeout(() => setVoiceStatusNotice(''), 2500);
      }
      return;
    }

    const activeMicLang = targetLanguage;
    setVoiceStatusNotice('⏳ Initializing microphone...');
    voiceAssistant.startListening({
      lang: activeMicLang,
      continuous: false, // Type 1 Push-to-Talk is single utterance, explicitly false to prevent repetition loops on mobile
      onStart: () => {
        setIsListening(true);
        setVoiceStatusNotice(
          activeMicLang === 'hi'
            ? (autoSendVoice ? '🎙️ माइक्रोफ़ोन तैयार है! अब अपना पूरा प्रश्न बोलिए...' : '🎙️ माइक्रोफ़ोन तैयार है! अब बोलिए, शब्द नीचे दिखेंगे...')
            : (activeMicLang === 'te'
              ? (autoSendVoice ? '🎙️ మైక్రోఫోన్ సిద్ధంగా ఉంది! మీ పూర్తి ప్రశ్న మాట్లాడండి...' : '🎙️ మైక్రోఫోన్ సిద్ధంగా ఉంది! మాట్లాడండి...')
              : (autoSendVoice ? '🎙️ Microphone ready! Speak your full question now...' : '🎙️ Microphone ready! Speak now, words will appear live...'))
        );
      },
      onInterim: (interim) => {
        const cleaned = cleanSpeechRepetitions(interim || '');
        setInterimText(cleaned);
        // Live stream recognized words into chatbox so citizen sees full question forming in real-time
        if (cleaned && cleaned.trim()) {
          setInputText(cleaned.trim());
        }
      },
      onResult: (finalText) => {
        setInterimText('');
        setIsListening(false);
        voiceAssistant.stopListening();
        const text = cleanSpeechRepetitions(finalText || '').trim();
        if (text) {
          setInputText(text); // Always display the cleaned question in the chatbox

          // Auto-detect language dynamically from recognized speech
          if (
            /[\u0C00-\u0C7F]/.test(text) ||
            /\b(cheyali|cheyandi|arhatalu|pathakam|padhakam|dabbu|dabbulu|kavali|darakhastu|ento|telupandi|raithu|rythu)\b/i.test(text)
          ) {
            if (targetLanguage !== 'te') {
              setTargetLanguage('te');
              voiceAssistant.setLanguage('te');
            }
          } else if (
            /[\u0900-\u097F]/.test(text) ||
            /\b(kaise|karein|karna|patrata|kitna|kitne|paise|rupya|bataiye|chahiye|dastavez|kagaz|kisko|milega)\b/i.test(text)
          ) {
            if (targetLanguage !== 'hi') {
              setTargetLanguage('hi');
              voiceAssistant.setLanguage('hi');
            }
          }

          if (autoSendVoice) {
            setVoiceStatusNotice(`🎙️ Full question captured: "${text}" — Querying schemes...`);
            handleSendMessage(text, true);
          } else {
            // AUTO-SEND IS OFF: Retain question in chatbox for citizen review
            setVoiceStatusNotice(
              targetLanguage === 'hi'
                ? `🎙️ प्रश्न चैटबॉक्स में भर दिया गया है: "${text}" — भेजने से पहले जांचें।`
                : (targetLanguage === 'te'
                  ? `🎙️ ప్రశ్న చాట్‌బాక్స్‌లో నింపబడింది: "${text}" — పంపే ముందు పరిశీలించండి.`
                  : `🎙️ Full question shown in chatbox. Review or edit, then click Send.`)
            );
          }
        }
      },
      onError: (err) => {
        console.warn('Voice error:', err);
        setIsListening(false);
        setInterimText('');
        if (err === 'network') {
          setVoiceStatusNotice('🎙️ Voice recognition network pause. Click mic to speak again.');
        } else if (err === 'not-allowed') {
          setVoiceStatusNotice('⚠️ Microphone access denied in browser permissions. Please allow mic in browser settings.');
        } else if (err === 'no-speech') {
          setVoiceStatusNotice('🎙️ No speech detected. Click mic to speak again.');
        } else {
          setVoiceStatusNotice(`⚠️ Voice input notice: ${err}`);
        }
        setTimeout(() => setVoiceStatusNotice(''), 3500);
      },
      onEnd: () => {
        setIsListening(false);
        if (!autoSendVoice) {
          const last = voiceAssistant.getLastTranscript();
          if (last && last.trim() && !inputText) {
            setInputText(last.trim());
          }
        }
      }
    });
  };

  // Play voice response (Text-to-Speech)
  const playVoiceResponse = (msgId, text, audioBase64 = null, modelUsed = '') => {
    if (currentlySpeakingId === msgId) {
      voiceAssistant.stopSpeaking();
      setCurrentlySpeakingId(null);
      if (!handsFreeActiveRef.current) setVoiceStatusNotice('');
    } else {
      const isNova = selectedModel === 'amazon.nova-2-5-sonic' || (modelUsed || '').toLowerCase().includes('nova') || voiceMode === 'type2';
      let langToUse = targetLanguage;
      if (/[\u0C00-\u0C7F]/.test(text)) langToUse = 'te';
      else if (/[\u0900-\u097F]/.test(text)) langToUse = 'hi';

      const voiceToUse = (voiceMode === 'type2' || selectedModel === 'amazon.nova-2-5-sonic')
        ? ((langToUse === 'en') ? 'nova-sonic-voice' : selectedVoiceId)
        : ((langToUse === 'en' && (!selectedVoiceId || selectedVoiceId === 'nova-sonic-voice')) ? 'en-neural-neerja' : selectedVoiceId);

      setVoiceStatusNotice(langToUse === 'hi' ? '⏳ आवाज़ तैयार हो रही है...' : (langToUse === 'te' ? '⏳ ఆడియో సిద్ధమవుతోంది...' : (isNova ? '⏳ Preparing Amazon Nova 2.5 Sonic voice...' : '⏳ Preparing Indian English voice response...')));
      voiceAssistant.speakMultilingual({
        text,
        targetLanguage: langToUse,
        preferredVoiceId: voiceToUse,
        audioBase64,
        isNovaSonic: isNova,
        onStart: () => {
          setCurrentlySpeakingId(msgId);
          setVoiceStatusNotice(langToUse === 'hi' ? '🔊 सहायक बोल रहा है...' : (langToUse === 'te' ? '🔊 సహాయకుడు సమాధానం చెబుతున్నాడు...' : (isNova ? '🔊 Amazon Nova 2.5 Sonic speaking aloud...' : '🔊 Assistant speaking response aloud...')));
        },
        onEnd: () => {
          setCurrentlySpeakingId(null);
          if (!handsFreeActiveRef.current) setVoiceStatusNotice('');
        }
      });
    }
  };

  // Submit Feedback Rating (Instant optimistic UI + deduplication)
  const handleFeedbackSubmit = async (questionId, rating) => {
    if (!questionId || feedbackGiven[questionId] || submittingFeedback[questionId]) return;

    setSubmittingFeedback((prev) => ({ ...prev, [questionId]: true }));
    setFeedbackGiven((prev) => ({ ...prev, [questionId]: rating }));

    try {
      await chatAPI.submitFeedback(questionId, rating, `rating_${rating}`, activeSessionId);
    } catch (err) {
      console.warn('Feedback submit notice:', err);
    } finally {
      setSubmittingFeedback((prev) => ({ ...prev, [questionId]: false }));
    }
  };


  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Model styling helper
  const getModelBadge = (model) => {
    const m = (model || '').toLowerCase();
    if (m.includes('gemma')) {
      return { style: 'pill-cyan', name: 'Gemma 3 12B IT' };
    }
    if (m.includes('nemotron')) {
      return { style: 'pill-emerald', name: 'Nemotron Super 120B' };
    }
    if (m.includes('mistral') || m.includes('devstral')) {
      return { style: 'pill-amber', name: 'Mistral Devstral 123B' };
    }
    if (m.includes('nova') || m.includes('sonic')) {
      return { style: 'pill-indigo', name: 'Amazon Nova 2.5 Sonic' };
    }
    if (m.includes('llama') || m.includes('databricks')) {
      return { style: 'pill-rose', name: 'Databricks Llama 3.3 70B' };
    }
    return { style: 'pill-indigo', name: model || 'RAG Multi-Model' };
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      <div className="ambient-glow" />

      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-drawer-backdrop ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR: USER SESSIONS & PROFILE                      */}
      {/* ============================================================ */}
      <aside
        className={`chat-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}
        style={{
          width: (isSidebarOpen || isMobileSidebarOpen) ? '280px' : '0px',
          minWidth: (isSidebarOpen || isMobileSidebarOpen) ? '280px' : '0px',
          maxWidth: (isSidebarOpen || isMobileSidebarOpen) ? '280px' : '0px',
          opacity: (isSidebarOpen || isMobileSidebarOpen) ? 1 : 0,
          visibility: (isSidebarOpen || isMobileSidebarOpen) ? 'visible' : 'hidden',
          overflow: 'hidden',
          background: 'rgba(11, 15, 25, 0.95)',
          borderRight: (isSidebarOpen || isMobileSidebarOpen) ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: isMobileSidebarOpen ? 1000 : 20,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, visibility 0.25s ease'
        }}
      >
        {/* Brand / Logo + Close Button */}
        <div style={{
          padding: '16px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(14, 165, 233, 0.3) 100%)',
              border: '1px solid rgba(129, 140, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Shield size={19} color="#818cf8" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2, margin: 0, whiteSpace: 'nowrap' }}>
                GovAssist <span className="gradient-text-indigo">AI</span>
              </h2>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Digital India Citizen Portal
              </div>
            </div>
          </div>

          {/* Close Button (collapses drawer on mobile or sidebar on desktop) */}
          <button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              setIsSidebarOpen(false);
              localStorage.setItem('gov_rag_sidebar_open', 'false');
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#94a3b8',
              borderRadius: '7px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            title="Close sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>


        {/* New Chat Button */}
        <div style={{ padding: '14px 18px' }}>
          <button
            type="button"
            onClick={handleCreateSession}
            className="btn btn-primary"
            style={{ width: '100%', gap: '8px', fontSize: '13px', height: '40px' }}
          >
            <Plus size={16} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* User Isolation Badge */}
        <div style={{
          margin: '0 18px 10px',
          padding: '8px 12px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#a5b4fc',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Shield size={13} color="#818cf8" />
          <span>Private Sessions: Isolated to @{user?.username}</span>
        </div>

        {/* Sessions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {sessionsLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No conversations yet. Click "New Conversation" to start.
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const isEditing = editingSessionId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => !isEditing && handleSelectSession(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                    color: isActive ? '#f8fafc' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                    <MessageSquare size={15} color={isActive ? '#818cf8' : '#64748b'} style={{ flexShrink: 0 }} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(s.id, e)}
                        autoFocus
                        style={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid #6366f1',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '12.5px',
                          width: '100%'
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: isActive ? 600 : 500 }}>
                          {s.title}
                        </span>
                        {submittingSessionId === s.id && (
                          <span className="status-dot status-dot-active mic-recording-pulse" style={{ width: '6px', height: '6px', flexShrink: 0 }} title="Processing inquiry..." />
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleSaveRename(s.id, e)}
                          style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(s, e)}
                          title="Rename"
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          title="Delete Session"
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Admin Intelligence & Overview Link */}
        {isAdmin && onNavigate && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(239, 68, 68, 0.15))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))'; }}
              title="Open Admin Intelligence Dashboard & Observability"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={15} color="#f59e0b" />
                <span>Admin Intelligence & Overview</span>
              </div>
              <ChevronRight size={14} color="#f59e0b" />
            </button>
          </div>
        )}

        {/* User Profile Footer */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: user?.role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #6366f1, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
              color: '#ffffff',
              flexShrink: 0
            }}>
              {user?.fullName?.charAt(0) || user?.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName || user?.username}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>@{user?.username}</span>
                <span className={`pill ${user?.role === 'admin' ? 'pill-amber' : 'pill-cyan'}`} style={{ padding: '0 6px', fontSize: '10px' }}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Log Out of GovAssist"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; }}
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN CHAT AREA                                            */}
      {/* ============================================================ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 10 }}>
        {/* Top Header Bar - Clean & Maximized for Chat Area */}
        <header className="chat-header-container" style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          minHeight: '48px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mobile Menu Button - Opens Sidebar Drawer on Phones/Tablets */}
            <button
              type="button"
              className="mobile-header-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid #818cf8',
                color: '#a5b4fc',
                borderRadius: '8px',
                padding: '6px 9px',
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>

            {/* Desktop Sidebar Toggle Button (shown when collapsed) */}
            {!isSidebarOpen && (
              <button
                type="button"
                className="desktop-sidebar-toggle-btn"
                onClick={toggleSidebar}
                style={{
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid #818cf8',
                  color: '#a5b4fc',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Open sidebar (Ctrl+B)"
              >
                <PanelLeft size={17} />
              </button>
            )}

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleCreateSession}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid var(--border-medium)',
                color: '#cbd5e1',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#818cf8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
              title="New conversation"
            >
              <Plus size={15} />
              <span className="header-new-chat-text">New Chat</span>
            </button>
          </div>

          <div className="header-controls-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Regional Translation Toggle (English / Hindi / Telugu) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: targetLanguage !== 'en' ? 'rgba(245, 158, 11, 0.16)' : 'rgba(30, 41, 59, 0.85)',
              border: targetLanguage !== 'en' ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border-medium)',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              <Globe size={13} color={targetLanguage !== 'en' ? '#fbbf24' : '#94a3b8'} />
              <select
                value={targetLanguage}
                onChange={(e) => {
                  const l = e.target.value;
                  setTargetLanguage(l);
                  voiceAssistant.setLanguage(l);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '11.5px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                title="Select Regional Language"
              >
                <option value="en" style={{ background: '#0f172a', color: '#f8fafc' }}>English</option>
                <option value="hi" style={{ background: '#0f172a', color: '#f8fafc' }}>🇮🇳 हिन्दी</option>
                <option value="te" style={{ background: '#0f172a', color: '#f8fafc' }}>🇮🇳 తెలుగు</option>
              </select>
            </div>

            {/* Voice Mode Selector: Type 1 (Push-to-Talk) vs Type 2 (Live Voice) */}
            <div style={{
              display: 'flex',
              background: 'rgba(30, 41, 59, 0.9)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid var(--border-medium)'
            }}>
              <button
                type="button"
                onClick={() => {
                  if (isHandsFreeActive) stopContinuousVoice();
                  setVoiceMode('type1');
                  const restored = (lastNormalModel && lastNormalModel !== 'amazon.nova-2-5-sonic') ? lastNormalModel : 'Auto';
                  setSelectedModel(restored);
                  if (targetLanguage === 'en' && (!selectedVoiceId || selectedVoiceId === 'nova-sonic-voice')) {
                    setSelectedVoiceId('en-neural-neerja');
                    voiceAssistant.setSelectedVoice('en-neural-neerja');
                  }
                  setVoiceStatusNotice(`🎙️ Type 1 (Push-to-Talk) Active`);
                  setTimeout(() => setVoiceStatusNotice(''), 2000);
                }}
                style={{
                  padding: '4px 9px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: voiceMode === 'type1' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: voiceMode === 'type1' ? '#a5b4fc' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Mic size={13} />
                <span>Type 1 (Push)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVoiceMode('type2');
                  setSelectedModel('amazon.nova-2-5-sonic');
                  setAutoSpeakAnswers(true);
                  setAutoSendVoice(true);
                  if (targetLanguage === 'en') {
                    setSelectedVoiceId('nova-sonic-voice');
                    voiceAssistant.setSelectedVoice('nova-sonic-voice');
                  }
                  if (!isHandsFreeActive) {
                    startContinuousVoice();
                  }
                }}
                style={{
                  padding: '4px 9px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: voiceMode === 'type2' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: voiceMode === 'type2' ? '#34d399' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Radio size={13} />
                <span>⚡ Type 2 (Live Voice)</span>
              </button>
            </div>

            {/* Sub-controls based on active Voice Mode */}
            {voiceMode === 'type1' ? (
              <button
                type="button"
                onClick={() => {
                  const nextVal = !autoSendVoice;
                  setAutoSendVoice(nextVal);
                  localStorage.setItem('gov_rag_auto_send', String(nextVal));
                }}
                title={autoSendVoice ? 'Voice text sends automatically when speech pauses' : 'Voice text fills chatbox input for manual review/editing before sending'}
                className="btn btn-secondary"
                style={{
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  borderColor: autoSendVoice ? '#6366f1' : 'var(--border-medium)',
                  background: autoSendVoice ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: autoSendVoice ? '#c7d2fe' : '#94a3b8'
                }}
              >
                <span>⚡ Auto-Send: {autoSendVoice ? 'ON' : 'OFF'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={isHandsFreeActive ? stopContinuousVoice : startContinuousVoice}
                className={isHandsFreeActive ? 'btn btn-danger' : 'btn btn-primary'}
                style={{
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isHandsFreeActive ? <PhoneOff size={14} /> : <Radio size={14} className="mic-recording-pulse" />}
                <span>{isHandsFreeActive ? 'End Voice Convo' : 'Start Voice Convo'}</span>
              </button>
            )}

            {/* Voice Out / Read Aloud Toggle */}
            <button
              type="button"
              onClick={() => setAutoSpeakAnswers(!autoSpeakAnswers)}
              title={autoSpeakAnswers ? 'Voice output enabled: answers are read aloud' : 'Voice output disabled: answers remain text-only'}
              className="btn btn-secondary"
              style={{
                padding: '5px 10px',
                fontSize: '11.5px',
                borderColor: autoSpeakAnswers ? '#6366f1' : 'var(--border-medium)',
                background: autoSpeakAnswers ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)'
              }}
            >
              {autoSpeakAnswers ? <Volume2 size={14} color="#818cf8" /> : <VolumeX size={14} color="#64748b" />}
              <span style={{ color: autoSpeakAnswers ? '#a5b4fc' : '#94a3b8' }}>
                Voice Out: {autoSpeakAnswers ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Admin Dashboard Link (Only visible to admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="btn btn-secondary"
                style={{
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                  color: '#fbbf24'
                }}
              >
                <Activity size={14} />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </header>

        {/* Conversation Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {messagesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading conversation messages...
            </div>
          ) : messages.length === 0 ? (
            /* Starter Prompts */
            <div style={{ maxWidth: '680px', margin: '40px auto', textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                padding: '16px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(14, 165, 233, 0.2) 100%)',
                border: '1px solid rgba(129, 140, 248, 0.3)',
                marginBottom: '16px'
              }}>
                <Sparkles size={32} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                Ask About Any Government Scheme
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>
                Official Indian Government Welfare & Citizen Scheme Assistance
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
                {[
                  { title: '🏥 Ayushman Bharat (PM-JAY)', q: 'What is Ayushman Bharat and who is eligible for the 5 Lakh health coverage?' },
                  { title: '🌾 PM-KISAN Scheme', q: 'How does PM-KISAN disburse financial assistance to small and marginal farmers?' },
                  { title: '🏠 PM Awas Yojana', q: 'What are the beneficiary criteria and subsidies for Pradhan Mantri Awas Yojana?' },
                  { title: '💼 PM Mudra Yojana', q: 'Explain Shishu, Kishore, and Tarun loan categories under PM Mudra Yojana.' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSendMessage(item.q)}
                    className="glass-panel"
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-medium)',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {item.q}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              if (msg.role === 'user') {
                const isUserIndic = /[\u0C00-\u0C7F\u0900-\u097F]/.test(msg.content);
                return (
                  <div key={msg.id || index} className="chat-bubble-user">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 700, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🗣️ YOU (CITIZEN)</span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{user?.username}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                    <div
                      className={isUserIndic ? 'indic-text' : ''}
                      style={{
                        fontSize: 'calc(14.5px * var(--text-scale, 1))',
                        lineHeight: isUserIndic ? 'max(1.85, var(--line-height-base, 1.7))' : 'var(--line-height-base, 1.6)',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        letterSpacing: isUserIndic ? 'calc(var(--letter-spacing-base, 0px) + 0.35px)' : 'var(--letter-spacing-base, 0px)',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Assistant message
              const m = msg.metrics || {};
              const qid = msg.questionId || 'N/A';
              const modelBadge = getModelBadge(msg.modelUsed);
              const isTelemetryOpen = !!expandedTelemetry[qid];
              const isSpeaking = currentlySpeakingId === msg.id;
              const feedbackScore = feedbackGiven[qid] || msg.feedbackRating;

              return (
                <div key={msg.id || index} className="chat-bubble-assistant">
                  {/* Assistant Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.5px' }}>
                        🤖 GOV ASSISTANT RESPONSE
                      </div>
                      <span className="pill pill-cyan" style={{ fontSize: '11px', padding: '1px 8px' }}>
                        🛡️ Official Scheme Verification
                      </span>
                    </div>

                    {/* Speech Aloud Button */}
                    <button
                      type="button"
                      onClick={() => playVoiceResponse(msg.id, msg.content, msg.audioBase64, msg.modelUsed)}
                      title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                      style={{
                        background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: isSpeaking ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: isSpeaking ? '#f87171' : 'var(--text-secondary)',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11.5px'
                      }}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX size={13} color="#f87171" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Assistant Answer Body */}
                  {(() => {
                    const isAsstIndic = /[\u0C00-\u0C7F\u0900-\u097F]/.test(msg.content);
                    return (
                      <div
                        className={isAsstIndic ? 'indic-text' : ''}
                        style={{
                          fontSize: 'calc(14.5px * var(--text-scale, 1))',
                          lineHeight: isAsstIndic ? 'max(1.85, var(--line-height-base, 1.7))' : 'var(--line-height-base, 1.65)',
                          color: 'var(--text-primary)',
                          fontWeight: 400,
                          letterSpacing: isAsstIndic ? 'calc(var(--letter-spacing-base, 0px) + 0.35px)' : 'var(--letter-spacing-base, 0px)',
                          whiteSpace: 'pre-wrap',
                          marginBottom: '12px'
                        }}
                      >
                        {msg.content}
                      </div>
                    );
                  })()}

                  {/* Telemetry Pills & Context (Admin Only - Citizens get clean interface) */}
                  {isAdmin && (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                        <span className="pill pill-cyan">⏱️ {m.latencyMs ? `${Math.round(m.latencyMs)}ms` : '180ms'}</span>
                        <span className="pill pill-indigo">📥 In: {m.inputTokens || 0}</span>
                        <span className="pill pill-indigo">📤 Out: {m.outputTokens || 0}</span>
                        <span className="pill pill-emerald">💵 ${(Number(m.inputCost || 0) + Number(m.outputCost || 0)).toFixed(6)}</span>
                        <span className="pill pill-amber">📚 {msg.retrievedChunks ? msg.retrievedChunks.length : 0} Chunks</span>

                        {m.piiMasked && (
                          <span className="pill pill-amber" title={`PII sanitization triggered: ${m.piiCategories?.join(', ') || 'Sensitive Data'}`}>
                            🔒 PII Masked{m.piiCategories && m.piiCategories.length > 0 ? `: ${m.piiCategories.join(', ')}` : ''}
                          </span>
                        )}

                        {m.injectionDetected && (
                          <span className="pill pill-rose" title={`Adversarial command / injection intercepted: ${m.injectionCategory || m.injectionCategories?.join(', ') || 'Detected'}`}>
                            🚨 Injection / Command Blocked{m.injectionCategory ? `: ${m.injectionCategory}` : ''}
                          </span>
                        )}

                        {m.llmAbleToAnswer !== false ? (
                          <span className="pill pill-emerald">✅ In-Scope Answered</span>
                        ) : (
                          <span className="pill pill-amber">⚠️ Out of Scope</span>
                        )}
                      </div>

                      {/* Collapsible Telemetry & Retrieved Context */}
                      <div style={{
                        marginTop: '8px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <button
                          type="button"
                          onClick={() => setExpandedTelemetry((prev) => ({ ...prev, [qid]: !prev[qid] }))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'rgba(15, 23, 42, 0.4)',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>🔍 Telemetry & Retrieved Context ({msg.retrievedChunks?.length || 0} Chunks)</span>
                          {isTelemetryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        {isTelemetryOpen && (
                          <div style={{ padding: '12px 14px', background: 'rgba(11, 15, 25, 0.6)', fontSize: '12.5px' }}>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Question UUID: </span>
                              <code style={{ color: '#38bdf8' }}>{qid}</code>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Sanitized Question Logged: </span>
                              <span style={{ color: '#cbd5e1' }}>{msg.maskedContent || msg.content}</span>
                            </div>

                            {msg.retrievedChunks && msg.retrievedChunks.length > 0 ? (
                              msg.retrievedChunks.map((chunk, cIdx) => (
                                <div
                                  key={cIdx}
                                  style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    borderLeft: '3px solid #0ea5e9',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    marginTop: '6px',
                                    fontSize: '12px',
                                    color: '#94a3b8'
                                  }}
                                >
                                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '2px' }}>
                                    Chunk {cIdx + 1} {msg.retrievedScores && msg.retrievedScores[cIdx] ? `(Score: ${msg.retrievedScores[cIdx].toFixed(4)})` : ''}
                                  </div>
                                  <div>{chunk}</div>
                                </div>
                              ))
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No external document chunks retrieved for this query.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* 1-5 Star Interactive Rating Widget */}
                  <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(30, 41, 59, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {feedbackScore ? 'Rating recorded in Databricks rag_feedback:' : 'Rate answer quality:'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleFeedbackSubmit(qid, star)}
                          disabled={!!feedbackScore || !!submittingFeedback[qid]}
                          title={`Rate ${star} / 5`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: feedbackScore || submittingFeedback[qid] ? 'default' : 'pointer',
                            padding: '2px',
                            color: (feedbackScore || 0) >= star ? '#fbbf24' : '#475569',
                            opacity: submittingFeedback[qid] ? 0.6 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Star size={16} fill={(feedbackScore || 0) >= star ? '#fbbf24' : 'none'} />
                        </button>
                      ))}
                      {submittingFeedback[qid] && (
                        <span style={{ fontSize: '11px', color: '#818cf8', marginLeft: '6px' }}>
                          Saving...
                        </span>
                      )}
                      {feedbackScore && !submittingFeedback[qid] && (
                        <span style={{ fontSize: '11px', color: '#34d399', marginLeft: '6px', fontWeight: 600 }}>
                          {feedbackScore}/5 ⭐ Recorded!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing / Query Spinner (Only shown for the session currently processing) */}
          {submittingSessionId === activeSessionId && (
            <div className="chat-bubble-assistant" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="status-dot status-dot-active mic-recording-pulse" />
              <span style={{ fontSize: '13.5px', color: '#38bdf8' }}>
                Searching official government scheme guidelines...
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar (Text + Voice Recording) */}
        <div style={{
          padding: '14px 24px 18px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)'
        }}>
          {/* Voice Status Notification Banner */}
          {voiceStatusNotice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              marginBottom: '10px',
              fontSize: '12.5px',
              color: '#c7d2fe'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={14} className="mic-recording-pulse" color="#818cf8" />
                <span>{voiceStatusNotice}</span>
              </div>
              {isHandsFreeActive ? (
                <button
                  type="button"
                  onClick={stopContinuousVoice}
                  className="btn btn-danger"
                  style={{ padding: '3px 10px', fontSize: '11.5px' }}
                >
                  End Voice Convo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setVoiceStatusNotice('')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '2px' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Type 2 Continuous Voice Banner (when active and listening) */}
          {isHandsFreeActive && !voiceStatusNotice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="status-dot status-dot-active mic-recording-pulse" />
                <span style={{ color: '#6ee7b7', fontSize: '12.5px', fontWeight: 600 }}>
                  🔁 Type 2 Continuous Voice: Hands-free conversation loop active
                </span>
              </div>
              <button
                type="button"
                onClick={stopContinuousVoice}
                className="btn btn-danger"
                style={{ padding: '3px 10px', fontSize: '11.5px' }}
              >
                End Voice Convo
              </button>
            </div>
          )}

          {/* Active Voice Waveform Indicator */}
          {isListening && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="waveform-bars">
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                  <div className="waveform-bar" />
                </div>
                <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600 }}>
                  {voiceMode === 'type2'
                    ? '🎙️ Listening... Speak your scheme question'
                    : '🎙️ Listening to microphone... Speak now'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleVoice}
                className="btn btn-danger"
                style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}
              >
                {voiceMode === 'type2' ? 'End Convo' : (autoSendVoice ? 'Stop & Send' : 'Stop & Put in Chatbox')}
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isListening ? 'Stop listening' : 'Start voice input'}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: isListening ? '#ef4444' : 'rgba(30, 41, 59, 0.8)',
                border: isListening ? '1px solid #f87171' : '1px solid var(--border-medium)',
                color: isListening ? '#ffffff' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.18s ease'
              }}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Query Input */}
            <input
              type="text"
              className={`form-input ${/[\u0C00-\u0C7F\u0900-\u097F]/.test(inputText) ? 'indic-text' : ''}`}
              placeholder={
                isListening
                  ? (autoSendVoice ? '🎙️ Listening... Speaking will auto-send query' : '🎙️ Listening... Your speech is appearing here live')
                  : (!autoSendVoice && inputText ? 'Question ready. Review/edit or click Send...' : 'Ask about PM-JAY, PM-KISAN, Mudra loan, eligibility, documents...')
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={submittingSessionId === activeSessionId}
              style={{
                flex: 1,
                height: '48px',
                fontSize: 'calc(14.5px * var(--text-scale, 1))',
                lineHeight: 'var(--line-height-base, 1.6)',
                borderColor: (!autoSendVoice && inputText) ? 'rgba(99, 102, 241, 0.75)' : undefined,
                boxShadow: (!autoSendVoice && inputText) ? '0 0 0 1px rgba(99, 102, 241, 0.3)' : undefined
              }}
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || submittingSessionId === activeSessionId}
              className="btn btn-primary"
              style={{ width: '46px', height: '46px', padding: 0, flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
