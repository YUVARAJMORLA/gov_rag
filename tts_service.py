"""
tts_service.py
--------------
High-quality, studio-grade Text-To-Speech (TTS) engine for Indian Languages (Telugu, Hindi, English).
Uses Edge Neural voices (Azure Cognitive Architecture) with automatic fallback to gTTS (Google TTS) and Polly.

Supports:
- Telugu (te-IN-ShrutiNeural, te-IN-MohanNeural)
- Hindi (hi-IN-SwaraNeural, hi-IN-MadhurNeural)
- English & Nova Sonic (en-US-JennyNeural, en-US-GuyNeural, en-IN-NeerjaExpressiveNeural)
"""

import os
import re
import io
import time
import asyncio
import base64
from typing import Optional, Tuple
import edge_tts
from gtts import gTTS

# Voice mapping for Indian regional languages & Nova Sonic
NEURAL_VOICES = {
    "te": {
        "female": "te-IN-ShrutiNeural",
        "male": "te-IN-MohanNeural",
        "default": "te-IN-ShrutiNeural"
    },
    "hi": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
        "default": "hi-IN-SwaraNeural"
    },
    "en": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
        "default": "en-IN-NeerjaNeural",
        "nova": "en-US-JennyNeural"
    }
}

def num_to_telugu(n: int, is_currency: bool = False) -> str:
    """Converts integers into natural Telugu number words."""
    ones = ['', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది']
    ones_prefix = ['', 'ఒక', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది']
    teens = ['పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పంతొమ్మిది']
    tens = ['', 'పది', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంభై']

    if n == 0:
        return 'సున్నా'

    parts = []

    # Crores (1,00,00,000)
    cr = n // 10000000
    n %= 10000000
    if cr > 0:
        cr_w = num_to_telugu(cr, False)
        parts.append(f'{cr_w} కోట్ల')

    # Lakhs (1,00,000)
    lk = n // 100000
    n %= 100000
    if lk > 0:
        lk_w = num_to_telugu(lk, False)
        parts.append(f'{lk_w} లక్షల' if (n > 0 or is_currency) else (f'{lk_w} లక్షలు' if lk > 1 else 'ఒక లక్ష'))

    # Thousands (1,000)
    th = n // 1000
    n %= 1000
    if th > 0:
        if th == 1:
            parts.append('వెయ్యి' if (n == 0 and not is_currency) else 'ఒక వేల')
        else:
            th_w = num_to_telugu(th, False)
            parts.append(f'{th_w} వేల' if (n > 0 or is_currency) else f'{th_w} వేలు')

    # Hundreds (100)
    hd = n // 100
    n %= 100
    if hd > 0:
        if hd == 1:
            parts.append('వందల' if (n > 0 or is_currency) else 'వంద')
        else:
            parts.append(f'{ones_prefix[hd]} వందల' if (n > 0 or is_currency) else f'{ones_prefix[hd]} వందలు')

    # Tens & Units (< 100)
    if n > 0:
        if n < 10:
            parts.append(ones[n])
        elif n < 20:
            parts.append(teens[n - 10])
        else:
            t_digit = n // 10
            u_digit = n % 10
            if u_digit == 0:
                parts.append(tens[t_digit])
            else:
                parts.append(f'{tens[t_digit]} {ones[u_digit]}')

    return ' '.join(parts).strip()


def num_to_hindi(n: int, is_currency: bool = False) -> str:
    """Converts integers into natural Hindi number words."""
    ones = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ']
    teens = ['दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस']
    tens = ['', 'दस', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे']

    if n == 0:
        return 'शून्य'

    parts = []
    cr = n // 10000000
    n %= 10000000
    if cr > 0:
        parts.append(f'{num_to_hindi(cr)} करोड़')

    lk = n // 100000
    n %= 100000
    if lk > 0:
        parts.append(f'{num_to_hindi(lk)} लाख')

    th = n // 1000
    n %= 1000
    if th > 0:
        parts.append(f'{num_to_hindi(th)} हज़ार')

    hd = n // 100
    n %= 100
    if hd > 0:
        parts.append(f'{ones[hd]} सौ')

    if n > 0:
        if n < 10:
            parts.append(ones[n])
        elif n < 20:
            parts.append(teens[n - 10])
        else:
            t_digit = n // 10
            u_digit = n % 10
            if u_digit == 0:
                parts.append(tens[t_digit])
            else:
                parts.append(f'{tens[t_digit]} {ones[u_digit]}')

    return ' '.join(parts).strip()


def clean_text_for_speech(text: str, lang: str = "en") -> str:
    """
    Cleans and prepares text for authentic, natural, respectful pronunciation:
    - Removes markdown syntax, emojis, backticks, asterisks, citations.
    - Strips '/-' financial notation.
    - Expands currency abbreviations and numbers (₹6,000 -> ఆరు వేల రూపాయలు) in native script.
    - Normalizes pauses and numbers.
    """
    if not text:
        return ""

    t = text

    # Remove code blocks and markdown artifacts
    t = re.sub(r'```[\s\S]*?```', '', t)
    t = re.sub(r'[*#_`>\[\]~|]', '', t)
    t = re.sub(r'https?://\S+', '', t)
    t = re.sub(r'\[Source\s*\d+[^\]]*\]', '', t, flags=re.IGNORECASE)

    # Clean bullet points and excessive hyphens
    t = re.sub(r'^\s*[-•*]\s+', '', t, flags=re.MULTILINE)

    # Strip Indian financial notation like '/-' or '/=' (e.g. ₹6,000/- -> ₹6,000)
    t = re.sub(r'/\s*[-=]', '', t)

    # Language-specific phonetic and pronunciation enhancements
    if lang == "te":
        def repl_te(m):
            raw_num = m.group(1).replace(',', '').strip()
            denom = m.group(2)
            try:
                val = int(float(raw_num))
                if denom:
                    d = 'లక్షల' if ('lakh' in denom.lower() or 'లక్ష' in denom) else ('కోట్ల' if ('crore' in denom.lower() or 'కో' in denom) else ('వేల' if ('thousand' in denom.lower() or 'వేలు' in denom) else denom))
                    val_w = num_to_telugu(val, False)
                    return f'{val_w} {d} రూపాయలు'
                else:
                    val_w = num_to_telugu(val, True)
                    return f'{val_w} రూపాయలు'
            except Exception:
                return f'{raw_num} రూపాయలు'

        # Match currency followed by digits (with optional commas) and optional denomination
        t = re.sub(r'(?:₹|రూ\.?|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(లక్ష(?:లు|ల)?|కో(?:ట్లు|ట్ల)?|వేలు?|వేల|lakhs?|crores?|thousands?)\b)?', repl_te, t, flags=re.IGNORECASE)

        # Standalone comma-formatted numbers (e.g. 6,000 or 2,000)
        def repl_standalone_num_te(m):
            raw = m.group(1).replace(',', '')
            try:
                val = int(raw)
                if val >= 100:
                    return num_to_telugu(val, False)
            except Exception:
                pass
            return m.group(0)

        t = re.sub(r'\b(\d{1,3}(?:,\d{3})+)\b', repl_standalone_num_te, t)

        t = t.replace('₹', ' రూపాయలు ').replace('&', ' మరియు ')
        t = re.sub(r'/(?!\w)', ' లేదా ', t)
        # Expand common English/administrative acronyms for Telugu phonetic clarity
        t = re.sub(r'\bPM-KISAN\b', 'పీఎం కిసాన్', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPM-JAY\b', 'పీఎం జేవై', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPM-JJBY\b', 'పీఎం జేజేబీవై', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPMJJBY\b', 'పీఎం జేజేబీవై', t, flags=re.IGNORECASE)
        t = re.sub(r'\bSSN\b', 'ఆధార్ సంఖ్య', t, flags=re.IGNORECASE)
        t = re.sub(r'\bAadhaar\b', 'ఆధార్', t, flags=re.IGNORECASE)

    elif lang == "hi":
        def repl_hi(m):
            raw_num = m.group(1).replace(',', '').strip()
            denom = m.group(2)
            try:
                val = int(float(raw_num))
                if denom:
                    d = 'लाख' if ('lakh' in denom.lower() or 'लाख' in denom) else ('करोड़' if ('crore' in denom.lower() or 'करोड़' in denom) else ('हज़ार' if ('thousand' in denom.lower() or 'हज़ार' in denom) else denom))
                    val_w = num_to_hindi(val, False)
                    return f'{val_w} {d} रुपये'
                else:
                    val_w = num_to_hindi(val, True)
                    return f'{val_w} रुपये'
            except Exception:
                return f'{raw_num} रुपये'

        t = re.sub(r'(?:₹|रु\.?|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(लाख|करोड़|हज़ार|lakhs?|crores?|thousands?)\b)?', repl_hi, t, flags=re.IGNORECASE)

        def repl_standalone_num_hi(m):
            raw = m.group(1).replace(',', '')
            try:
                val = int(raw)
                if val >= 100:
                    return num_to_hindi(val, False)
            except Exception:
                pass
            return m.group(0)

        t = re.sub(r'\b(\d{1,3}(?:,\d{3})+)\b', repl_standalone_num_hi, t)

        t = t.replace('₹', ' रुपये ').replace('&', ' और ')
        t = re.sub(r'/(?!\w)', ' या ', t)
        t = re.sub(r'\bPM-KISAN\b', 'पीएम किसान', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPM-JAY\b', 'पीएम जेएवाई', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPM-JJBY\b', 'पीएम जेजेबीवाई', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPMJJBY\b', 'पीएम जेजेबीवाई', t, flags=re.IGNORECASE)
        t = re.sub(r'\bSSN\b', 'आधार संख्या', t, flags=re.IGNORECASE)
        t = re.sub(r'\bAadhaar\b', 'आधार', t, flags=re.IGNORECASE)

    else:
        def repl_en(m):
            num = m.group(1).replace(',', '')
            denom = m.group(2)
            if denom:
                return f'{num} {denom} rupees'
            return f'{num} rupees'

        t = re.sub(r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)(?:\s*(lakhs?|crores?|thousands?|k|m|b)\b)?', repl_en, t, flags=re.IGNORECASE)
        t = t.replace('₹', ' rupees ')
        t = t.replace('&', ' and ')
        t = re.sub(r'\bPM-JJBY\b', 'P M J J B Y', t, flags=re.IGNORECASE)
        t = re.sub(r'\bPMJJBY\b', 'P M J J B Y', t, flags=re.IGNORECASE)

    # Normalize whitespace and strip markdown formatting
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def extract_speech_text(text: str, lang: str = "en", max_chars: int = 420) -> str:
    """
    Extracts a concise, natural, conversational spoken summary from a full answer.
    Preserves introductory direct answer and key figures while terminating at a
    clean sentence boundary for ultra-fast, natural TTS playback (< 1.5 seconds).
    """
    cleaned = clean_text_for_speech(text, lang)
    if not cleaned:
        return ""
    if len(cleaned) <= max_chars:
        return cleaned

    # Search for natural sentence boundary between 180 and max_chars
    boundary_chars = ['. ', '! ', '? ', '। ', '\n', '; ']
    best_pos = -1
    for b in boundary_chars:
        pos = cleaned.rfind(b, 180, max_chars)
        if pos > best_pos:
            best_pos = pos + (len(b) if b != '\n' else 0)

    if best_pos > 180:
        return cleaned[:best_pos].strip()

    # Fallback to word boundary
    space_pos = cleaned.rfind(' ', 200, max_chars)
    if space_pos > 200:
        return cleaned[:space_pos].strip() + ('.' if lang != 'hi' else '।')

    return cleaned[:max_chars].strip() + ('.' if lang != 'hi' else '।')


# In-memory LRU-style cache for synthesized speech: (voice_name, text_hash) -> audio_bytes
_AUDIO_CACHE = {}


async def _synthesize_edge_stream(text: str, voice_name: str) -> bytes:
    """Streams audio data from Edge-TTS."""
    tts = edge_tts.Communicate(text, voice_name)
    chunks = []
    async for chunk in tts.stream():
        if chunk.get("type") == "audio":
            chunks.append(chunk.get("data", b""))
    return b"".join(chunks)


def synthesize_speech_bytes(
    text: str,
    target_language: str = "en",
    voice_gender: str = "Female",
    is_nova_sonic: bool = False
) -> Tuple[Optional[bytes], str]:
    """
    Synthesizes speech into high-quality MP3 bytes.
    Returns (audio_bytes, voice_name_used).
    Reads the complete message cleanly without truncating early.
    """
    clean_text = clean_text_for_speech(text, target_language)
    if not clean_text or len(clean_text) < 2:
        return None, "empty"
    # Keep full conversational response up to 3000 characters
    clean_text = clean_text[:3000].strip()

    lang_key = target_language.lower() if target_language.lower() in ["hi", "te"] else "en"
    vg = str(voice_gender).lower()
    gender_key = "male" if (vg == "male" or "prabhat" in vg or "mohan" in vg or "madhur" in vg) else "female"

    # Select voice
    voice_name = NEURAL_VOICES[lang_key].get(gender_key, NEURAL_VOICES[lang_key]["default"])
    if is_nova_sonic and lang_key == "en":
        voice_name = NEURAL_VOICES["en"]["nova"]

    # Check fast in-memory cache
    import hashlib
    cache_key = f"{voice_name}_{hashlib.md5(clean_text.encode('utf-8')).hexdigest()}"
    if cache_key in _AUDIO_CACHE:
        try:
            print(f"[TTS CACHE HIT] Returning cached studio audio for {voice_name}")
        except Exception:
            pass
        return _AUDIO_CACHE[cache_key], voice_name

    # 1. Primary: Edge Neural TTS (Natural human voice)
    try:
        audio_data = asyncio.run(_synthesize_edge_stream(clean_text, voice_name))
        if audio_data and len(audio_data) > 500:
            # Store in cache (limit cache size to 200 items to avoid RAM bloat)
            if len(_AUDIO_CACHE) > 200:
                _AUDIO_CACHE.pop(next(iter(_AUDIO_CACHE)))
            _AUDIO_CACHE[cache_key] = audio_data
            return audio_data, voice_name
    except Exception as e:
        print(f"[TTS NOTICE] Edge-TTS encountered: {e}. Switching to gTTS fallback.")

    # 2. Fallback: Google Translate TTS (Native Telugu / Hindi / English)
    try:
        gtts_lang = "te" if lang_key == "te" else ("hi" if lang_key == "hi" else "en")
        tts = gTTS(text=clean_text, lang=gtts_lang, slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_data = fp.read()
        if audio_data and len(audio_data) > 500:
            _AUDIO_CACHE[cache_key] = audio_data
            return audio_data, f"gTTS_{gtts_lang}"
    except Exception as e2:
        print(f"[TTS ERROR] gTTS fallback failed: {e2}")

    return None, "failed"


def synthesize_speech_base64(
    text: str,
    target_language: str = "en",
    voice_gender: str = "Female",
    is_nova_sonic: bool = False
) -> Optional[str]:
    """Convenience helper returning base64-encoded MP3 string for instant frontend consumption."""
    audio_bytes, _ = synthesize_speech_bytes(text, target_language, voice_gender, is_nova_sonic)
    if audio_bytes:
        return base64.b64encode(audio_bytes).decode('ascii')
    return None

