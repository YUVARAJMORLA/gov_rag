"""
guardrails.py
-------------
Security and Privacy Guardrails matching reference implementation:
1. PII Masking: Emails, Cards, Aadhaar, SSN, PAN, Phones, Names.
2. Prompt Injection & Jailbreak Detection.
3. LLM Answer Quality & Refusal Detection.
"""

import re
import unicodedata
from typing import Tuple

# --- PII Masking (applied BEFORE sending to LLM / embedding) ---
_PII_PATTERNS = [
    ("EMAIL", re.compile(r'\b[\w.+-]+@[\w.-]+\.\w{2,}\b'), '[EMAIL]'),
    ("CARD", re.compile(r'\b(?:\d[ -]?){13,19}\b'), '[CARD]'),
    ("AADHAAR", re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b'), '[AADHAAR]'),
    ("SSN", re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN]'),
    ("PAN", re.compile(r'\b[A-Z]{5}\d{4}[A-Z]\b'), '[PAN]'),
    ("PHONE", re.compile(r'\b(\+?91[\s-]?)?[6-9]\d{9}\b'), '[PHONE]'),
    ("PHONE", re.compile(r'\+\d{1,3}[\s-]?\d{4,14}\b'), '[PHONE]'),
    ("NAME", re.compile(r'\b(?:(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+|(?:my name is|i am)\s+[A-Z][a-z]+)\b', re.IGNORECASE), '[NAME]'),
]


def mask_pii(text: str) -> Tuple[str, bool, list]:
    """
    Mask PII (emails, phones, cards, Aadhaar, PAN, SSN, names) in text.
    Returns (masked_text, was_masked, list_of_detected_categories).
    """
    if not text:
        return "", False, []
    masked = unicodedata.normalize("NFKC", text)
    original = masked
    categories = []
    for cat, pattern, replacement in _PII_PATTERNS:
        if pattern.search(masked):
            if cat not in categories:
                categories.append(cat)
            masked = pattern.sub(replacement, masked)
    return masked, masked != original, categories


# --- Prompt Injection / Jailbreak Detection ---
_INJECTION_CATEGORIES = [
    ("system_command", [
        "sudo", "shutdown", "reboot", "poweroff", "halt", "init 0", "init 6",
        "rm -rf", "rmdir", "del /f", "format c:", "diskpart",
        "chmod", "chown", "kill -9", "pkill", "taskkill",
        "cat /etc/passwd", "cat /etc/shadow", "type c:\\windows",
        "curl http", "wget http", "nc -e", "netcat", "nmap",
        "run \"sudo", "run 'sudo", "run sudo",
        "run \"shutdown", "run 'shutdown", "run shutdown"
    ]),
    ("shell_execution", [
        "/bin/sh", "/bin/bash", "powershell", "cmd.exe", "cmd /c",
        "sh -c", "bash -c", "bash -i"
    ]),
    ("code_execution", [
        "os.system(", "subprocess.", "__import__", "import sys", "import os",
        "exec(", "eval("
    ]),
    ("sql_injection", [
        "drop table", "delete from", "truncate table", "union select",
        "1=1--", "exec xp_cmdshell"
    ]),
    ("instruction_override", [
        "ignore previous", "ignore all", "ignore the", "disregard the",
        "forget your", "forget all", "override", "new instructions", "disregard all"
    ]),
    ("persona_jailbreak", [
        "you are now", "act as", "pretend you are", "pretend to be",
        "dan mode", "developer mode", "do anything now"
    ]),
    ("system_prompt_leak", [
        "system prompt", "reveal your", "show your prompt",
        "what are your instructions", "what is your system prompt", "print your prompt"
    ]),
    ("rule_bypass", [
        "jailbreak", "ignore the rules", "ignore the context", "bypass", "unfiltered"
    ])
]


def detect_prompt_injection(text: str) -> Tuple[bool, str]:
    """
    Detect common prompt injection, shell commands, and jailbreak attempts.
    Returns (is_injection_detected, comma_separated_categories_or_empty).
    """
    if not text:
        return False, ""
    lower = text.lower()
    detected = []
    for cat, patterns in _INJECTION_CATEGORIES:
        if any(p in lower for p in patterns):
            if cat not in detected:
                detected.append(cat)
    if detected:
        return True, ", ".join(detected)
    return False, ""


def detect_prompt_injections(text: str) -> Tuple[bool, list]:
    """
    Returns (is_detected, list_of_detected_categories).
    """
    if not text:
        return False, []
    lower = text.lower()
    detected = []
    for cat, patterns in _INJECTION_CATEGORIES:
        if any(p in lower for p in patterns):
            if cat not in detected:
                detected.append(cat)
    return bool(detected), detected


# --- Content Safety Detection (Profanity, Hate, Violent, Harmful, Sexual, Sexual Violence) ---
_SAFETY_CATEGORIES = [
    ("violence_sexual", [
        "rape", "raping", "rapist", "sexual assault", "sexually assaulted", "molest", "molestation",
        "gang rape", "gangrape", "non-consensual", "sexual violence", "forced sex", "force sex",
        "child abuse", "pedophile", "paedophile", "grooming minor",
        "बलात्कार", "यौन शोषण", "यौन हमला", "లైంగిక దాడి", "అత్యాచారం", "శీలభంగం"
    ]),
    ("sexual", [
        "porn", "pornography", "xxx", "erotic", "nsfw", "blowjob", "handjob", "masturbat",
        "nude pictures", "naked girls", "naked boys", "sexy video", "hardcore sex", "pussy",
        "dick", "vagina", "penis", "boobs", "orgasm", "cumming", "sex video", "adult content",
        "escort service", "call girl", "striptease",
        "पोर्न", "अश्लील", "नग्न", "सెక్స్", "నీలి చిత్రాలు", "నగ్న"
    ]),
    ("violent", [
        "kill them", "murder him", "murder her", "massacre", "decapitate", "behead", "slit throat",
        "shoot to kill", "bomb attack", "terrorist attack", "blow up", "stab to death", "assassinate",
        "genocide", "bloodbath", "lynch", "hang him", "hang her", "execute them", "torture them",
        "जान से मार", "हत्या", "कत्ल", "नरसंहार", "చంపేయ్", "హత్య", "హింస"
    ]),
    ("harmful", [
        "how to commit suicide", "kill myself", "commit suicide", "hang myself", "cut my wrists",
        "make a bomb", "make an explosive", "synthesize ricin", "cyanide poisoning", "make poison",
        "how to overdose", "ways to die", "self harm", "manufacture meth", "bioweapon",
        "आत्महत्या", "खुदकुशी", "ज़हर", "బాంబు తయారీ", "ఆత్మహత్య"
    ]),
    ("hate", [
        "subhuman", "kill all muslims", "kill all hindus", "kill all christians", "kill all jews",
        "racial slur", "exterminate race", "ethnic cleansing", "caste slur", "chamar", "bhangi",
        "nigger", "faggot", "chink", "death to all", "vermin race",
        "नीच जाति", "नफ़रत", "విద్వేషం"
    ]),
    ("profanity", [
        "fuck", "fucking", "fucker", "motherfucker", "bitch", "bastard", "asshole", "bullshit",
        "cunt", "whore", "slut", "madarchod", "bhenchod", "chutiya", "gaand", "harami", "kamine",
        "randi", "bhosdike", "lavde", "dengu", "lanja", "na kodaka", "modda", "guddha",
        "मादरचोद", "बहनचोद", "चूतिया", "हरामी", "దెంగు", "లంజ"
    ])
]


def detect_unsafe_content(text: str) -> Tuple[bool, list]:
    """
    Detects safety policy violations across 6 categories:
    profanity, hate speech, violent content, harmful/self-harm, sexual content, and sexual violence.
    Returns (is_unsafe_detected, list_of_violated_categories).
    """
    if not text:
        return False, []
    lower = unicodedata.normalize("NFKC", text).lower()
    violated = []
    for cat, patterns in _SAFETY_CATEGORIES:
        for p in patterns:
            if " " in p:
                if p in lower:
                    if cat not in violated:
                        violated.append(cat)
                    break
            else:
                if re.search(r'\b' + re.escape(p) + r'\b', lower):
                    if cat not in violated:
                        violated.append(cat)
                    break
    return bool(violated), violated


def scan_security_guardrails(text: str) -> dict:
    """
    Comprehensive multi-threat scanner for PII, Prompt Injections/Commands,
    and Content Safety (Profanity, Hate, Violent, Harmful, Sexual, Sexual Violence).
    Returns structured analysis for telemetry, observability, and neutralization.
    """
    masked_text, pii_detected, pii_categories = mask_pii(text)
    injection_detected, injection_categories = detect_prompt_injections(text)
    safety_violated, safety_categories = detect_unsafe_content(text)

    # Neutralize injection / command patterns while preserving genuine citizen query
    neutralized_text = masked_text
    if injection_detected:
        threat_patterns = [
            r'(?i)run\s+["\']?(?:sudo|shutdown|reboot|rm\s+-rf|powershell|bash|cmd)[^"\']*["\']?',
            r'(?i)\bsudo\s+[a-z0-9_.-]+(?:\s+now)?\b',
            r'(?i)\bshutdown\s+(?:-h\s+now|-r\s+now|now|/s|/r)\b',
            r'(?i)\b(?:rm\s+-rf|rmdir\s+/s|format\s+[a-z]:)\b',
            r'(?i)(?:ignore\s+previous\s+instructions|ignore\s+all\s+instructions|disregard\s+the\s+rules|act\s+as\s+dan|bypass|jailbreak|reveal\s+system\s+prompt|you\s+are\s+now|developer\s+mode|dan\s+mode|do\s+anything\s+now)\b.*?'
        ]
        for pat in threat_patterns:
            neutralized_text = re.sub(pat, '', neutralized_text)
        neutralized_text = re.sub(r'\s+', ' ', neutralized_text).strip()

    has_threats = (
        (pii_detected and injection_detected) or 
        safety_violated or 
        (len(pii_categories) + len(injection_categories) + len(safety_categories) > 1)
    )

    return {
        "pii_masked": pii_detected,
        "pii_categories": pii_categories,
        "injection_detected": injection_detected,
        "injection_categories": injection_categories,
        "primary_injection_category": injection_categories[0] if injection_categories else None,
        "safety_violated": safety_violated,
        "safety_categories": safety_categories,
        "primary_safety_category": safety_categories[0] if safety_categories else None,
        "has_multiple_threats": has_threats,
        "raw_text": text,
        "masked_text": masked_text,
        "safe_query": neutralized_text if len(neutralized_text) >= 3 else ""
    }


# --- LLM Quality / Refusal Check ---
_NEG = [
    "i don't know", "i cannot", "i'm unable", "not sure",
    "the context doesn't contain", "the context does not contain",
    "i don't have", "no information", "cannot answer",
    "no relevant information", "does not provide",
    "not enough information", "insufficient information",
    "based on general knowledge", "however, i can provide",
    "based on my own knowledge", "from my training data",
    "outside the provided context", "beyond the provided context",
    "i can tell you that", "generally known",
    "not covered in the context", "not mentioned in the context",
    "i do not have information",
    "not able to provide", "unable to provide", "cannot provide",
    "not related to", "not within the scope", "beyond the scope of",
    "outside the scope", "as it is not related", "i am not able",
    # Indic Refusal markers (Telugu & Hindi)
    "పరిధిలో లేదు", "సమాచారం అందుబాటులో లేదు", "సమాచారం లేదు",
    "దాయరే సే బాహర్", "जानकारी उपलब्ध नहीं", "जानकारी नहीं है"
]


def check_llm_answering(ans: str) -> bool:
    """Returns True if the LLM successfully answered, False if it refused or lacked context."""
    if not ans or len(ans.strip()) < 10:
        return False
    return not any(p in ans.lower() for p in _NEG)

