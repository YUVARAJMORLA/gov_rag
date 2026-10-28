// Web Speech API Integration for Speech-to-Text and Text-to-Speech
// Supports dynamic multi-voice selection (Male / Female accents), Native Neural Hindi (hi-IN) & Telugu (te-IN) Beta Voices, and Nova Sonic Voice
import { chatAPI } from './api';

// Intelligent deduplication to prevent mobile Android Chrome Web Speech stutter
// Fixes "what is what is what is what is what is databricks" -> "what is databricks"
export function cleanSpeechRepetitions(text) {
  if (!text) return '';
  let s = text.trim();
  // 1. Collapse repeated consecutive identical single words: "what what what" -> "what", "is is" -> "is"
  s = s.replace(/\b(\S+)(?:\s+\1\b)+/gi, '$1');
  // 2. Collapse repeated 2-to-6 word phrases
  for (let n = 6; n >= 2; n--) {
    const pattern = new RegExp(`((?:\\S+\\s+){${n - 1}}\\S+)(?:\\s+\\1)+`, 'gi');
    s = s.replace(pattern, '$1');
  }
  return s.trim();
}

export class VoiceAssistant {
  constructor() {
    this.activeRecognition = null;
    this.isListening = false;
    this.lastTranscript = '';
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voiceList = [];
    this.voiceListeners = [];
    this.currentLanguage = 'en'; // 'en' | 'hi' | 'te'
    this.currentAudio = null;
    this.audioCache = new Map(); // Cache generated audio to prevent duplicate API calls
    this.speechSessionId = 0; // Concurrency mutex to prevent overlapping audio streams

    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    } else {
      this.loadVoices();
    }
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition) || !!window.speechSynthesis;
  }

  isRecognitionSupported() {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  getLastTranscript() {
    return this.lastTranscript || '';
  }

  // Set Language for Speech-to-Text (ASR) and TTS
  setLanguage(langCode) {
    this.currentLanguage = langCode || 'en';
    this.loadVoices();
  }

  // Load and categorize all browser synthesis voices and native neural Indian voices
  loadVoices() {
    const rawVoices = this.synth ? this.synth.getVoices() : [];

    let customNeuralVoices = [];
    if (this.currentLanguage === 'te') {
      customNeuralVoices = [
        {
          id: 'te-neural-shruti',
          name: 'Shruti',
          lang: 'te-IN',
          gender: 'Female',
          icon: '👩',
          label: '👩 Female — Shruti (తెలుగు Neural - Natural)',
          isNeural: true
        },
        {
          id: 'te-neural-mohan',
          name: 'Mohan',
          lang: 'te-IN',
          gender: 'Male',
          icon: '👨',
          label: '👨 Male — Mohan (తెలుగు Neural - Formal)',
          isNeural: true
        }
      ];
    } else if (this.currentLanguage === 'hi') {
      customNeuralVoices = [
        {
          id: 'hi-neural-swara',
          name: 'Swara',
          lang: 'hi-IN',
          gender: 'Female',
          icon: '👩',
          label: '👩 Female — Swara (हिन्दी Neural - Natural)',
          isNeural: true
        },
        {
          id: 'hi-neural-madhur',
          name: 'Madhur',
          lang: 'hi-IN',
          gender: 'Male',
          icon: '👨',
          label: '👨 Male — Madhur (हिन्दी Neural - Formal)',
          isNeural: true
        }
      ];
    } else {
      customNeuralVoices = [
        {
          id: 'en-neural-neerja',
          name: 'Neerja',
          lang: 'en-IN',
          gender: 'Female',
          icon: '👩',
          label: '👩 Female — Neerja (English - India 🇮🇳 Neural)',
          isNeural: true
        },
        {
          id: 'en-neural-prabhat',
          name: 'Prabhat',
          lang: 'en-IN',
          gender: 'Male',
          icon: '👨',
          label: '👨 Male — Prabhat (English - India 🇮🇳 Neural)',
          isNeural: true
        },
        {
          id: 'nova-sonic-voice',
          name: 'Amazon Nova Sonic Voice',
          lang: 'en-US',
          gender: 'Female',
          icon: '🚀',
          label: '🚀 Amazon Nova Sonic (Ultra Low-Latency Voice)',
          isNeural: true
        }
      ];
    }

    // Strict Filter: Only include voices matching the currently selected language
    let browserVoices = [];
    if (rawVoices && rawVoices.length > 0) {
      if (this.currentLanguage === 'hi') {
        browserVoices = rawVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('hi'));
      } else if (this.currentLanguage === 'te') {
        browserVoices = rawVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('te'));
      } else {
        // English only
        browserVoices = rawVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      }
    }

    const browserMapped = browserVoices.map((v) => {
      const lower = v.name.toLowerCase();
      const isMale =
        lower.includes('david') ||
        lower.includes('mark') ||
        lower.includes('george') ||
        lower.includes('guy') ||
        lower.includes('ravi') ||
        lower.includes('male') ||
        lower.includes('james') ||
        lower.includes('alex') ||
        lower.includes('daniel') ||
        lower.includes('oliver') ||
        lower.includes('stefan') ||
        lower.includes('paul') ||
        lower.includes('hemant') ||
        lower.includes('madhav') ||
        lower.includes('richard');

      const isFemale =
        lower.includes('zira') ||
        lower.includes('jenny') ||
        lower.includes('hazel') ||
        lower.includes('susan') ||
        lower.includes('heera') ||
        lower.includes('kalpana') ||
        lower.includes('samantha') ||
        lower.includes('female') ||
        lower.includes('victoria') ||
        lower.includes('karen') ||
        lower.includes('catherine') ||
        lower.includes('aria') ||
        lower.includes('natural');

      const gender = isMale ? 'Male' : (isFemale ? 'Female' : 'Neutral');
      const icon = isMale ? '👨' : (isFemale ? '👩' : '🎙️');

      let cleanName = v.name
        .replace(/Microsoft\s*/i, '')
        .replace(/Google\s*/i, 'Google ')
        .replace(/Desktop\s*/i, '')
        .replace(/Online\s*\(Natural\)\s*/i, 'Natural ')
        .replace(/-\s*English\s*/i, '')
        .trim();

      const label = `${icon} ${gender} — ${cleanName} (${v.lang})`;

      return {
        id: v.name,
        name: v.name,
        lang: v.lang,
        gender,
        icon,
        label,
        voiceObj: v,
        isNeural: false
      };
    });

    // Combine custom neural voices with browser voices (neural voices first)
    this.voiceList = [...customNeuralVoices, ...browserMapped];

    // Notify listeners
    this.voiceListeners.forEach((cb) => cb(this.voiceList));
  }

  onVoicesChanged(callback) {
    if (typeof callback === 'function') {
      this.voiceListeners.push(callback);
      if (this.voiceList.length > 0) {
        callback(this.voiceList);
      }
    }
  }

  getAvailableVoices() {
    if (!this.voiceList || this.voiceList.length === 0) {
      this.loadVoices();
    }
    return this.voiceList;
  }

  getSelectedVoice() {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(`gov_rag_selected_voice_${this.currentLanguage}`);
    if (saved) {
      const match = this.voiceList.find((v) => v.id === saved);
      if (match) return saved;
    }

    if (this.currentLanguage === 'te') {
      return 'te-neural-shruti';
    } else if (this.currentLanguage === 'hi') {
      return 'hi-neural-swara';
    }

    // Default for English: Indian English Neural (Neerja)
    const engInVoice = this.voiceList.find((v) => v.id === 'en-neural-neerja');
    if (engInVoice) return engInVoice.id;

    const novaVoice = this.voiceList.find((v) => v.id === 'nova-sonic-voice');
    if (novaVoice) return novaVoice.id;

    const defaultMale = this.voiceList.find(
      (v) => v.gender === 'Male' || v.name.includes('David') || v.name.includes('Mark') || v.name.includes('George')
    );

    if (defaultMale) return defaultMale.id;
    return this.voiceList[0]?.id || null;
  }

  setSelectedVoice(voiceId) {
    if (typeof window !== 'undefined' && voiceId) {
      localStorage.setItem(`gov_rag_selected_voice_${this.currentLanguage}`, voiceId);
    }
  }

  // Play an ultra-low latency pleasant ready chime when the microphone hardware is active and recording
  playReadyChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Crisp 660Hz (E5) -> 1046Hz (C6) ascending chime
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  }

  // 1. Start Voice Recognition (Speech-to-Text)
  startListening({ onResult, onInterim, onError, onEnd, onStart, lang = null, continuous = null }) {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      if (onError) onError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Stop and cleanly detach any previously active recognition instance to free the audio device
    this.stopListening();

    const recognition = new SpeechRecognition();
    this.activeRecognition = recognition;

    // Use passed lang, or currentLanguage
    const chosenLang = lang || this.currentLanguage || 'en';
    if (chosenLang === 'hi') {
      recognition.lang = 'hi-IN';
    } else if (chosenLang === 'te') {
      recognition.lang = 'te-IN';
    } else {
      // Default to en-IN (Indian English) which recognizes Indian accents, names, and scheme terms accurately
      recognition.lang = 'en-IN';
    }

    // Mobile Detection: On Android Chrome, continuous = true triggers Chromium Bug 529685
    // where utterances are duplicated repeatedly ("what is what is what is what is what is databricks").
    // We disable continuous mode on mobile devices so single utterances capture cleanly and stop naturally.
    const isMobileDevice = typeof navigator !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && window.innerWidth < 768) ||
      (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
    );

    recognition.continuous = continuous !== null ? continuous : (!isMobileDevice);
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    this.lastTranscript = '';
    let hasDeliveredResult = false;
    let silenceTimer = null;

    const deliverResult = (transcript) => {
      if (hasDeliveredResult) return;
      const clean = cleanSpeechRepetitions((transcript || this.lastTranscript || '').trim());
      if (!clean) return;
      hasDeliveredResult = true;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      this.isListening = false;
      this.stopListening();
      if (onResult) onResult(clean);
    };

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      // Wait for quiet after citizen finishes speaking to ensure the full sentence is captured
      // 1000ms is responsive and prevents premature cuts
      silenceTimer = setTimeout(() => {
        if (this.lastTranscript && this.lastTranscript.trim() && !hasDeliveredResult) {
          deliverResult(this.lastTranscript.trim());
        }
      }, 1100);
    };

    recognition.onstart = () => {
      this.isListening = true;
      this.playReadyChime();
      if (onStart) onStart();
    };

    recognition.onresult = (event) => {
      let assembledFinal = '';
      let assembledInterim = '';

      // Assemble all finalized and interim chunks across event.results
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        const chunk = (item[0]?.transcript || '').trim();
        if (!chunk) continue;

        if (item.isFinal) {
          assembledFinal += (assembledFinal ? ' ' : '') + chunk;
        } else {
          assembledInterim += (assembledInterim ? ' ' : '') + chunk;
        }
      }

      // Assemble and run repetition sanitizer to eliminate any stutter/loop
      let fullTranscript = (assembledFinal + (assembledInterim ? ' ' + assembledInterim : '')).trim();
      fullTranscript = cleanSpeechRepetitions(fullTranscript);

      if (fullTranscript) {
        this.lastTranscript = fullTranscript;
        if (onInterim) {
          onInterim(fullTranscript);
        }
        resetSilenceTimer();
      }
    };

    recognition.onerror = (event) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      console.warn('[Speech Recognition Event]', event.error);
      // If user paused and 'no-speech' fired, but we have captured the question, deliver it!
      if (event.error === 'no-speech' && this.lastTranscript && !hasDeliveredResult) {
        deliverResult(this.lastTranscript.trim());
        return;
      }
      if (event.error === 'aborted') {
        this.isListening = false;
        return;
      }
      // If regional language (te-IN / hi-IN / en-IN) failed with network error, attempt fallback to en-US
      if (event.error === 'network' && recognition.lang !== 'en-US' && !hasDeliveredResult) {
        console.info('[Speech Recognition] Regional language network notice, attempting fallback to en-US...');
        try {
          recognition.lang = 'en-US';
          recognition.start();
          return;
        } catch (_) {}
      }
      this.isListening = false;
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      this.isListening = false;
      // If recognition ended and words were captured, deliver the complete transcript
      if (this.lastTranscript && this.lastTranscript.trim() && !hasDeliveredResult) {
        deliverResult(this.lastTranscript.trim());
      }
      if (onEnd) onEnd();
    };

    try {
      recognition.start();
    } catch (err) {
      this.isListening = false;
      if (onError) onError('Could not access microphone: ' + (err.message || 'Error'));
    }
  }

  // 2. Stop Listening
  stopListening() {
    this.isListening = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.activeRecognition) {
      try {
        this.activeRecognition.onstart = null;
        this.activeRecognition.onerror = null;
        this.activeRecognition.onend = null;
        this.activeRecognition.onresult = null;
        this.activeRecognition.stop();
      } catch (e) {
        try { this.activeRecognition.abort(); } catch (_) {}
      }
      this.activeRecognition = null;
    }
  }

  // 3. Play base64 audio stream with session token and automatic speech synthesis fallback
  playAudioBase64(base64Data, onStart, onEnd, sessionId = null, fallbackText = null, voiceParams = {}) {
    const activeSession = sessionId || ++this.speechSessionId;
    this.speechSessionId = activeSession;

    // Immediately stop and detach any previous audio
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch (_) {}
    }

    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64Data}`);
      this.currentAudio = audio;

      let hasStarted = false;
      const triggerStart = () => {
        if (this.speechSessionId !== activeSession) return;
        if (!hasStarted) {
          hasStarted = true;
          if (onStart) onStart();
        }
      };

      let hasEnded = false;
      const triggerEnd = () => {
        if (!hasEnded) {
          hasEnded = true;
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          if (onEnd) onEnd();
        }
      };

      audio.onplay = triggerStart;
      audio.onended = triggerEnd;
      audio.onerror = (e) => {
        console.warn('Audio playback notice:', e);
        if (fallbackText && this.speechSessionId === activeSession) {
          try {
            this.speak(fallbackText, onStart, onEnd, voiceParams.preferredVoiceId, voiceParams.isNovaSonic, voiceParams.lang, activeSession);
            return;
          } catch (_) {}
        }
        triggerEnd();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play notice (interaction or format):', err);
          if (fallbackText && this.speechSessionId === activeSession) {
            try {
              this.speak(fallbackText, onStart, onEnd, voiceParams.preferredVoiceId, voiceParams.isNovaSonic, voiceParams.lang, activeSession);
              return;
            } catch (_) {}
          }
          triggerEnd();
        });
      }
      return audio;
    } catch (e) {
      console.warn('Failed to play audio:', e);
      if (fallbackText && this.speechSessionId === activeSession) {
        try {
          this.speak(fallbackText, onStart, onEnd, voiceParams.preferredVoiceId, voiceParams.isNovaSonic, voiceParams.lang, activeSession);
          return;
        } catch (_) {}
      }
      if (onEnd) onEnd();
    }
  }

  // 4. Universal Multilingual Speak (Uses High-Quality Neural Voices for Telugu, Hindi, Nova Sonic)
  async speakMultilingual({
    text,
    targetLanguage = 'en',
    preferredVoiceId = null,
    audioBase64 = null,
    isNovaSonic = false,
    onStart,
    onEnd
  }) {
    this.stopSpeaking();
    const mySessionId = ++this.speechSessionId;

    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    const lang = targetLanguage || this.currentLanguage || 'en';
    const voiceId = preferredVoiceId || this.getSelectedVoice();
    const isNeural =
      lang === 'te' ||
      lang === 'hi' ||
      isNovaSonic ||
      (voiceId && (voiceId.includes('neural') || voiceId.includes('nova')));

    // Clean full text for natural pronunciation across all paragraphs
    const cleanedText = this.cleanTextForSpeech(text, lang);
    const voiceParams = { preferredVoiceId: voiceId, isNovaSonic, lang };

    // A. If pre-synthesized base64 audio is already available, play immediately (zero network delay)
    if (audioBase64) {
      return this.playAudioBase64(audioBase64, onStart, onEnd, mySessionId, cleanedText, voiceParams);
    }

    // B. If Neural voice (Telugu, Hindi, Nova Sonic, or Indian English), fetch studio-grade audio from backend
    if (isNeural) {
      const cacheKey = `${lang}_${voiceId}_${cleanedText.substring(0, 60)}_${cleanedText.length}`;
      if (this.audioCache.has(cacheKey)) {
        if (this.speechSessionId !== mySessionId) return;
        return this.playAudioBase64(this.audioCache.get(cacheKey), onStart, onEnd, mySessionId, cleanedText, voiceParams);
      }

      const gender = (voiceId && (voiceId.includes('mohan') || voiceId.includes('madhur') || voiceId.includes('prabhat') || voiceId.includes('male'))) ? 'Male' : 'Female';

      try {
        const res = await chatAPI.synthesizeSpeech(cleanedText, lang, gender, isNovaSonic);
        // MUTEX CHECK: If user clicked Listen again or switched while awaiting, DO NOT PLAY
        if (this.speechSessionId !== mySessionId) return;

        if (res.data?.success && res.data.audioBase64) {
          this.audioCache.set(cacheKey, res.data.audioBase64);
          return this.playAudioBase64(res.data.audioBase64, onStart, onEnd, mySessionId, cleanedText, voiceParams);
        }
      } catch (err) {
        console.warn('Backend neural TTS synthesis notice:', err.message);
      }
    }

    // MUTEX CHECK
    if (this.speechSessionId !== mySessionId) return;

    // C. Fallback: Browser Web Speech API with automatic backend fallback on failure
    try {
      this.speak(cleanedText, onStart, onEnd, voiceId, isNovaSonic, lang, mySessionId);
    } catch (_fallbackErr) {
      const fallbackGender = (voiceId && (voiceId.includes('prabhat') || voiceId.includes('male'))) ? 'Male' : 'Female';
      chatAPI.synthesizeSpeech(cleanedText, lang, fallbackGender, false)
        .then((res) => {
          if (this.speechSessionId !== mySessionId) return;
          if (res.data?.success && res.data.audioBase64) {
            this.playAudioBase64(res.data.audioBase64, onStart, onEnd, mySessionId, cleanedText, voiceParams);
          } else if (onEnd) {
            onEnd();
          }
        })
        .catch(() => { if (onEnd) onEnd(); });
    }
  }

  // Helper to expand currency abbreviations, numbers, and / - notation into natural words
  cleanTextForSpeech(rawText, lang = 'en') {
    if (!rawText) return '';
    let t = rawText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*#_`>\[\]~|]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[Source\s*\d+[^\]]*\]/gi, '')
      .replace(/^\s*[-•*]\s+/gm, '')
      .replace(/\/\s*[-=]/g, ''); // strip /- financial suffix

    if (lang === 'te') {
      const numToTe = (n) => {
        const ones = ['', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'];
        const onesPref = ['', 'ఒక', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'];
        const teens = ['పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పంతొమ్మిది'];
        const tens = ['', 'పది', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంభై'];
        if (n === 0) return 'సున్నా';
        const parts = [];
        const cr = Math.floor(n / 10000000); n %= 10000000;
        if (cr > 0) parts.push(`${numToTe(cr)} కోట్ల`);
        const lk = Math.floor(n / 100000); n %= 100000;
        if (lk > 0) parts.push(lk > 1 ? `${numToTe(lk)} లక్షల` : 'ఒక లక్ష');
        const th = Math.floor(n / 1000); n %= 1000;
        if (th > 0) parts.push(th === 1 ? 'వెయ్యి' : `${numToTe(th)} వేల`);
        const hd = Math.floor(n / 100); n %= 100;
        if (hd > 0) parts.push(hd === 1 ? 'వందల' : `${onesPref[hd]} వందల`);
        if (n > 0) {
          if (n < 10) parts.push(ones[n]);
          else if (n < 20) parts.push(teens[n - 10]);
          else {
            const tDigit = Math.floor(n / 10);
            const uDigit = n % 10;
            parts.push(uDigit === 0 ? tens[tDigit] : `${tens[tDigit]} ${ones[uDigit]}`);
          }
        }
        return parts.join(' ').trim();
      };

      t = t.replace(/(?:₹|రూ\.?|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(లక్ష(?:లు|ల)?|కో(?:ట్లు|ట్ల)?|వేలు?|వేల|lakhs?|crores?|thousands?)\b)?/gi, (m, rawNum, denom) => {
        const val = parseInt(rawNum.replace(/,/g, ''), 10);
        if (isNaN(val)) return m;
        if (denom) {
          const d = (denom.includes('lakh') || denom.includes('లక్ష')) ? 'లక్షల' : ((denom.includes('crore') || denom.includes('కో')) ? 'కోట్ల' : 'వేల');
          return `${numToTe(val)} ${d} రూపాయలు`;
        }
        return `${numToTe(val)} రూపాయలు`;
      });

      t = t.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (m, raw) => {
        const val = parseInt(raw.replace(/,/g, ''), 10);
        return isNaN(val) ? m : numToTe(val);
      });

      t = t.replace(/₹/g, ' రూపాయలు ').replace(/&/g, ' మరియు ').replace(/\/(?!\w)/g, ' లేదా ');
      t = t.replace(/\bPM-KISAN\b/gi, 'పీఎం కిసాన్').replace(/\bPM-JAY\b/gi, 'పీఎం జేవై');
    } else if (lang === 'hi') {
      const numToHi = (n) => {
        const ones = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];
        const teens = ['दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस'];
        const tens = ['', 'दस', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे'];
        if (n === 0) return 'शून्य';
        const parts = [];
        const cr = Math.floor(n / 10000000); n %= 10000000;
        if (cr > 0) parts.push(`${numToHi(cr)} करोड़`);
        const lk = Math.floor(n / 100000); n %= 100000;
        if (lk > 0) parts.push(`${numToHi(lk)} लाख`);
        const th = Math.floor(n / 1000); n %= 1000;
        if (th > 0) parts.push(`${numToHi(th)} हज़ार`);
        const hd = Math.floor(n / 100); n %= 100;
        if (hd > 0) parts.push(`${ones[hd]} सौ`);
        if (n > 0) {
          if (n < 10) parts.push(ones[n]);
          else if (n < 20) parts.push(teens[n - 10]);
          else {
            const tDigit = Math.floor(n / 10);
            const uDigit = n % 10;
            parts.push(uDigit === 0 ? tens[tDigit] : `${tens[tDigit]} ${ones[uDigit]}`);
          }
        }
        return parts.join(' ').trim();
      };

      t = t.replace(/(?:₹|रु\.?|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(लाख|करोड़|हज़ार|lakhs?|crores?|thousands?)\b)?/gi, (m, rawNum, denom) => {
        const val = parseInt(rawNum.replace(/,/g, ''), 10);
        if (isNaN(val)) return m;
        if (denom) {
          const d = denom.includes('लाख') ? 'लाख' : (denom.includes('करोड़') ? 'करोड़' : 'हज़ार');
          return `${numToHi(val)} ${d} रुपये`;
        }
        return `${numToHi(val)} रुपये`;
      });

      t = t.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (m, raw) => {
        const val = parseInt(raw.replace(/,/g, ''), 10);
        return isNaN(val) ? m : numToHi(val);
      });

      t = t.replace(/₹/g, ' रुपये ').replace(/&/g, ' और ').replace(/\/(?!\w)/g, ' या ');
      t = t.replace(/\bPM-KISAN\b/gi, 'पीएम किसान').replace(/\bPM-JAY\b/gi, 'पीएम जेएवाई');
    } else {
      t = t.replace(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(lakhs?|crores?|thousands?|k|m|b)\b)?/gi, (m, rawNum, denom) => {
        const clean = rawNum.replace(/,/g, '');
        return denom ? `${clean} ${denom} rupees` : `${clean} rupees`;
      });
      t = t.replace(/₹/g, ' rupees ').replace(/&/g, ' and ');
    }

    // Preserve full response for citizen (up to 4000 characters safety ceiling)
    return t.replace(/\s+/g, ' ').trim().substring(0, 4000);
  }


  // 5. Standard Browser Web Speech API fallback
  speak(text, onStart, onEnd, preferredVoiceId = null, isNovaSonic = false, lang = 'en', sessionId = null) {
    const activeSession = sessionId || ++this.speechSessionId;
    this.speechSessionId = activeSession;

    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    try { this.synth.cancel(); } catch (_) {}
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }

    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = this.cleanTextForSpeech(text, lang);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (isNovaSonic) {
      utterance.rate = 1.05;
      utterance.pitch = 1.02;
    } else {
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
    }

    const targetVoiceId = preferredVoiceId || this.getSelectedVoice();
    const available = this.synth.getVoices();

    if (targetVoiceId && available.length > 0) {
      const match = available.find((v) => v.name === targetVoiceId || v.voiceURI === targetVoiceId);
      if (match) {
        utterance.voice = match;
      }
    }

    // Language-specific voice fallback
    if (!utterance.voice && this.currentLanguage === 'hi') {
      const hiMatch = available.find((v) => v.lang.startsWith('hi'));
      if (hiMatch) utterance.voice = hiMatch;
    } else if (!utterance.voice && this.currentLanguage === 'te') {
      const teMatch = available.find((v) => v.lang.startsWith('te'));
      if (teMatch) utterance.voice = teMatch;
    }

    // Default fallback
    if (!utterance.voice && available.length > 0) {
      const maleVoice = available.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('David') || v.name.includes('Mark') || v.name.includes('George') || v.name.includes('Male'))
      );
      if (maleVoice) utterance.voice = maleVoice;
    }

    let hasEnded = false;
    let resumeInterval = null;
    let speechWatchdog = null;

    const triggerEnd = () => {
      if (!hasEnded) {
        hasEnded = true;
        if (resumeInterval) clearInterval(resumeInterval);
        if (speechWatchdog) clearTimeout(speechWatchdog);
        if (onEnd) onEnd();
      }
    };

    utterance.onstart = () => {
      if (this.speechSessionId !== activeSession) {
        try { this.synth.cancel(); } catch (_) {}
        return;
      }
      if (onStart) onStart();
    };

    utterance.onend = triggerEnd;
    utterance.onerror = (err) => {
      console.warn('SpeechSynthesis error:', err);
      triggerEnd();
    };

    // Chromium bug workaround: speechSynthesis can pause on long text. Resume periodically
    resumeInterval = setInterval(() => {
      if (!this.synth || !this.synth.speaking || hasEnded) {
        if (resumeInterval) clearInterval(resumeInterval);
      } else {
        this.synth.pause();
        this.synth.resume();
      }
    }, 8000);

    // Watchdog: estimated duration based on text length (approx 12 chars/sec + 6s buffer)
    const maxDurationMs = Math.max(6000, (cleanText.length / 12) * 1000 + 6000);
    speechWatchdog = setTimeout(() => {
      if (!hasEnded) {
        triggerEnd();
      }
    }, maxDurationMs);

    this.synth.speak(utterance);
  }

  // 6. Cancel Speech
  stopSpeaking() {
    this.speechSessionId++;
    if (this.synth) {
      try { this.synth.cancel(); } catch (_) {}
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }
  }
}

export const voiceAssistant = new VoiceAssistant();
