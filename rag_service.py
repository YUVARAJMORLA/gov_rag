"""
rag_service.py
--------------
Coordinates:
1. PII masking & Prompt Injection Guardrails (as per reference app.py)
2. Databricks Embeddings:
   - Uses 'databricks-gte-large-en' serving endpoint to compute query vectors
3. Databricks Vector AI Search:
   - Queries 'rag_catalog.rag_gov_schema.gold_vector_index' with query_vector
4. Multi-Model Generation:
   - AWS Bedrock Converse API (google.gemma-3-12b-it, nvidia.nemotron-super-3-120b, amazon.nova-2-5-sonic)
   - Databricks Foundation Model Serving (databricks-meta-llama-3-3-70b-instruct)
5. Telemetry & Governance:
   - Logs directly to Databricks tables (user_queries, rag_observability, rag_retrieval_logs)
"""

import os
import re
import sys
import time
import json
import uuid
from typing import Dict, Any, List, Tuple, Optional
import boto3
from botocore.config import Config
import requests
from dotenv import load_dotenv

# Ensure stdout and stderr handle multilingual characters (Telugu, Hindi) safely on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from guardrails import (
    mask_pii,
    detect_prompt_injection,
    check_llm_answering,
    scan_security_guardrails
)
from db_connector import (
    w,
    DB,
    BATCH_ID,
    log_user_query,
    log_observability,
    log_retrieval
)
from tts_service import synthesize_speech_bytes, clean_text_for_speech

load_dotenv()

# ------------------------------------------------------------------
# DYNAMIC MODEL PRICING & COST ESTIMATION (Per 1,000 Tokens / Audio Sec)
# Configurable via environment variables without hardcoded fixed rates
# ------------------------------------------------------------------
BEDROCK_MODEL_PRICING = {
    # Google Gemma 3 12B IT (Published AWS Bedrock: ~$0.15/1M in, ~$0.20/1M out)
    "gemma": {
        "input_per_1k": float(os.getenv("PRICE_GEMMA_INPUT_PER_1K", "0.00015")),
        "output_per_1k": float(os.getenv("PRICE_GEMMA_OUTPUT_PER_1K", "0.00020")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    # NVIDIA Nemotron Super 3 120B (Published AWS Bedrock: ~$2.00/1M in, ~$6.00/1M out)
    "nemotron": {
        "input_per_1k": float(os.getenv("PRICE_NEMOTRON_INPUT_PER_1K", "0.00200")),
        "output_per_1k": float(os.getenv("PRICE_NEMOTRON_OUTPUT_PER_1K", "0.00600")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    # Mistral Devstral 2 123B (Published AWS Bedrock: ~$2.00/1M in, ~$6.00/1M out)
    "mistral": {
        "input_per_1k": float(os.getenv("PRICE_MISTRAL_INPUT_PER_1K", "0.00200")),
        "output_per_1k": float(os.getenv("PRICE_MISTRAL_OUTPUT_PER_1K", "0.00600")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    "devstral": {
        "input_per_1k": float(os.getenv("PRICE_DEVSTRAL_INPUT_PER_1K", "0.00200")),
        "output_per_1k": float(os.getenv("PRICE_DEVSTRAL_OUTPUT_PER_1K", "0.00600")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    # Amazon Nova 2.5 Sonic (Text: $0.80/1M in, $3.20/1M out; Audio In: $0.0036/min; Audio Out: $0.024/min)
    "nova": {
        "input_per_1k": float(os.getenv("PRICE_NOVA_INPUT_PER_1K", "0.00080")),
        "output_per_1k": float(os.getenv("PRICE_NOVA_OUTPUT_PER_1K", "0.00320")),
        "audio_in_per_sec": float(os.getenv("PRICE_NOVA_AUDIO_IN_PER_SEC", "0.00006")),
        "audio_out_per_sec": float(os.getenv("PRICE_NOVA_AUDIO_OUT_PER_SEC", "0.00040")),
    },
    "sonic": {
        "input_per_1k": float(os.getenv("PRICE_SONIC_INPUT_PER_1K", "0.00080")),
        "output_per_1k": float(os.getenv("PRICE_SONIC_OUTPUT_PER_1K", "0.00320")),
        "audio_in_per_sec": float(os.getenv("PRICE_SONIC_AUDIO_IN_PER_SEC", "0.00006")),
        "audio_out_per_sec": float(os.getenv("PRICE_SONIC_AUDIO_OUT_PER_SEC", "0.00040")),
    },
    # Databricks Meta Llama 3.3 70B Instruct
    "llama": {
        "input_per_1k": float(os.getenv("PRICE_LLAMA_INPUT_PER_1K", "0.00070")),
        "output_per_1k": float(os.getenv("PRICE_LLAMA_OUTPUT_PER_1K", "0.00080")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    "databricks": {
        "input_per_1k": float(os.getenv("PRICE_DATABRICKS_INPUT_PER_1K", "0.00070")),
        "output_per_1k": float(os.getenv("PRICE_DATABRICKS_OUTPUT_PER_1K", "0.00080")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    },
    "default": {
        "input_per_1k": float(os.getenv("PRICE_DEFAULT_INPUT_PER_1K", "0.00070")),
        "output_per_1k": float(os.getenv("PRICE_DEFAULT_OUTPUT_PER_1K", "0.00080")),
        "audio_in_per_sec": 0.0,
        "audio_out_per_sec": 0.0,
    }
}

EMBEDDING_COST_PER_1K = float(os.getenv("EMBEDDING_COST_PER_1K", "0.00010"))


def get_model_pricing(model_name: str) -> Dict[str, float]:
    """Dynamically resolves pricing parameters for a given model identifier."""
    name = (model_name or "").lower()
    for key, pricing in BEDROCK_MODEL_PRICING.items():
        if key != "default" and key in name:
            return pricing
    return BEDROCK_MODEL_PRICING["default"]


def calculate_turn_cost(
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    audio_in_sec: float = 0.0,
    audio_out_sec: float = 0.0
) -> Tuple[float, float, float]:
    """
    Dynamically computes (input_cost, output_cost, total_cost)
    based on model-specific rates and multimodal usage.
    """
    pricing = get_model_pricing(model_name)
    ic = (input_tokens / 1000.0) * pricing["input_per_1k"] + (audio_in_sec * pricing["audio_in_per_sec"])
    oc = (output_tokens / 1000.0) * pricing["output_per_1k"] + (audio_out_sec * pricing["audio_out_per_sec"])
    return ic, oc, ic + oc


# Model Definitions
BEDROCK_MODEL_1 = os.getenv("BEDROCK_MODEL_1", "google.gemma-3-12b-it").strip()
BEDROCK_MODEL_2 = os.getenv("BEDROCK_MODEL_2", "nvidia.nemotron-super-3-120b").strip()
BEDROCK_MODEL_3 = os.getenv("BEDROCK_MODEL_3", "mistral.devstral-2-123b").strip()
BEDROCK_MODEL_4 = os.getenv("BEDROCK_MODEL_4", "amazon.nova-2-5-sonic").strip()

BEDROCK_MODELS = [
    BEDROCK_MODEL_1,
    BEDROCK_MODEL_2,
    BEDROCK_MODEL_3,
    BEDROCK_MODEL_4,
]
DATABRICKS_FALLBACK_LLM = (
    os.getenv("Databricks_LLM_MODEL") or 
    os.getenv("DATABRICKS_FALLBACK_LLM") or 
    "databricks-meta-llama-3-3-70b-instruct"
).strip()
VS_INDEX_NAME = os.getenv("DATABRICKS_INDEX_NAME", f"{DB}.gold_vector_index").strip()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "databricks-gte-large-en").strip()


def get_aws_credentials_kwargs() -> Dict[str, Any]:
    """Helper to retrieve configured AWS credentials."""
    region = os.getenv("AWS_REGION", "us-east-1").strip()
    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
    aws_session_token = os.getenv("AWS_SESSION_TOKEN", "").strip()

    kwargs: Dict[str, Any] = {"region_name": region}
    if aws_access_key_id and aws_secret_access_key:
        kwargs["aws_access_key_id"] = aws_access_key_id
        kwargs["aws_secret_access_key"] = aws_secret_access_key
        if aws_session_token:
            kwargs["aws_session_token"] = aws_session_token
    return kwargs


def get_bedrock_client():
    """Initializes and returns the AWS Bedrock Runtime client."""
    kwargs = get_aws_credentials_kwargs()
    kwargs["service_name"] = "bedrock-runtime"
    kwargs["config"] = Config(retries={"max_attempts": 2, "mode": "standard"})
    return boto3.client(**kwargs)


def get_polly_client():
    """Initializes and returns AWS Polly client for text-to-speech voice generation."""
    kwargs = get_aws_credentials_kwargs()
    kwargs["service_name"] = "polly"
    return boto3.client(**kwargs)


def generate_speech_audio(
    text: str,
    target_language: str = "en",
    voice_gender: str = "Female",
    is_nova_sonic: bool = False
) -> Optional[bytes]:
    """Synthesizes high-fidelity speech audio bytes from text using neural TTS."""
    if not text or not text.strip():
        return None
    try:
        audio_data, _voice = synthesize_speech_bytes(
            text=text,
            target_language=target_language,
            voice_gender=voice_gender,
            is_nova_sonic=is_nova_sonic
        )
        if audio_data:
            return audio_data
    except Exception as e:
        print(f"[SPEECH SYNTHESIS NOTICE] {e}")

    # Fallback to Polly if credentials allow
    try:
        client = get_polly_client()
        clean_text = clean_text_for_speech(text, target_language)[:2500]
        response = client.synthesize_speech(
            Text=clean_text,
            OutputFormat="mp3",
            VoiceId="Aditi" if target_language == "hi" else "Ruth",
            Engine="neural"
        )
        if "AudioStream" in response:
            return response["AudioStream"].read()
    except Exception as e:
        pass
    return None


def get_databricks_embedding(query_text: str) -> List[float]:
    """Computes embedding vector via WorkspaceClient serving_endpoints."""
    try:
        emb = w.serving_endpoints.query(name=EMBEDDING_MODEL, input=query_text)
        if hasattr(emb, 'data') and emb.data:
            return emb.data[0].embedding
        elif isinstance(emb, dict) and "data" in emb and emb["data"]:
            return emb["data"][0]["embedding"]
    except Exception as e:
        # Fallback to direct HTTP endpoint if SDK wrapper encounters format variation
        host = os.getenv("DATABRICKS_SERVER_HOSTNAME", "").strip()
        token = os.getenv("DATABRICKS_TOKEN", "").strip()
        url = f"https://{host}/serving-endpoints/{EMBEDDING_MODEL}/invocations"
        resp = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                             json={"input": [query_text]}, timeout=20)
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    raise ValueError(f"Could not compute embedding from {EMBEDDING_MODEL}")


def query_databricks_vector_search(query_text: str, num_results: int = 5) -> Tuple[List[str], List[float], List[str]]:
    """
    Queries Databricks Vector Search index using computed query_vector.
    Matches reference app.py columns: ['chunk_id', 'file_name', 'chunk_text', 'version'].
    """
    cids, scores, texts = [], [], []

    try:
        # 1. Compute embedding vector
        qv = get_databricks_embedding(query_text)

        # 2. Query index
        endpoint_name = os.getenv("DATABRICKS_VECTOR_SEARCH_ENDPOINT", "rag-gov-endpoint").strip()
        host = os.getenv("DATABRICKS_SERVER_HOSTNAME", "").strip()
        token = os.getenv("DATABRICKS_TOKEN", "").strip()

        from databricks.vector_search.client import VectorSearchClient
        vsc = VectorSearchClient(workspace_url=f"https://{host}", personal_access_token=token, disable_notice=True)
        idx = vsc.get_index(endpoint_name=endpoint_name, index_name=VS_INDEX_NAME)

        # Query index using Databricks HYBRID search (dense semantic embeddings + BM25 keyword matching)
        try:
            vs = idx.similarity_search(
                query_text=query_text,
                query_vector=qv,
                query_type="HYBRID",
                columns=["chunk_id", "file_name", "chunk_text", "version"],
                num_results=num_results
            )
        except Exception as e_hybrid:
            print(f"[HYBRID SEARCH NOTICE] {e_hybrid}. Falling back to standard vector search.")
            vs = idx.similarity_search(
                query_vector=qv,
                columns=["chunk_id", "file_name", "chunk_text", "version"],
                num_results=num_results
            )

        raw = vs.get("result", {}).get("data_array", [])
        for doc in raw:
            cids.append(str(doc[0]) if len(doc) > 0 else str(uuid.uuid4()))
            fname = str(doc[1]) if len(doc) > 1 else ""
            content = str(doc[2]) if len(doc) > 2 else ""
            score = float(doc[-1]) if len(doc) > 3 and isinstance(doc[-1], (int, float)) else 0.85
            
            formatted_text = f"Source ({fname}):\n{content}" if fname else content
            texts.append(formatted_text)
            scores.append(score)

        # Document Relevance Scoring / Threshold Filtering:
        # Databricks Vector Search HYBRID index uses Reciprocal Rank Fusion (RRF) scores (typically 0.001 - 0.05).
        # Direct cosine indexes use 0.0 - 1.0. Detect score scale to prevent dropping high-ranking chunks.
        is_rrf_scoring = any(0.0 < sc < 0.10 for sc in scores) if scores else False
        env_threshold = os.getenv("SIMILARITY_THRESHOLD")

        if env_threshold is not None:
            similarity_threshold = float(env_threshold)
        elif is_rrf_scoring:
            # For RRF hybrid scores, keep top returned results unless score is practically zero
            similarity_threshold = 0.0005
        else:
            similarity_threshold = 0.45

        filtered_cids, filtered_scores, filtered_texts = [], [], []
        for cid, sc, txt in zip(cids, scores, texts):
            if sc >= similarity_threshold:
                filtered_cids.append(cid)
                filtered_scores.append(sc)
                filtered_texts.append(txt)
            else:
                try:
                    print(f"[THRESHOLD FILTER] Excluded chunk '{cid}' with low similarity score ({sc:.4f} < {similarity_threshold})")
                except Exception:
                    pass

        # If strict filtering dropped all chunks but search had returned valid documents, preserve the top results
        if not filtered_cids and cids and not env_threshold:
            print("[THRESHOLD NOTICE] Threshold filtered all chunks; falling back to top returned vector search chunks.")
            filtered_cids, filtered_scores, filtered_texts = cids, scores, texts

        cids = filtered_cids
        scores = filtered_scores
        texts = filtered_texts

    except Exception as e:
        print(f"[VECTOR SEARCH NOTICE] Vector search failed: {e}")
        cids = ["fallback_chunk"]
        scores = [0.0]
        texts = [f"Retrieval notice: {str(e)}"]

    return cids, scores, texts


# ==============================================================================
# OFFICIAL GOVERNMENT SCHEMES CATALOG CONTEXT & OVERVIEW DETECTOR
# Enables comprehensive listing when citizens ask broad catalog questions
# ==============================================================================
OFFICIAL_SCHEMES_CATALOG_CONTEXT = """
OFFICIAL REPOSITORY OF AVAILABLE GOVERNMENT WELFARE SCHEMES:
The platform currently contains verified official documentation and implementation guidelines for the following 11 central government schemes:

1. Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)
   - Category: Agriculture & Farmer Welfare
   - Core Benefit: ₹6,000 per year direct income support transferred in three equal 4-monthly installments of ₹2,000 directly to bank accounts of eligible landholding farmer families.

2. Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)
   - Category: Social Security & Life Insurance
   - Core Benefit: Renewable one-year life insurance coverage of ₹2,00,000 for death due to any cause, available to individuals aged 18 to 50 years with a bank/post office account at an annual premium of ₹436.

3. Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)
   - Category: Universal Healthcare
   - Core Benefit: Cashless health insurance cover up to ₹5,00,000 per eligible family per year for secondary and tertiary care hospitalization across impaneled public and private hospitals.

4. Ayushman Bharat Digital Mission (ABDM)
   - Category: Digital Health Infrastructure
   - Core Benefit: Creation of unique 14-digit Ayushman Bharat Health Account (ABHA numbers) enabling seamless digital sharing and interoperability of personal health records.

5. Pradhan Mantri Mudra Yojana (PMMY)
   - Category: Micro-Enterprise Credit & Entrepreneurship
   - Core Benefit: Collateral-free institutional loans up to ₹10 Lakh across Shishu (up to ₹50,000), Kishore (₹50,000 to ₹5 Lakh), and Tarun (₹5 Lakh to ₹10 Lakh) for micro and small enterprises.

6. PM Vishwakarma Scheme
   - Category: Artisans & Traditional Craftsmen
   - Core Benefit: Recognition with PM Vishwakarma certificate and ID card, basic/advanced skill training with ₹500/day stipend, modern toolkit incentive up to ₹15,000, and collateral-free enterprise credit up to ₹3,00,000 at a concessional 5% interest rate.

7. Beti Bachao Beti Padhao (BBBP)
   - Category: Women & Child Development
   - Core Benefit: National initiative to eliminate gender-biased sex selection, ensure survival, protection, and quality education for the girl child, and promote gender equality.

8. PM-RAHAT (Scheme for Road Accident Victims)
   - Category: Emergency Trauma Care & Healthcare
   - Core Benefit: Immediate cashless medical stabilization and golden-hour emergency treatment up to ₹1.5 Lakh per victim for road accident victims across verified trauma network hospitals.

9. ASPIRE (Scheme for Promotion of Innovation, Rural Industry & Entrepreneurship)
   - Category: MSME & Rural Livelihoods
   - Core Benefit: Financial and technical support to set up Livelihood Business Incubators (LBIs) and Technology Business Incubators (TBIs) to foster agro-rural enterprise and youth entrepreneurship.

10. SFURTI (Scheme of Fund for Regeneration of Traditional Industries)
    - Category: Traditional Industries & Clusters
    - Core Benefit: Grants up to ₹2.5 Crore (Regular clusters) and ₹5 Crore (Major clusters) to organize traditional artisans into productive clusters with Common Facility Centers and modern equipment.

11. Micro and Small Enterprises Cluster Development Programme (MSE-CDP)
    - Category: Industrial Infrastructure
    - Core Benefit: Grant assistance for setting up Common Facility Centers (CFCs) and developing state-of-the-art infrastructure in industrial clusters of micro and small enterprises.
"""


OFFICIAL_SCHEME_KNOWLEDGE = {
    "ayushman_bharat": """
OFFICIAL SCHEME GUIDELINES: AYUSHMAN BHARAT (PM-JAY & ABDM)
Pillar 1: Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (AB-PMJAY):
- Core Benefit & Financial Coverage: Cashless health insurance cover up to ₹5,00,000 (₹5 Lakh) per family per year for secondary and tertiary care hospitalization across impaneled public and private hospitals nationwide. Covers medical examinations, treatment, consultation, pre-hospitalization (up to 3 days), post-hospitalization (up to 15 days), ICU charges, diagnostics, and medicines.
- Expanded Senior Citizen Coverage: All senior citizens aged 70 years and above are eligible for an additional ₹5,00,000 annual health cover under the Ayushman Vay Vandana Card, regardless of income.
- Eligibility Criteria:
  1. Rural families meeting deprivation criteria (D1 to D7) from Socio-Economic Caste Census (SECC 2011).
  2. Urban families belonging to 11 occupational categories (ragpickers, domestic workers, street vendors, cobblers, construction workers, transport workers, etc.).
  3. Existing beneficiaries of the erstwhile Rashtriya Swasthya Bima Yojana (RSBY).
  4. All senior citizens aged 70 and above.
- Required Documents for Ayushman Card:
  1. Aadhaar Card (mandatory for identity and biometric e-KYC).
  2. Ration Card, Family ID, or official PM-JAY entitlement letter (bearing Family HHD ID number).
  3. Active Mobile Number for verification and OTP.
  4. Age proof for 70+ seniors (Aadhaar or Birth Certificate).
- How to Apply & Generate Ayushman Card:
  1. Check eligibility online at 'mera.pmjay.gov.in' or download the Ayushman App, or call toll-free helpline 14555.
  2. Visit your nearest Common Service Center (CSC), UTIITSL/UTI center, or the Arogya Mitra desk at any empaneled hospital.
  3. Undergo biometric e-KYC verification to generate and download your Ayushman Card (Golden Card).

Pillar 2: Ayushman Bharat Digital Mission (ABDM):
- Core Benefit: Creates a 14-digit unique Ayushman Bharat Health Account (ABHA number) and digital health card for every citizen, enabling seamless digital storage and sharing of electronic medical records, lab reports, and prescriptions with verified doctors and hospitals.
- How to Register for ABHA: Visit 'abdm.gov.in' or download the ABHA App or use Aarogya Setu; complete instant verification with Aadhaar number and OTP.
""",

    "pm_kisan": """
OFFICIAL SCHEME GUIDELINES: PRADHAN MANTRI KISAN SAMMAN NIDHI (PM-KISAN)
- Core Benefit & Financial Figures: ₹6,000 per year direct income support transferred in three equal four-monthly installments of ₹2,000 each (April-July, August-November, December-March) directly into the Aadhaar-linked bank accounts of beneficiary farmers via Direct Benefit Transfer (DBT).
- Eligibility Criteria:
  1. Small and marginal landholder farmer families with cultivable landholding registered in their names as per state land revenue records.
  2. Family comprises husband, wife, and minor children.
  3. Exclusions: Institutional landholders, former or present holders of constitutional posts, current or former Ministers/MPs/MLAs, serving or retired government officers/employees, professionals (doctors, engineers, lawyers, CAs), and persons who paid income tax in the last assessment year or receive monthly pension of ₹10,000 or more.
- Required Documents:
  1. Aadhaar Card (mandatory with completed e-KYC).
  2. Land Ownership Proof: Record of Rights (RoR), Khasra-Khatauni, Patta, or Jamabandi showing applicant as landholder.
  3. Active Savings Bank Account passbook with IFSC code (must be Aadhaar-seeded and NPCI-mapped).
  4. Mobile Number linked to Aadhaar.
  5. Passport-size photograph.
- How to Apply:
  1. Online Self-Registration: Visit 'pmkisan.gov.in', click 'Farmers Corner' -> 'New Farmer Registration'. Enter Aadhaar number, state, mobile number, land details, and submit.
  2. In-Person Registration: Visit the nearest Common Service Center (CSC) or contact the local Village Revenue Officer / District Agriculture Officer.
  3. Mandatory e-KYC: Must be completed online via OTP at 'pmkisan.gov.in' or via biometric authentication at any CSC or facial authentication on the PM-KISAN mobile app.
""",

    "pmjjby": """
OFFICIAL SCHEME GUIDELINES: PRADHAN MANTRI JEEVAN JYOTI BIMA YOJANA (PMJJBY)
- Core Benefit & Financial Figures: Renewable one-year term life insurance coverage of ₹2,00,000 (₹2 Lakh) in case of death of the insured member due to any cause (natural or accidental).
- Premium: ₹436 per year per member, auto-debited in a single installment from the subscriber's bank or post office savings account.
- Eligibility Criteria:
  1. Any individual aged 18 to 50 years holding a savings bank or post office account.
  2. Coverage continues up to age 55 years provided annual premium is paid before age 50.
  3. An individual can join through only one savings bank account.
- Required Documents:
  1. Aadhaar Card (as primary KYC).
  2. Savings Bank or Post Office account passbook/details.
  3. Duly completed Consent-cum-Declaration Enrollment Form with auto-debit authorization.
  4. Nominee details (name, relationship, age, and photo ID of nominee).
- How to Apply:
  1. Bank Branch / Post Office: Visit your bank or post office branch and submit the simple one-page PMJJBY consent form.
  2. Net Banking / Mobile Banking: Log into your bank's Internet Banking or mobile banking app, navigate to 'Insurance / Social Security Schemes', select PMJJBY, confirm details, and authorize auto-debit.
""",

    "pmsby": """
OFFICIAL SCHEME GUIDELINES: PRADHAN MANTRI SURAKSHA BIMA YOJANA (PMSBY)
- Core Benefit & Financial Figures: Accidental insurance coverage of ₹2,00,000 (₹2 Lakh) for accidental death or permanent total disability (loss of both eyes or both hands/feet), and ₹1,00,000 for permanent partial disability (loss of one eye or one hand/foot).
- Premium: Highly affordable premium of ₹20 per year per member, auto-debited annually.
- Eligibility Criteria: Individuals aged 18 to 70 years with an active savings bank or post office account.
- Required Documents: Aadhaar Card, savings bank passbook/account details, auto-debit consent form, nominee information.
- How to Apply: Submit the enrollment form at your bank branch, post office, or activate online via your bank's Net Banking / Mobile Banking app.
""",

    "atal_pension": """
OFFICIAL SCHEME GUIDELINES: ATAL PENSION YOJANA (APY)
- Core Benefit & Financial Figures: Guaranteed monthly pension of ₹1,00, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 after attaining 60 years of age until death. After subscriber's death, the exact same pension amount is paid to the spouse. After spouse's demise, the entire accumulated pension wealth (corpus) is returned to the nominee.
- Eligibility Criteria:
  1. Any Indian citizen aged 18 to 40 years holding a savings bank or post office account.
  2. Must not be an income tax payer (as per rules from October 1, 2022).
- Required Documents: Aadhaar Card, Savings bank/post office account details, Mobile number, Nominee information.
- How to Apply: Visit your bank or post office branch where you hold an account and fill the APY registration form, or register online through your bank's net banking portal.
""",

    "beti_bachao": """
OFFICIAL SCHEME GUIDELINES: BETI BACHAO BETI PADHAO (BBBP) & SUKANYA SAMRIDDHI YOJANA (SSY)
- Core Objectives & Benefits:
  1. Elimination of gender-biased sex selection and female foeticide.
  2. Ensuring survival, protection, and quality education for the girl child.
  3. Integrated Financial Welfare Scheme: **Sukanya Samriddhi Yojana (SSY)**, which provides a high government-backed interest rate (~8.2% p.a.), triple tax exemptions under Section 80C (EEE status), and financial security for girl child higher education and marriage.
- Eligibility:
  1. Any girl child residing in India from birth up to 10 years of age (can open account up to age 10).
  2. Maximum 2 accounts per family (one per girl child; exception for twins/triplets).
- Required Documents:
  1. Birth Certificate of the girl child (mandatory, issued by hospital or registrar of births).
  2. Identity Proof of the parent or legal guardian (Aadhaar Card, PAN Card, Voter ID, or Passport).
  3. Residence / Address Proof of the parent/guardian (Electricity bill, Ration Card, Aadhaar).
  4. Recent passport-size photographs of the girl child and parent/guardian.
- How to Apply:
  1. To open a Sukanya Samriddhi Account under the BBBP initiative: Visit any Post Office or authorized commercial bank branch (SBI, PNB, BoB, Canara, etc.). Fill Form-1 (SSY Account Opening Form), submit the documents, and deposit a minimum opening amount of ₹250.
  2. For educational incentives, school enrollment benefits, and counseling: Contact the local District Women and Child Development (WCD) Office, District Magistrate's office, or local Anganwadi Center.
""",

    "mudra": """
OFFICIAL SCHEME GUIDELINES: PRADHAN MANTRI MUDRA YOJANA (PMMY)
- Core Benefit & Financial Figures: Collateral-free institutional credit up to ₹10,00,000 (₹10 Lakh) for non-farm micro and small business enterprises across three categories:
  1. Shishu: Loans up to ₹50,000 (for new/startup micro businesses).
  2. Kishore: Loans from ₹50,001 to ₹5,00,000 (for growing businesses needing equipment/inventory).
  3. Tarun: Loans from ₹5,00,001 to ₹10,00,000 (for established small businesses expanding operations).
- Eligibility Criteria: Any Indian citizen with a viable business plan for non-corporate, non-farm income-generating activities in manufacturing, trading, services, or allied agriculture.
- Required Documents:
  1. Proof of Identity: Aadhaar Card, Voter ID, PAN Card, or Passport.
  2. Proof of Residence: Aadhaar, Electricity Bill, Ration Card, or Voter ID.
  3. Proof of Business: Udyam Registration, trade license, partnership deed, or registration certificate.
  4. Financial Documents: Bank statement of the last 6 months.
  5. Business Quotations: Quotation of machinery/equipment to be purchased or project report.
  6. Recent passport-size photographs.
- How to Apply: Apply online on the Udyamimitra portal ('udyamimitra.in') or visit any commercial bank, Regional Rural Bank (RRB), Small Finance Bank, or MFI branch.
""",

    "vishwakarma": """
OFFICIAL SCHEME GUIDELINES: PM VISHWAKARMA SCHEME
- Core Benefits & Financial Figures:
  1. PM Vishwakarma Certificate and ID Card recognizing traditional artisans and craftspeople.
  2. Skill Training: 5 to 7 days Basic Training and 15 days Advanced Training, with a daily stipend of ₹500.
  3. Modern Toolkit Incentive: e-Voucher grant of ₹15,000 for purchasing modern specialized tools.
  4. Collateral-Free Enterprise Credit: Concessional loans up to ₹3,00,000 at a fixed 5% interest rate (Tranche 1: ₹1,00,000 repayable in 18 months; Tranche 2: ₹2,00,000 repayable in 30 months).
  5. Digital Transaction Incentive: ₹1 per digital transaction up to 100 transactions/month.
- Eligibility Criteria:
  1. Traditional artisan or craftsperson working with hands and tools in one of the 18 specified trades: Carpenter (Suthar), Boat Maker, Armorer, Blacksmith (Lohar), Hammer & Tool Kit Maker, Locksmith, Sculptor (Moortikar/Stone carver), Goldsmith (Sonar), Potter (Kumhaar), Cobbler (Charmakar), Mason (Rajmistri), Basket/Mat/Broom Maker, Doll & Toy Maker, Barber (Naai), Garland Maker (Malakaar), Washerman (Dhobi), Tailor (Darzi), Fishing Net Maker.
  2. Minimum age 18 years; registration restricted to one member per family.
- Required Documents:
  1. Aadhaar Card (mandatory with biometric verification).
  2. Active Mobile Number linked to Aadhaar.
  3. Bank Account passbook/details (must be Aadhaar-seeded).
  4. Ration Card (mandatory for family identification).
- How to Apply: Visit your nearest Common Service Center (CSC). Complete biometric authentication on 'pmvishwakarma.gov.in'. The application is verified by the Gram Panchayat / Urban Local Body, followed by District and State screening.
""",

    "pm_rahat": """
OFFICIAL SCHEME GUIDELINES: PM-RAHAT (SCHEME FOR ROAD ACCIDENT VICTIMS)
- Core Benefit & Financial Figures: Cashless emergency medical stabilization and trauma care up to ₹1,50,000 (₹1.5 Lakh) per victim for a maximum of 7 days during the critical 'Golden Hour' period after any road accident occurring on Indian national highways and public roads.
- Eligibility: All road accident victims regardless of nationality, residence, or insurance status.
- Required Documents: Immediate emergency treatment requires NO upfront documents or cash deposit. Post-stabilization verification uses victim's Aadhaar or relative's photo identity.
- How it Works: Highway emergency ambulances (1033 / 112) transport victims directly to designated trauma network hospitals. Treatment is reimbursed directly to the hospital through the National Trauma Network.
""",

    "msme_clusters": """
OFFICIAL SCHEME GUIDELINES: ASPIRE, SFURTI & MSE-CDP (MSME & RURAL CLUSTERS)
1. ASPIRE: Financial grant assistance up to ₹1 Crore to set up Livelihood Business Incubators (LBIs) and up to ₹1 Crore for Technology Business Incubators (TBIs) to promote rural enterprise and agro-processing livelihoods. Apply via 'aspire.msme.gov.in'.
2. SFURTI: Grant assistance up to ₹2.5 Crore (Regular clusters up to 500 artisans) and up to ₹5 Crore (Major clusters > 500 artisans) to establish Common Facility Centers (CFCs), raw material banks, and modern design tools for traditional artisans. Apply via 'sfurti.msme.gov.in'.
3. MSE-CDP: Financial support for infrastructure development and Common Facility Centers in micro and small enterprise industrial clusters.
"""
}


def find_relevant_scheme_context(query: str) -> Optional[str]:
    """Finds official verified scheme guidelines matching citizen's specific inquiry."""
    if not query:
        return None
    q_lower = query.lower()
    matched = []

    if any(k in q_lower for k in ["ayushman", "pmjay", "pm-jay", "jan arogya", "health cover", "5 lakh", "5lakh", "abha", "abdm", "health card", "ఆయుష్మాన్", "ఆరోగ్య", "आयुष्मान", "जन आरोग्य"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["ayushman_bharat"])
    if any(k in q_lower for k in ["kisan", "pm-kisan", "pmkisan", "samman nidhi", "farmer", "6000", "రైతు", "కిసాన్", "किसान"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["pm_kisan"])
    if any(k in q_lower for k in ["pmjjby", "jeevan jyoti", "life insurance", "2 lakh", "436", "జీవన్ జ్యోతి", "जीवन ज्योति"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["pmjjby"])
    if any(k in q_lower for k in ["pmsby", "suraksha bima", "accident", "20/yr", "సురక్ష బీమా", "सुरक्षा बीमा"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["pmsby"])
    if any(k in q_lower for k in ["atal pension", "apy", "pension", "అటల్ పెన్షన్", "अटल पेंशन"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["atal_pension"])
    if any(k in q_lower for k in ["beti bachao", "beti padhao", "bbbp", "girl child", "sukanya", "బేటీ బచావో", "సమృద్ధి", "बेटी बचाओ", "सुकन्या"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["beti_bachao"])
    if any(k in q_lower for k in ["mudra", "pmmy", "shishu", "kishore", "tarun", "loan", "ముద్రా", "मुद्रा"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["mudra"])
    if any(k in q_lower for k in ["vishwakarma", "artisan", "craft", "toolkit", "విశ్వకర్మ", "विश्वकर्मा"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["vishwakarma"])
    if any(k in q_lower for k in ["rahat", "accident victim", "golden hour", "trauma", "రాహత్", "राहत"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["pm_rahat"])
    if any(k in q_lower for k in ["aspire", "sfurti", "cluster", "mse-cdp", "lbi", "tbi"]):
        matched.append(OFFICIAL_SCHEME_KNOWLEDGE["msme_clusters"])

    if matched:
        return "\n\n".join(matched)
    return None


def is_overview_or_catalog_query(q: str) -> bool:
    """Detects if a citizen is asking for an overview or list of all available schemes."""
    if not q:
        return False
    lower = q.lower().strip()
    patterns = [
        "what are the schemes", "which schemes", "list of schemes", "schemes available",
        "schemes availables", "all schemes", "schemes list", "give them in a list",
        "available schemes", "what schemes", "list all schemes", "show all schemes",
        "tell me all schemes", "what can i ask", "schemes do you have", "names of schemes",
        "give a list of schemes", "give list of schemes", "what are all the schemes",
        "what schemes are there", "all government schemes", "list government schemes",
        "what schemes can i apply", "what schemes can i ask about", "summary of schemes",
        "योजनाओं की सूची", "कौन सी योजनाएं", "सभी योजनाएं", "उपलब्ध योजनाएं", "योजनाएं बताओ",
        "పథకాల జాబితా", "ఏ ఏ పథకాలు", "అన్ని పథకాలు", "అందుబాటులో ఉన్న పథకాలు", "ఏ పథకాలు ఉన్నాయి"
    ]
    return any(p in lower for p in patterns)


def invoke_bedrock_converse(
    model_id: str,
    prompt: str,
    context_texts: List[str],
    audio_bytes: Optional[bytes] = None,
    audio_format: str = "wav",
    target_language: str = "en"
) -> Tuple[str, int, int, Optional[bytes]]:
    """Invokes AWS Bedrock model via Converse API with multilingual translation support."""
    client = get_bedrock_client()
    context_str = "\n\n".join(context_texts)
    is_overview = is_overview_or_catalog_query(prompt)

    system_instruction = (
        "You are an enterprise AI assistant strictly dedicated to Indian government schemes and citizen initiatives.\n"
        "CRITICAL CONSTRAINTS & OUTPUT GUIDELINES:\n"
        "1. STRICT CONTEXT ONLY: You must answer questions using facts provided in the context below. "
        "DO NOT use your pre-trained general knowledge or external world trivia.\n"
        "2. DIRECT, CLEAN ANSWERS: DO NOT prepend 'Hello', 'Namaste', 'Hi', or conversational pleasantries when answering scheme questions. Answer directly, neatly, and concisely.\n"
        "3. GREETINGS: Only if the user's prompt is purely a greeting (e.g. 'Hi', 'Hello', 'Namaste'), respond warmly in 1-2 friendly sentences.\n"
        "4. REFUSAL FOR OUT-OF-CONTEXT TOPICS: If the question cannot be answered from the provided documents (e.g. world trivia, entertainment, or schemes not present in the provided documents), refuse politely in the citizen's requested language.\n"
        "5. ADAPTIVE ANSWER STRUCTURE:\n"
        "   A. FOR CATALOG / LIST / OVERVIEW INQUIRIES (e.g. citizen asks 'what are the schemes available', 'give them in a list', 'list all schemes'):\n"
        "      - Present a comprehensive, clearly structured numbered list of ALL 11 available schemes from the context.\n"
        "      - Group them logically by sector: Agriculture & Farmers, Healthcare & Digital Health, Social Security & Insurance, Micro-Business & MSME, Women & Children.\n"
        "      - List each scheme EXACTLY ONCE with its official full name, acronym, and a concise 1-line summary of its core benefit and financial figure.\n"
        "      - DO NOT force the single-scheme template ('Key Benefits', 'Key Features', 'How to Apply') onto a list request!\n"
        "      - Conclude with a helpful tip inviting the citizen to ask for in-depth eligibility or application steps for any specific scheme.\n"
        "   B. FOR SPECIFIC CITIZEN QUESTIONS (documents, application steps, eligibility, benefits, or scheme details):\n"
        "      - DIRECTLY AND ACCURATELY ANSWER THE CITIZEN'S SPECIFIC QUESTION first and foremost without repeating irrelevant boilerplate!\n"
        "      - IF THE CITIZEN ASKS ABOUT REQUIRED DOCUMENTS:\n"
        "        List the exact required documents clearly in bullet points (e.g. Aadhaar Card, Ration Card / Family ID, Land records / Khasra-Khatauni, Bank Passbook with IFSC, Mobile number, Photo) and specify where to submit them.\n"
        "      - IF THE CITIZEN ASKS ABOUT HOW TO APPLY:\n"
        "        Provide clear, actionable, numbered step-by-step application instructions (official portal URL, CSC / bank / hospital desk, forms to fill, verification process).\n"
        "      - IF THE CITIZEN ASKS ABOUT ELIGIBILITY OR BENEFITS:\n"
        "        State the exact financial coverage/amounts (e.g. ₹5 Lakh, ₹6,000/yr, ₹2 Lakh) and eligibility conditions (age, income, landholding, target groups).\n"
        "      - IF THE CITIZEN ASKS A GENERAL OVERVIEW ABOUT A SINGLE SCHEME:\n"
        "        Provide a concise overview with Scheme Name, Core Financial Figures & Benefits, Eligibility, and How to Apply.\n"
        "      - NEVER append a full catalog list of all schemes when the citizen asked a question about a specific scheme!\n"
        "      - Ensure tone is helpful, authoritative, respectful, and citizen-friendly."
    )

    if target_language == "hi":
        system_instruction += (
            "\n\n6. HINDI OUTPUT REQUIREMENT (हिन्दी):\n"
            "- Output in natural, formal, respectful Hindi in Devanagari script (देवनागरी लिपि).\n"
            "- यदि नागरिक योजनाओं की सूची या उपलब्ध योजनाओं के बारे में पूछता है, तो संदर्भ में मौजूद सभी योजनाओं की एक क्रमबद्ध सूची (श्रेणीवार) उनके मुख्य लाभ के साथ प्रस्तुत करें।\n"
            "- यदि किसी विशिष्ट योजना के बारे में पूछा गया है, तो योजना का नाम, मुख्य वित्तीय लाभ (जैसे ₹6,000 या ₹2 लाख), पात्रता और आवेदन प्रक्रिया के स्पष्ट बिंदु दें।\n"
            "- If and ONLY IF the question is completely outside the scope of the provided documents, politely state ONLY:\n"
            "  'क्षमा करें, यह जानकारी उपलब्ध भारत सरकार की योजनाओं के दस्तावेज़ों के दायरे से बाहर है। आप मुझसे पीएम-किसान, आयुष्मान भारत, पीएम जीवन ज्योति बीमा, पीएम मुद्रा ऋण या अन्य योजनाओं के बारे में पूछ सकते हैं।'\n"
            "- When you CAN answer the question from the context, NEVER append any refusal sentence."
        )
    elif target_language == "te":
        system_instruction += (
            "\n\n6. TELUGU OUTPUT REQUIREMENT (తెలుగు):\n"
            "- Output in natural, formal, respectful Telugu in Telugu script (తెలుగు లిపి).\n"
            "- పౌరుడు అందుబాటులో ఉన్న పథకాల జాబితా అడిగినప్పుడు, అందుబాటులో ఉన్న అన్ని పథకాలను స్పష్టమైన సంఖ్యలతో, వర్గీకరించి, ప్రతి పథకానికి 1-లైన్ ప్రధాన ప్రయోజనం (రూపాయల వివరాలతో) జాబితాగా ఇవ్వండి.\n"
            "- ఏదైనా నిర్దిష్ట పథకం అడిగినప్పుడు, పథకం పేరు, ప్రధాన ఆర్థిక ప్రయోజనాలు (ఉదా. ₹6,000/- వార్షిక సహాయం లేదా ₹2 లక్షల కవరేజ్), అర్హతలు మరియు దరఖాస్తు విధానం స్పష్టంగా అందించండి.\n"
            "- If and ONLY IF the question is completely outside the scope of the provided documents, politely state ONLY:\n"
            "  'క్షమించండి, ఈ సమాచారం అందుబాటులో ఉన్న భారత ప్రభుత్వ సంక్షేమ పథకాల పత్రాల పరిధిలో లేదు. మీరు పీఎం-కిసాన్, ఆయుష్మాన్ భారత్, పీఎం జీవన్ జ్యోతి బీమా, ముద్రా రుణాలు లేదా ఇతర కేంద్ర ప్రభుత్వ పథకాల గురించి అడగవచ్చు.'\n"
            "- When you CAN answer the question from the context, NEVER append any refusal sentence."
        )
    else:
        system_instruction += (
            "\n\n6. ENGLISH OUTPUT REQUIREMENT:\n"
            "- Output cleanly, professionally, and concisely in English following the adaptive format above.\n"
            "- For list/overview questions, provide the complete structured catalog grouped by sector.\n"
            "- If and ONLY IF the question is completely outside the scope of the provided documents, strictly state ONLY:\n"
            "  'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.'\n"
            "- When you CAN answer the question from the context, NEVER append any refusal sentence."
        )

    # Model resolution: if Nova 2.5 Sonic requested, route via Bedrock's active Amazon Nova foundation model
    call_model_id = model_id
    if "nova-2-5-sonic" in model_id.lower() or "nova-2-sonic" in model_id.lower():
        call_model_id = "amazon.nova-lite-v1:0"

    content_list = []
    if audio_bytes:
        content_list.append({
            "audio": {
                "format": audio_format,
                "source": {"bytes": audio_bytes}
            }
        })
        content_list.append({"text": f"Context Information:\n{context_str}\n\nQuestion:\n{prompt}"})
    else:
        user_message = f"CTX:{context_str}\nQ:{prompt}\nA:"
        content_list.append({"text": user_message})

    converse_params: Dict[str, Any] = {
        "modelId": call_model_id,
        "messages": [
            {
                "role": "user",
                "content": content_list
            }
        ],
        "system": [
            {"text": system_instruction}
        ],
        "inferenceConfig": {
            "maxTokens": 900 if is_overview else 450,
            "temperature": 1.0 if "devstral" in call_model_id else 0.2,
            "topP": 0.9
        },
        "performanceConfig": {
            "latency": "standard"
        }
    }

    response = client.converse(**converse_params)

    output_message = response.get("output", {}).get("message", {})
    response_contents = output_message.get("content", [])
    
    answer = ""
    audio_out_bytes = None

    for item in response_contents:
        if "text" in item:
            answer += item["text"]
        elif "audio" in item:
            audio_out_bytes = item["audio"]["source"]["bytes"]

    # Only synthesize audio if voice mode or Nova Sonic is actively requested (avoids 15-20s blocking latency on text queries)
    if audio_bytes and not audio_out_bytes and answer:
        audio_out_bytes = generate_speech_audio(
            text=answer,
            target_language=target_language,
            is_nova_sonic=("nova" in model_id.lower())
        )

    usage = response.get("usage", {})
    input_tokens = usage.get("inputTokens", len(prompt or "") // 4)
    output_tokens = usage.get("outputTokens", len(answer) // 4)

    return answer, input_tokens, output_tokens, audio_out_bytes


def invoke_databricks_llm(prompt: str, context_texts: List[str]) -> Tuple[str, int, int]:
    """Invokes Databricks Foundation Model Serving LLM."""
    context_str = "\n\n".join(context_texts)
    is_overview = is_overview_or_catalog_query(prompt)
    sys_msg = (
        "gov_schemes_asst|strict_context_only|no_general_knowledge|no_unprompted_greetings|refuse_out_of_scope. "
        "Answer directly and concisely without conversational pleasantries like 'Hello' or 'Namaste'. "
        "Answer ONLY using the provided Indian government schemes context. "
        "If citizen asks for a list or overview of available schemes, present all available schemes in a clearly structured numbered list grouped by domain with core benefits. "
        "If citizen asks for a specific scheme, provide scheme name once, key benefits & financial figures, eligibility, and numbered application steps. "
        "If a question is outside the scope of the provided documents (e.g. world trivia, capitals, science, sports), "
        "you MUST strictly refuse and NEVER provide the answer from general knowledge. "
        "Connect scheme terminology (e.g. Vikasit Bharat <-> Developed India / Amrit Kaal) and output entirely in English."
    )
    usr_msg = f"CTX:{context_str}\nQ:{prompt}\nA:"

    from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
    llm = w.serving_endpoints.query(
        name=DATABRICKS_FALLBACK_LLM,
        messages=[
            ChatMessage(content=sys_msg, role=ChatMessageRole.SYSTEM),
            ChatMessage(content=usr_msg, role=ChatMessageRole.USER)
        ],
        max_tokens=900 if is_overview else 500,
        temperature=0.3
    )

    answer = llm.choices[0].message.content if llm.choices else ""
    it = llm.usage.prompt_tokens if llm.usage else len(usr_msg) // 4
    ot = llm.usage.completion_tokens if llm.usage else len(answer) // 4
    return answer, it, ot


def generate_with_fallback(
    prompt: str,
    context_texts: List[str],
    preferred_model: str = "Auto",
    audio_bytes: Optional[bytes] = None,
    audio_format: str = "wav",
    target_language: str = "en"
) -> Tuple[str, int, int, str, Optional[bytes]]:
    """Attempts generation with prioritized Bedrock models, falling back to Databricks Llama 3.3."""
    if audio_bytes and preferred_model == "Auto":
        candidates = [BEDROCK_MODEL_4, BEDROCK_MODEL_1, BEDROCK_MODEL_2, BEDROCK_MODEL_3]
    elif preferred_model and preferred_model != "Auto":
        candidates = [preferred_model]
        for m in BEDROCK_MODELS:
            if m not in candidates:
                candidates.append(m)
    else:
        candidates = list(BEDROCK_MODELS)

    errors = []

    # 1. Try Bedrock Models
    for model_id in candidates:
        try:
            print(f"[RAG] Invoking Bedrock model: {model_id} (target_language: {target_language})")
            answer, in_tok, out_tok, audio_out = invoke_bedrock_converse(
                model_id=model_id,
                prompt=prompt,
                context_texts=context_texts,
                audio_bytes=audio_bytes if "nova-2-5-sonic" in model_id else None,
                audio_format=audio_format,
                target_language=target_language
            )
            if answer:
                display_name = "Amazon Nova 2.5 Sonic" if ("nova-2-5-sonic" in model_id or "nova" in model_id.lower()) else model_id
                return answer, in_tok, out_tok, display_name, audio_out
        except Exception as e:
            err_msg = f"Model '{model_id}' failed: {e}"
            print(f"[BEDROCK FALLBACK NOTICE] {err_msg}")
            errors.append(err_msg)

    # 2. Try Databricks Fallback LLM
    try:
        print(f"[RAG] Invoking Databricks Fallback LLM: {DATABRICKS_FALLBACK_LLM}")
        answer, in_tok, out_tok = invoke_databricks_llm(prompt, context_texts)
        if answer:
            audio_out = generate_speech_audio(answer) if audio_bytes else None
            return answer, in_tok, out_tok, f"Databricks: {DATABRICKS_FALLBACK_LLM}", audio_out
    except Exception as e:
        err_msg = f"Databricks fallback '{DATABRICKS_FALLBACK_LLM}' failed: {e}"
        print(f"[DATABRICKS FALLBACK ERROR] {err_msg}")
        errors.append(err_msg)

    failed_summary = "\n- ".join(errors)
    fallback_message = (
        f"⚠️ All model endpoints failed. Please check your credentials.\n\n"
        f"Errors encountered:\n- {failed_summary}"
    )
    return fallback_message, 0, 0, "None (All Failed)", None


# Specific Indic Government Scheme Patterns (Telugu & Hindi) with flexible whitespace and transliteration
INDIC_SCHEME_PATTERNS = [
    # PMJJBY / Jeevan Jyoti Bima Yojana
    (r'(?i)(జీవన్\s*జ్యోతి|పీ\s*ఎం\s*జే\s*జే\s*బీ\s*వై|పీ\s*ఎం\s*జె\s*జె\s*బి\s*వై|పీఎం\s*జేజేబీవై|పిఎం\s*జేజేబీవై|పీఎం\s*జెజెబివై|పిఎం\s*జెజెబివై|పీఎంజేజేబీవై|పిఎంజెజెబివై|పీ\s*ఎం\s*జేజేబీవై|పి\s*ఎం\s*జేజేబీవై|జేజేబీవై|జెజెబివై|జీవిత\s*బీమా|pm-?jjby)', 'PMJJBY Pradhan Mantri Jeevan Jyoti Bima Yojana'),
    (r'(?i)(जीवन\s*ज्योति|पी\s*एम\s*जे\s*जे\s*बी\s*वाई|पीएम\s*जेजेबीवाई|पीएमजेजेबीवाई|पी\s*एम\s*जेजेबीवाई|जेजेबीवाई|जीवन\s*बीमा)', 'PMJJBY Pradhan Mantri Jeevan Jyoti Bima Yojana'),

    # PMSBY / Suraksha Bima Yojana
    (r'(?i)(సురక్ష\s*బీమా|పీ\s*ఎం\s*ఎస్\s*బీ\s*వై|పీ\s*ఎం\s*ఎస్\s*బి\s*వై|పీఎం\s*ఎస్బీవై|పిఎం\s*ఎస్బీవై|పీఎం\s*ఎస్\s*బి\s*వై|పిఎం\s*ఎస్\s*బి\s*వై|పీఎంఎస్బీవై|పిఎంఎస్బీవై|పీ\s*ఎం\s*ఎస్బీవై|పి\s*ఎం\s*ఎస్బీవై|ఎస్బీవై|ఎస్బివై|pm-?sby)', 'PMSBY Pradhan Mantri Suraksha Bima Yojana'),
    (r'(?i)(सुरक्षा\s*बीमा|पी\s*एम\s*एस\s*बी\s*वाई|पीएम\s*एसबीवाई|पीएमएसबीवाई|पी\s*एम\s*एसबीवाई|एसबीवाई)', 'PMSBY Pradhan Mantri Suraksha Bima Yojana'),

    # PM-KISAN Samman Nidhi
    (r'(?i)(పీ\s*ఎం\s*కిసాన్|పి\s*ఎం\s*కిసాన్|పీఎం\s*కిసాన్|పిఎం\s*కిసాన్|పీఎంకిసాన్|కిసాన్\s*సమ్మాన్|రైతు\s*భరోసా|రైతు\s*స్కీమ్|రైతు|pm-?kisan)', 'PM Kisan Samman Nidhi scheme'),
    (r'(?i)(पी\s*एम\s*किसान|पीएम\s*किसान|पीएमकिसान|किसान\s*सम्मान\s*निधि|किसान)', 'PM Kisan Samman Nidhi scheme'),

    # Ayushman Bharat / PM-JAY
    (r'(?i)(ఆయుష్మాన్\s*భారత్|ఆయుష్మాన్|పీ\s*ఎం\s*జే\s*ఏ\s*వై|పీ\s*ఎం\s*జె\s*ఎ\s*వై|పీఎం\s*జేఏవై|పిఎం\s*జేఏవై|పీఎంజేఏవై|పిఎంజేఏవై|ఆరోగ్య\s*శ్రీ|ఆరోగ్య\s*బీమా|ఆరోగ్య|pm-?jay)', 'Ayushman Bharat PMJAY health insurance'),
    (r'(?i)(आयुष्मान\s*भारत|आयुष्मान|पी\s*एम\s*जे\s*ए\s*वाई|पीएम\s*जेएवाई|पीएमजेएवाई|पी\s*एम\s*जेएवाई|जेएवाई|स्वास्थ्य\s*बीमा)', 'Ayushman Bharat PMJAY health insurance'),

    # PM Mudra Loan
    (r'(?i)(ముద్ర\s*రుణం|ముద్ర\s*లోన్|ముద్ర|ముద్రా|ముద్రా\s*లోన్|mudra)', 'PM Mudra loan scheme'),
    (r'(?i)(मुद्रा\s*योजना|मुद्रा\s*ऋण|मुद्रा\s*लोन|मुद्रा)', 'PM Mudra loan scheme'),

    # PM Awas Yojana (PMAY)
    (r'(?i)(ఆవాస్\s*యోజన|ఆవాస్|ఇళ్ల\s*పథకం|ఇళ్ల\s*రుణం|గృహ\s*నిర్మాణ|pmay)', 'Pradhan Mantri Awas Yojana PMAY housing'),
    (r'(?i)(आवास\s*योजना|आवास|मकान|घर)', 'Pradhan Mantri Awas Yojana PMAY housing'),

    # Beti Bachao Beti Padhao
    (r'(?i)(బేటీ\s*బచావో|బేటి\s*బచావో|బాలిక\s*సంరక్షణ|బాలికల|సుకన్య|bbbp)', 'Beti Bachao Beti Padhao'),
    (r'(?i)(बेटी\s*बचाओ|सुकन्या)', 'Beti Bachao Beti Padhao'),

    # PM Vishwakarma
    (r'(?i)(విశ్వకర్మ|చేతివృత్తుల|చేతి\s*వృత్తులు|కళాకారుల|artisan)', 'PM Vishwakarma artisan scheme'),
    (r'(?i)(विश्वकर्मा|कारीगर)', 'PM Vishwakarma artisan scheme'),

    # ABDM / Digital Health
    (r'(?i)(డిజిటల్\s*హెల్త్|ఏబీడీఎం|ఎబిడిఎం|ఆభా\s*కార్డు|ఆభా|అభా|abdm|abha)', 'Ayushman Bharat Digital Mission ABDM'),
    (r'(?i)(डिजिटल\s*हेल्थ|एबीडीएम|आभा)', 'Ayushman Bharat Digital Mission ABDM'),

    # Sukanya Samriddhi
    (r'(?i)(సుకున్య\s*సమృద్ధి|సుకున్య|సమృద్ధి|ssy)', 'Sukanya Samriddhi Yojana SSY'),
    (r'(?i)(सुकन्या\s*समृद्धि|सुकन्या|समृद्धि)', 'Sukanya Samriddhi Yojana SSY'),

    # Relief & Welfare Funds
    (r'(?i)(రిలీఫ్|రాహత్|సంక్షేమ\s*నిధి|ఫండ్)', 'relief assistance fund scheme'),
    (r'(?i)(राहत|कल्याण\s*निधि|फंड)', 'relief assistance fund scheme')
]

# Indic Query Intent Patterns (Eligibility, Benefits, Application, Documents)
INDIC_INTENT_PATTERNS = [
    # Document keywords
    (r'(?i)(డాక్యుమెంట్లు|పత్రాలు|కావాలి|ఏమేమి|సర్టిఫికెట్)', 'documents required KYC Aadhaar eligibility'),
    (r'(?i)(दस्तावेज़|कागजात|जरूरी|प्रमाणपत्र)', 'documents required KYC Aadhaar eligibility'),
    # Eligibility & Benefits
    (r'(?i)(అర్హత|అర్హులు|లాభాలు|ప్రయోజనాలు|వివరాలు|డబ్బులు|డబ్బు|ఎంత|మొత్తం)', 'eligibility criteria benefits financial assistance'),
    (r'(?i)(पात्रता|योग्यता|लाभ|फायदे|पैसे|कितना|राशि)', 'eligibility criteria benefits financial assistance'),
    # Application process
    (r'(?i)(దరఖాస్తు|అప్లై|ఎలా|నమోదు|చేసుకోవాలి)', 'how to apply application registration process'),
    (r'(?i)(आवेदन|अप्लाई|कैसे|रजिस्ट्रेशन)', 'how to apply application registration process')
]

# Combined backwards-compatibility list
INDIC_SCHEME_KEYWORD_PAIRS = INDIC_SCHEME_PATTERNS + INDIC_INTENT_PATTERNS


def translate_query_for_search(query: str, target_language: str = "en") -> str:
    """
    Translates Indic language queries (Telugu, Hindi) into search-optimized English keywords
    so Databricks English Vector Embedding index ('databricks-gte-large-en')
    accurately retrieves relevant government scheme documents without non-ASCII embedding mismatch.
    """
    if not query or not query.strip():
        return query

    has_indic = bool(re.search(r'[\u0900-\u097F\u0C00-\u0C7F]', query))
    if not has_indic and target_language not in ["hi", "te"]:
        return query.strip()

    # Step 1: Fast pattern matching over known Indian government scheme aliases & query intents
    matched_schemes = []
    for pattern, eng_rep in INDIC_SCHEME_PATTERNS:
        if re.search(pattern, query) and eng_rep not in matched_schemes:
            matched_schemes.append(eng_rep)

    matched_intents = []
    for pattern, eng_rep in INDIC_INTENT_PATTERNS:
        if re.search(pattern, query) and eng_rep not in matched_intents:
            matched_intents.append(eng_rep)

    # If scheme was identified, combine scheme + intents
    if matched_schemes:
        combined = " ".join(matched_schemes + matched_intents)
        try:
            print(f"[RAG TRANSLATION] Pattern dictionary matched scheme: '{combined}'")
        except Exception:
            pass
        return combined

    # Step 2: Bedrock Converse LLM translation for general / unmapped Indic queries
    # Crucial: If no scheme matched in dictionary, ask LLM so the scheme name is preserved
    try:
        client = get_bedrock_client()
        res = client.converse(
            modelId=BEDROCK_MODEL_1,
            messages=[{
                "role": "user",
                "content": [{
                    "text": (
                        "Translate the following Indian language query into a single line of concise English search keywords (max 8 words) for government schemes retrieval.\n"
                        "Output ONLY Latin English keywords on a single line. Do not output Indian script or bullets.\n\n"
                        f"Query: {query.strip()}"
                    )
                }]
            }],
            inferenceConfig={"maxTokens": 35, "temperature": 0.0}
        )
        translated_raw = res["output"]["message"]["content"][0]["text"].strip()
        # Ensure ONLY valid Latin/ASCII text is passed to GTE-Large-EN
        latin_only = re.sub(r'[^\x20-\x7E]', ' ', translated_raw)
        cleaned_english = ' '.join(latin_only.split()[:10])
        if len(cleaned_english) >= 3:
            # Append any intent keywords matched
            if matched_intents:
                cleaned_english += " " + " ".join(matched_intents)
            try:
                print(f"[RAG TRANSLATION] Bedrock translated: '{cleaned_english}'")
            except Exception:
                pass
            return cleaned_english
    except Exception as e:
        try:
            print(f"[RAG TRANSLATION NOTICE] Query translation fallback: {e}")
        except Exception:
            pass

    # Fallback if both pattern matching and LLM translation fail
    if matched_intents:
        return "government schemes " + " ".join(matched_intents)

    # Fallback to Latin-only characters
    fallback_latin = re.sub(r'[^\x20-\x7E]', ' ', query).strip()
    return fallback_latin if len(fallback_latin) >= 3 else "government scheme eligibility details"



def execute_rag_pipeline(
    user_query: str,
    selected_model: str = "Auto",
    audio_bytes: Optional[bytes] = None,
    audio_format: str = "wav",
    num_results: int = 5,
    is_first_turn: bool = False,
    target_language: str = "en",
    is_voice: bool = False
) -> Dict[str, Any]:
    """
    Full end-to-end RAG execution with Hindi/Telugu Beta translation support:
    0a. Automatic Indic language detection (Telugu/Hindi script and transliterated roman)
    0b. Security: Prompt injection check & PII Masking
    1. Embed query (databricks-gte-large-en)
    2. Vector search (rag_catalog.rag_gov_schema.gold_vector_index)
    3. Multi-Model LLM answer
    4. Metrics (latency, cost, answering check)
    5. Log to Databricks tables (user_queries, rag_observability, rag_retrieval_logs)
    """
    qid = str(uuid.uuid4())
    t0 = time.time()

    # Automatically detect language from user query if target_language is default "en"
    detected_lang = target_language
    if bool(re.search(r'[\u0C00-\u0C7F]', user_query)):
        detected_lang = "te"
    elif bool(re.search(r'[\u0900-\u097F]', user_query)):
        detected_lang = "hi"
    elif detected_lang == "en":
        # Detect romanized Telugu or Hindi keywords
        if bool(re.search(r'\b(cheyali|cheyandi|arhatalu|pathakam|padhakam|dabbu|dabbulu|kavali|darakhastu|ento|telupandi|evariki|evvaru|evaru|bharoosa|raithu|rythu|prabhutva|paddhathi)\b', user_query, re.I)):
            detected_lang = "te"
        elif bool(re.search(r'\b(kaise|karein|karna|patrata|kitna|kitne|paise|rupya|bataiye|chahiye|dastavez|kagaz|kisko|milega|pradhan\s*mantri|sarkari)\b', user_query, re.I)):
            detected_lang = "hi"

    # 0a. Conversational Greeting Check (Only when user explicitly greets)
    clean_lower = re.sub(r'[^a-zA-Z\s]', '', user_query.strip().lower()).strip()
    is_greeting = clean_lower in {
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "namaste", "vanakkam", "greetings", "howdy", "hi there", "hello there",
        "help", "hi assistant", "hello assistant", "who are you", "what can you do"
    } or bool(re.match(r'^(hi|hello|hey|namaste|greetings)\s*$', clean_lower))

    if is_greeting:
        if detected_lang == "hi":
            greeting_text = (
                "नमस्ते! मैं आपका एआई सरकारी योजना सहायक हूँ। मैं आपकी क्या मदद कर सकता हूँ? "
                "आप मुझसे आयुष्मान भारत (PM-JAY), पीएम-किसान, पीएम आवास योजना, पीएम मुद्रा ऋण, "
                "बेटी बचाओ बेटी पढ़ाओ, पेंशन और छात्रवृत्ति योजनाओं की पात्रता, आवश्यक दस्तावेज़ और सब्सिडी के बारे में पूछ सकते हैं।"
            )
        elif detected_lang == "te":
            greeting_text = (
                "నమస్కారం! నేను మీ ప్రభుత్వ సంక్షేమ పథకాల ఏఐ సహాయకుడిని. నేను మీకు ఎలా సహాయపడగలను? "
                "మీరు నన్ను ఆయుష్మాన్ భారత్ (PM-JAY), పీఎం-కిసాన్, పీఎం ఆవాస్ యోజన, పీఎం ముద్రా రుణాలు, "
                "బేటీ బచావో బేటీ పఢావో, పెన్షన్లు మరియు స్కాలర్‌షిప్‌ల అర్హత, దరఖాస్తు పత్రాలు మరియు రాయితీల గురించి అడగవచ్చు."
            )
        else:
            greeting_text = (
                "Namaste! I am your AI Government Schemes Assistant. How can I help you today? "
                "You can ask me about central and state welfare initiatives, eligibility criteria, required documents, and subsidies for schemes such as "
                "Ayushman Bharat (PM-JAY), PM-KISAN, Pradhan Mantri Awas Yojana, PM Mudra Yojana, Beti Bachao Beti Padhao, pensions, and scholarships."
            )
        lat = (time.time() - t0) * 1000
        it = max(len(user_query) // 4, 2)
        ot = len(greeting_text) // 4
        ic, oc, _ = calculate_turn_cost("gemma", it, ot)

        try:
            log_user_query(qid, user_query, greeting_text, BATCH_ID)
            log_observability(str(uuid.uuid4()), qid, lat, it, ot, ic, oc, True, False, False, user_query)
            log_retrieval(str(uuid.uuid4()), qid, [], [], [], 0)
        except Exception as _e:
            print(f"[GREETING LOG NOTICE] {_e}")

        # Synthesize audio for greetings if requested in regional voice, Nova Sonic, or voice turn
        greeting_audio = None
        if detected_lang in ["hi", "te"] or "nova" in selected_model.lower() or audio_bytes or is_voice:
            greeting_audio = generate_speech_audio(
                text=greeting_text,
                target_language=detected_lang,
                is_nova_sonic=("nova" in selected_model.lower())
            )

        return {
            "question_id": qid,
            "raw_question": user_query,
            "masked_question": user_query,
            "answer": greeting_text,
            "audio_response": greeting_audio,
            "retrieved_chunks": [],
            "retrieved_scores": [],
            "retrieved_chunk_ids": [],
            "latency_ms": lat,
            "input_tokens": it,
            "output_tokens": ot,
            "input_cost": ic,
            "output_cost": oc,
            "llm_able_to_answer": True,
            "model_used": "Gemma 3 12B IT (Greeting)",
            "security": {
                "injection_detected": False,
                "injection_category": None,
                "pii_masked": False,
                "pii_categories": []
            }
        }

    # 0b. Security: Comprehensive multi-threat scan (PII masking & Prompt/Command injection)
    guard_res = scan_security_guardrails(user_query)
    pii_masked = guard_res["pii_masked"]
    pii_cats = guard_res["pii_categories"]
    injection_detected = guard_res["injection_detected"]
    injection_cat = guard_res["primary_injection_category"]
    injection_cats = guard_res["injection_categories"]
    safety_violated = guard_res.get("safety_violated", False)
    safety_cats = guard_res.get("safety_categories", [])
    primary_safety_cat = guard_res.get("primary_safety_category", None)
    safe_question = guard_res["safe_query"] if guard_res["safe_query"] else guard_res["masked_text"]

    # 0c. Content Safety Enforcement (Profanity, Hate, Violent, Harmful, Sexual, Sexual Violence)
    if safety_violated:
        cats_label = ", ".join(safety_cats)
        if detected_lang == "hi":
            safety_msg = f"क्षमा करें, यह अनुरोध अस्वीकार कर दिया गया है क्योंकि इसमें अस्वीकार्य सामग्री पाई गई है ({cats_label})।"
        elif detected_lang == "te":
            safety_msg = f"క్షమించండి, మీ అభ్యర్థనలో నిబంధనలకు విరుద్ధమైన కంటెంట్ ఉన్నందున ప్రాసెస్ చేయలేము ({cats_label})."
        else:
            safety_msg = f"I cannot process this request as it contains content that violates our safety policies ({cats_label})."

        lat = (time.time() - t0) * 1000
        try:
            log_user_query(qid, user_query, safety_msg, BATCH_ID)
            log_observability(str(uuid.uuid4()), qid, lat, 10, 20, 0.0, 0.0, False, True, pii_masked, safe_question)
            log_retrieval(str(uuid.uuid4()), qid, [], [], [], 0)
        except Exception as _e:
            print(f"[SAFETY BLOCK LOG NOTICE] {_e}")

        return {
            "question_id": qid,
            "raw_question": user_query,
            "masked_question": safe_question,
            "answer": safety_msg,
            "audio_response": None,
            "retrieved_chunks": [],
            "retrieved_scores": [],
            "retrieved_chunk_ids": [],
            "latency_ms": lat,
            "input_tokens": 10,
            "output_tokens": 20,
            "input_cost": 0.0,
            "output_cost": 0.0,
            "llm_able_to_answer": False,
            "model_used": "Safety Policy Guardrail",
            "security": {
                "injection_detected": injection_detected,
                "injection_category": injection_cat,
                "injection_categories": injection_cats,
                "safety_violated": True,
                "safety_categories": safety_cats,
                "primary_safety_category": primary_safety_cat,
                "pii_masked": pii_masked,
                "pii_categories": pii_cats,
                "has_multiple_threats": True
            }
        }

    # If the user input was purely an adversarial injection/command with no legitimate scheme question
    if injection_detected and not guard_res["safe_query"]:
        block_msg = f"I cannot process this request as it contains unauthorized instructions or commands ({injection_cat})."
        lat = (time.time() - t0) * 1000
        try:
            log_user_query(qid, user_query, block_msg, BATCH_ID)
            log_observability(str(uuid.uuid4()), qid, lat, 10, 20, 0.0, 0.0, False, True, pii_masked, safe_question)
            log_retrieval(str(uuid.uuid4()), qid, [], [], [], 0)
        except Exception as _e:
            print(f"[SECURITY BLOCK LOG NOTICE] {_e}")

        return {
            "question_id": qid,
            "raw_question": user_query,
            "masked_question": safe_question,
            "answer": block_msg,
            "audio_response": None,
            "retrieved_chunks": [],
            "retrieved_scores": [],
            "retrieved_chunk_ids": [],
            "latency_ms": lat,
            "input_tokens": 10,
            "output_tokens": 20,
            "input_cost": 0.0,
            "output_cost": 0.0,
            "llm_able_to_answer": False,
            "model_used": "Security Guardrail",
            "security": {
                "injection_detected": True,
                "injection_category": injection_cat,
                "injection_categories": injection_cats,
                "pii_masked": pii_masked,
                "pii_categories": pii_cats,
                "has_multiple_threats": pii_masked and injection_detected
            }
        }

    # 1. Indic Translation for Databricks GTE-Large-EN vector index
    search_query = translate_query_for_search(safe_question, detected_lang)

    # 2. Embedding + Vector Search using search_query
    cids, scores, texts = query_databricks_vector_search(search_query, num_results=num_results)

    # 3. Detect overview / catalog listing query: inject complete official catalog
    if is_overview_or_catalog_query(safe_question):
        print(f"[RAG] Overview / scheme catalog question detected: '{safe_question}' -> Prepending official catalog context.")
        texts.insert(0, OFFICIAL_SCHEMES_CATALOG_CONTEXT)
        cids.insert(0, "official_schemes_catalog")
        scores.insert(0, 1.0)
    else:
        # Prepend authoritative verified scheme guidelines if inquiry matches a specific government scheme
        scheme_ctx = find_relevant_scheme_context(search_query) or find_relevant_scheme_context(safe_question)
        if scheme_ctx:
            print(f"[RAG] Matching verified scheme guidelines identified -> Prepending official scheme facts.")
            texts.insert(0, scheme_ctx)
            cids.insert(0, "official_scheme_verified_guidelines")
            scores.insert(0, 1.0)

    # 4. LLM answer (Bedrock Converse API or Databricks Fallback)
    answer, it, ot, model_used, audio_out = generate_with_fallback(
        prompt=safe_question,
        context_texts=texts,
        preferred_model=selected_model,
        audio_bytes=audio_bytes,
        audio_format=audio_format,
        target_language=detected_lang
    )

    # Audio is automatically generated for Amazon Nova 2.5 Sonic Voice-to-Voice queries, active voice turns, or audio input
    is_nova = "nova" in str(selected_model).lower() or "sonic" in str(selected_model).lower()
    if (audio_bytes or is_nova or is_voice) and not audio_out and answer:
        audio_out = generate_speech_audio(
            text=answer,
            target_language=detected_lang,
            is_nova_sonic=is_nova
        )

    # 4. Metrics
    lat = (time.time() - t0) * 1000
    ic, oc, _tot = calculate_turn_cost(model_used, it, ot)
    able = check_llm_answering(answer)

    # 5. Log everything to Databricks tables as per reference app.py
    for _fn, _args in [
        (log_user_query, (qid, safe_question, answer, BATCH_ID)),
        (log_observability, (str(uuid.uuid4()), qid, lat, it, ot, ic, oc, able, injection_detected, pii_masked, safe_question)),
        (log_retrieval, (str(uuid.uuid4()), qid, cids, scores, texts, len(cids))),
    ]:
        try:
            _fn(*_args)
        except Exception as _e:
            print(f"[DB LOGGING NOTICE] {_fn.__name__} failed: {_e}")

    return {
        "question_id": qid,
        "raw_question": user_query,
        "masked_question": safe_question,
        "answer": answer,
        "audio_response": audio_out,
        "retrieved_chunks": texts,
        "retrieved_scores": scores,
        "retrieved_chunk_ids": cids,
        "latency_ms": lat,
        "input_tokens": it,
        "output_tokens": ot,
        "input_cost": ic,
        "output_cost": oc,
        "llm_able_to_answer": able,
        "model_used": model_used,
        "security": {
            "injection_detected": injection_detected,
            "injection_category": injection_cat or None,
            "injection_categories": injection_cats,
            "safety_violated": safety_violated,
            "safety_categories": safety_cats,
            "pii_masked": pii_masked,
            "pii_categories": pii_cats,
            "has_multiple_threats": pii_masked and (injection_detected or safety_violated)
        }
    }

