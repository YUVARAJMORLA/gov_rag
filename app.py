"""
app.py
------
Streamlit UI for Enterprise RAG Chatbot
Matching reference app.py table logging and Databricks SDK execution:
- Tables:
  1. {DB}.user_queries (question_id, user_question, llm_answer, timestamp, batch_id)
  2. {DB}.rag_observability (observability_id, question_id, latency_ms, input_tokens, output_tokens,
                            input_cost, output_cost, llm_able_to_answer, injection_detected, pii_masked, masked_question, timestamp)
  3. {DB}.rag_retrieval_logs (log_id, question_id, retrieved_chunk_ids, retrieved_scores, retrieved_texts, num_retrieved, timestamp)
  4. {DB}.rag_feedback (feedback_id, question_id, user_feedback, rating, timestamp)

Tabs:
1. 💬 Text Chat (RAG with Multi-Model Fallback)
2. 🎙️ Live Speech-to-Speech (Amazon Nova 2.5 Sonic with Start & End Controls)
"""

import os
import time
import uuid
import streamlit as st
from dotenv import load_dotenv

from guardrails import mask_pii, detect_prompt_injection, check_llm_answering
from db_connector import (
    DB,
    CATALOG,
    SCHEMA,
    BATCH_ID,
    WAREHOUSE_ID,
    run_sql,
    log_user_query,
    log_observability,
    log_retrieval,
    log_feedback,
    test_databricks_platform,
    test_databricks_tables,
    test_vector_search_endpoint
)
from rag_service import (
    execute_rag_pipeline,
    query_databricks_vector_search,
    calculate_turn_cost,
    get_model_pricing,
    BEDROCK_MODELS,
    BEDROCK_MODEL_1,
    BEDROCK_MODEL_2,
    BEDROCK_MODEL_3,
    BEDROCK_MODEL_4,
    DATABRICKS_FALLBACK_LLM
)
from nova_live_session import (
    LiveNovaSonicManager,
    NOVA_RAG_SYSTEM_PROMPT
)

load_dotenv()

st.set_page_config(
    page_title="Gov Schemes RAG & Voice AI",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .metric-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 500;
        margin-right: 6px;
        margin-top: 4px;
        background-color: rgba(15, 23, 42, 0.65);
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .model-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        margin-right: 6px;
        margin-top: 4px;
        background-color: rgba(14, 165, 233, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.35);
    }
    .live-status-active {
        padding: 12px 18px;
        border-radius: 8px;
        background-color: #fce8e6;
        color: #c5221f;
        font-weight: 600;
        font-size: 1rem;
        border: 1px solid #f5c2cb;
        margin-bottom: 12px;
        animation: pulse 1.5s infinite;
    }
    .live-status-idle {
        padding: 12px 18px;
        border-radius: 8px;
        background-color: #e6f4ea;
        color: #137333;
        font-weight: 600;
        font-size: 0.95rem;
        border: 1px solid #ceead6;
        margin-bottom: 12px;
    }
    .conn-card {
        background: rgba(30, 41, 59, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 8px;
        padding: 9px 12px;
        margin-bottom: 8px;
    }
    .table-status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 6px;
        margin-bottom: 5px;
        font-size: 0.82rem;
    }
    .status-pill-ok {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.74rem;
        font-weight: 600;
        background: rgba(16, 185, 129, 0.16);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.35);
    }
    .status-pill-err {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.74rem;
        font-weight: 600;
        background: rgba(239, 68, 68, 0.16);
        color: #f87171;
        border: 1px solid rgba(248, 113, 113, 0.35);
    }
    .status-pill-warn {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.74rem;
        font-weight: 600;
        background: rgba(245, 158, 11, 0.16);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.35);
    }
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.6; }
        100% { opacity: 1; }
    }
</style>
""", unsafe_allow_html=True)

# ------------------------------------------------------------------
# SESSION STATE INITIALIZATION
# ------------------------------------------------------------------
if "text_messages" not in st.session_state:
    st.session_state.text_messages = []

if "voice_dialogues" not in st.session_state:
    st.session_state.voice_dialogues = []

if "voice_active" not in st.session_state:
    st.session_state.voice_active = False

if "voice_recorder" not in st.session_state:
    st.session_state.voice_recorder = None

if "connection_test_results" not in st.session_state:
    st.session_state.connection_test_results = None

# ------------------------------------------------------------------
# SIDEBAR: Status, Config & Recent Queries (from Reference app.py)
# ------------------------------------------------------------------
with st.sidebar:
    st.header("⚙️ Settings & Telemetry")
    num_results = st.slider("Chunks to retrieve", 1, 10, 5)
    st.caption("🔒 PII auto-masked | 🛡️ Injection-protected")

    st.divider()
    st.subheader("🔌 Platform & Tables Status")

    col_btn, col_time = st.columns([1.2, 1.0])
    with col_btn:
        test_clicked = st.button("🧪 Test Connections", use_container_width=True)
    with col_time:
        if st.session_state.connection_test_results:
            st.caption(f"🕒 {st.session_state.connection_test_results.get('last_tested', 'Now')}")
        else:
            st.caption("Not tested yet")

    if test_clicked or st.session_state.connection_test_results is None:
        with st.spinner("Testing Databricks & Tables..."):
            p_res = test_databricks_platform()
            t_res = test_databricks_tables()
            v_res = test_vector_search_endpoint()
            st.session_state.connection_test_results = {
                "platform": p_res,
                "tables": t_res,
                "vector": v_res,
                "last_tested": time.strftime("%H:%M:%S")
            }

    diag = st.session_state.connection_test_results or {}
    plat = diag.get("platform", {})
    tbls = diag.get("tables", {})
    vec = diag.get("vector", {})

    # 1. Databricks Platform Card
    p_ok = plat.get("status") == "online"
    p_badge = f"<span class='status-pill-ok'>🟢 Connected ({plat.get('latency_ms', 0):.0f}ms)</span>" if p_ok else f"<span class='status-pill-err'>🔴 Error</span>"
    st.markdown(
        f"<div class='conn-card'>"
        f"<div style='display:flex; justify-content:space-between; align-items:center;'>"
        f"<span style='font-weight:600; font-size:0.85rem; color:#f8fafc;'>Databricks Platform</span>"
        f"{p_badge}"
        f"</div>"
        f"<div style='font-size:0.75rem; color:#94a3b8; margin-top:4px;'>Host: <code>{plat.get('host', '')[:24]}...</code></div>"
        f"<div style='font-size:0.75rem; color:#94a3b8;'>Warehouse ID: <code>{plat.get('warehouse_id', WAREHOUSE_ID)[:14]}...</code></div>"
        f"</div>",
        unsafe_allow_html=True
    )

    # 2. Database Schema & Batch
    st.markdown(
        f"<div class='conn-card'>"
        f"<div style='display:flex; justify-content:space-between; align-items:center;'>"
        f"<span style='font-weight:600; font-size:0.85rem; color:#f8fafc;'>Catalog & Schema</span>"
        f"<span class='status-pill-ok'>🟢 Active</span>"
        f"</div>"
        f"<div style='font-size:0.75rem; color:#94a3b8; margin-top:4px;'>DB: <code>{DB}</code></div>"
        f"<div style='font-size:0.75rem; color:#94a3b8;'>Batch: <code>{BATCH_ID}</code></div>"
        f"</div>",
        unsafe_allow_html=True
    )

    # 3. Tables Status
    st.markdown("<div style='font-size:0.82rem; font-weight:600; color:#cbd5e1; margin-top:8px; margin-bottom:5px;'>📋 Tables Connection:</div>", unsafe_allow_html=True)
    table_metadata = [
        ("user_queries", "💬", "User Prompts & Answers"),
        ("rag_observability", "📈", "Metrics, Cost & Telemetry"),
        ("rag_retrieval_logs", "📚", "Retrieved Chunks & Scores"),
        ("rag_feedback", "⭐", "User Ratings & Feedback")
    ]
    for tbl_id, icon, desc in table_metadata:
        t_data = tbls.get(tbl_id, {})
        t_ok = t_data.get("status") == "ok"
        t_badge = f"<span class='status-pill-ok'>🟢 {t_data.get('message', 'Active')}</span>" if t_ok else f"<span class='status-pill-err'>🔴 {t_data.get('message', 'Missing')}</span>"
        st.markdown(
            f"<div class='table-status-row'>"
            f"<div><span>{icon} <b>{tbl_id}</b></span><br><span style='font-size:0.68rem; color:#64748b;'>{desc}</span></div>"
            f"{t_badge}"
            f"</div>",
            unsafe_allow_html=True
        )

    # 4. Vector Search Endpoint
    v_ok = vec.get("status") == "ok"
    v_badge = f"<span class='status-pill-ok'>🟢 {vec.get('state', 'ONLINE')} ({vec.get('latency_ms', 0):.0f}ms)</span>" if v_ok else f"<span class='status-pill-err'>🔴 {vec.get('state', 'OFFLINE')}</span>"
    st.markdown(
        f"<div class='table-status-row' style='margin-top:6px;'>"
        f"<div><span>🔍 <b>Vector Search</b></span><br><span style='font-size:0.68rem; color:#64748b;'>{vec.get('endpoint', 'rag-gov-endpoint')}</span></div>"
        f"{v_badge}"
        f"</div>",
        unsafe_allow_html=True
    )

    st.divider()
    st.header("📜 Recent Queries (user_queries)")
    try:
        hist = run_sql(f"""
        SELECT question_id, user_question, timestamp
        FROM {DB}.user_queries
        ORDER BY timestamp DESC
        LIMIT 8
        """)
        if hasattr(hist, 'collect'):
            rows = hist.collect()
        elif hasattr(hist, 'result') and hist.result and hist.result.data_array:
            rows = hist.result.data_array
        else:
            rows = []
        if rows:
            for r in rows:
                ts = str(r[2]) if len(r) > 2 else ""
                q = str(r[1]) if len(r) > 1 else ""
                st.markdown(f"**{ts[:16]}** | {q[:50]}...")
        else:
            st.info("No queries recorded yet.")
    except Exception as e:
        # Graceful fallback: show recent questions from current session
        session_queries = []
        for m in st.session_state.get("text_messages", []):
            if m.get("role") == "user":
                session_queries.append(m.get("content", ""))
        for d in st.session_state.get("voice_dialogues", []):
            if d.get("user_text"):
                session_queries.append(d.get("user_text", ""))

        if session_queries:
            st.caption("*(Current Session Cache — Warehouse Idle)*")
            for q in reversed(session_queries[-8:]):
                st.markdown(f"💬 {q[:50]}...")
        else:
            st.caption("⏸️ Warehouse resting (daily quota). Queries from this session will appear here.")

# ------------------------------------------------------------------
# TAB NAVIGATION: Text Chat vs Live Speech-to-Speech
# ------------------------------------------------------------------
tab_chat, tab_voice = st.tabs([
    "💬 Text Chat (RAG)",
    "🎙️ Live Speech-to-Speech (Amazon Nova 2.5 Sonic)"
])


# ==================================================================
# TAB 1: TEXT CHAT (RAG)
# ==================================================================
with tab_chat:
    st.subheader("💬 Government Schemes Text Assistant")
    st.caption("Ask questions with automatic PII masking, Databricks vector search retrieval, and multi-model fallback.")

    text_model_options = [
        "Auto (Fallback Chain)",
        BEDROCK_MODEL_1,
        BEDROCK_MODEL_2,
        BEDROCK_MODEL_3,
        f"Databricks: {DATABRICKS_FALLBACK_LLM}"
    ]
    selected_text_model = st.selectbox(
        "Select Active Text Model:",
        options=text_model_options,
        index=0,
        key="text_model_select"
    )

    if selected_text_model.startswith("Auto"):
        active_text_model = "Auto"
    elif "Databricks:" in selected_text_model:
        active_text_model = DATABRICKS_FALLBACK_LLM
    else:
        active_text_model = selected_text_model

    # Display Text Chat History
    for idx, message in enumerate(st.session_state.text_messages):
        with st.chat_message(message["role"]):
            if message["role"] == "user":
                st.markdown(
                    f"""
                    <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(99, 102, 241, 0.35); border-left: 4px solid #6366f1; border-radius: 8px; padding: 12px 16px; margin-bottom: 4px;">
                        <div style="font-size: 11px; color: #a5b4fc; font-weight: 700; letter-spacing: 0.5px;">🗣️ YOU (QUESTION)</div>
                        <div style="font-size: 15px; color: #f8fafc; margin-top: 4px; font-weight: 600; white-space: pre-wrap;">{message['content']}</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )
            else:
                st.markdown(
                    f"""
                    <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(14, 165, 233, 0.35); border-left: 4px solid #0284c7; border-radius: 8px; padding: 14px 18px; margin-bottom: 4px;">
                        <div style="font-size: 11px; color: #38bdf8; font-weight: 700; letter-spacing: 0.5px;">🤖 RAG ASSISTANT RESPONSE</div>
                        <div style="font-size: 15px; color: #38bdf8; margin-top: 6px; line-height: 1.6; font-weight: 500; white-space: pre-wrap;">{message['content']}</div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

            if message["role"] == "assistant" and "metrics" in message:
                m = message["metrics"]
                qid = message["question_id"]
                model_used = message.get("model_used", "Unknown")
                pii_masked = m.get("pii_masked", False)
                inj_det = m.get("injection_detected", False)
                able_ans = m.get("llm_able_to_answer", True)

                # Dynamic model badge color
                if "gemma" in model_used.lower():
                    m_badge_style = "background: rgba(66, 133, 244, 0.18); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35);"
                elif "nemotron" in model_used.lower():
                    m_badge_style = "background: rgba(118, 185, 0, 0.18); color: #a3e635; border: 1px solid rgba(163, 230, 53, 0.35);"
                elif "mistral" in model_used.lower() or "devstral" in model_used.lower():
                    m_badge_style = "background: rgba(251, 146, 60, 0.18); color: #fb923c; border: 1px solid rgba(251, 146, 60, 0.35);"
                elif "llama" in model_used.lower() or "databricks" in model_used.lower():
                    m_badge_style = "background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.35);"
                else:
                    m_badge_style = "background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);"

                pii_badge = "<span class='metric-badge' style='background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);'>🔒 PII Masked</span>" if pii_masked else ""
                inj_badge = "<span class='metric-badge' style='background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);'>🚨 Jailbreak Detected</span>" if inj_det else ""
                scope_badge = "<span class='metric-badge' style='background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);'>✅ Answered</span>" if able_ans else "<span class='metric-badge' style='background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4);'>⚠️ Out of Scope</span>"

                st.markdown(
                    f"<div style='margin-top: 6px; margin-bottom: 4px;'>"
                    f"<span class='model-badge' style='{m_badge_style}'>🧠 {model_used}</span>"
                    f"<span class='metric-badge' style='background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);'>⏱️ Latency: {m['latency_ms']:.0f}ms</span>"
                    f"<span class='metric-badge'>📥 In: {m['input_tokens']}</span>"
                    f"<span class='metric-badge'>📤 Out: {m['output_tokens']}</span>"
                    f"<span class='metric-badge' style='background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);'>💵 Cost: ${(m['input_cost'] + m['output_cost']):.6f}</span>"
                    f"<span class='metric-badge' style='background: rgba(139, 92, 246, 0.12); color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.3);'>📚 Chunks: {len(message.get('retrieved_chunks', []))}</span>"
                    f"{pii_badge}"
                    f"{inj_badge}"
                    f"{scope_badge}"
                    f"</div>",
                    unsafe_allow_html=True
                )

                with st.expander("🔍 Telemetry & Retrieved Context"):
                    st.markdown(f"**Question ID:** `{qid}`")
                    st.markdown(f"**Masked Prompt Logged:** `{message.get('masked_question', '')}`")
                    
                    chunks = message.get("retrieved_chunks", [])
                    scores = message.get("retrieved_scores", [])
                    if chunks:
                        for i, (chunk, score) in enumerate(zip(chunks, scores)):
                            st.markdown(f"> **Chunk {i+1}** *(Score: {score:.4f})*:\n> {chunk}")
                    else:
                        st.info("No external document chunks retrieved.")

                # Feedback widget
                feedback_key = f"feedback_given_text_{qid}"
                if not st.session_state.get(feedback_key, False):
                    with st.expander("⭐ Rate this answer quality"):
                        rating = st.slider("Rating (1-5):", min_value=1, max_value=5, value=5, key=f"text_slider_{qid}")
                        if st.button("Submit rating", key=f"text_btn_{qid}"):
                            try:
                                log_feedback(str(uuid.uuid4()), qid, f"rating_{rating}", rating)
                                st.session_state[feedback_key] = True
                                st.success(f"Rating {rating}/5 recorded in Databricks!")
                            except Exception as e:
                                st.warning(f"Could not save feedback: {e}")
                else:
                    st.caption("✅ Feedback submitted.")

    # Text Input
    if user_text := st.chat_input("Type your question here (e.g. What is Ayushman Bharat?)..."):
        st.session_state.text_messages.append({"role": "user", "content": user_text})
        with st.chat_message("user"):
            st.markdown(
                f"""
                <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(99, 102, 241, 0.35); border-left: 4px solid #6366f1; border-radius: 8px; padding: 12px 16px; margin-bottom: 4px;">
                    <div style="font-size: 11px; color: #a5b4fc; font-weight: 700; letter-spacing: 0.5px;">🗣️ YOU (QUESTION)</div>
                    <div style="font-size: 15px; color: #f8fafc; margin-top: 4px; font-weight: 600; white-space: pre-wrap;">{user_text}</div>
                </div>
                """,
                unsafe_allow_html=True
            )

        with st.chat_message("assistant"):
            with st.spinner(f"Querying {active_text_model} & vector index..."):
                res = execute_rag_pipeline(user_query=user_text, selected_model=active_text_model, num_results=num_results)

            st.markdown(
                f"""
                <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(14, 165, 233, 0.35); border-left: 4px solid #0284c7; border-radius: 8px; padding: 14px 18px; margin-bottom: 4px;">
                    <div style="font-size: 11px; color: #38bdf8; font-weight: 700; letter-spacing: 0.5px;">🤖 RAG ASSISTANT RESPONSE</div>
                    <div style="font-size: 15px; color: #38bdf8; margin-top: 6px; line-height: 1.6; font-weight: 500; white-space: pre-wrap;">{res['answer']}</div>
                </div>
                """,
                unsafe_allow_html=True
            )

            model_used_now = res.get("model_used", "Unknown")
            if "gemma" in model_used_now.lower():
                m_now_style = "background: rgba(66, 133, 244, 0.18); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35);"
            elif "nemotron" in model_used_now.lower():
                m_now_style = "background: rgba(118, 185, 0, 0.18); color: #a3e635; border: 1px solid rgba(163, 230, 53, 0.35);"
            elif "mistral" in model_used_now.lower() or "devstral" in model_used_now.lower():
                m_now_style = "background: rgba(251, 146, 60, 0.18); color: #fb923c; border: 1px solid rgba(251, 146, 60, 0.35);"
            elif "llama" in model_used_now.lower() or "databricks" in model_used_now.lower():
                m_now_style = "background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.35);"
            else:
                m_now_style = "background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);"

            pii_b = "<span class='metric-badge' style='background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);'>🔒 PII Masked</span>" if res.get("security", {}).get("pii_masked") else ""
            inj_b = "<span class='metric-badge' style='background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);'>🚨 Jailbreak Detected</span>" if res.get("security", {}).get("injection_detected") else ""
            scope_b = "<span class='metric-badge' style='background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);'>✅ Answered</span>" if res.get("llm_able_to_answer", True) else "<span class='metric-badge' style='background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4);'>⚠️ Out of Scope</span>"

            st.markdown(
                f"<div style='margin-top: 6px; margin-bottom: 4px;'>"
                f"<span class='model-badge' style='{m_now_style}'>🧠 {res['model_used']}</span>"
                f"<span class='metric-badge' style='background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);'>⏱️ Latency: {res['latency_ms']:.0f}ms</span>"
                f"<span class='metric-badge'>📥 In: {res['input_tokens']}</span>"
                f"<span class='metric-badge'>📤 Out: {res['output_tokens']}</span>"
                f"<span class='metric-badge' style='background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);'>💵 Cost: ${(res['input_cost'] + res['output_cost']):.6f}</span>"
                f"<span class='metric-badge' style='background: rgba(139, 92, 246, 0.12); color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.3);'>📚 Chunks: {len(res['retrieved_chunks'])}</span>"
                f"{pii_b}"
                f"{inj_b}"
                f"{scope_b}"
                f"</div>",
                unsafe_allow_html=True
            )

        st.session_state.text_messages.append({
            "role": "assistant",
            "content": res["answer"],
            "question_id": res["question_id"],
            "model_used": res["model_used"],
            "masked_question": res["masked_question"],
            "retrieved_chunks": res["retrieved_chunks"],
            "retrieved_scores": res["retrieved_scores"],
            "metrics": {
                "latency_ms": res["latency_ms"],
                "input_tokens": res["input_tokens"],
                "output_tokens": res["output_tokens"],
                "input_cost": res["input_cost"],
                "output_cost": res["output_cost"],
                "llm_able_to_answer": res["llm_able_to_answer"],
                "pii_masked": res.get("security", {}).get("pii_masked", False),
                "injection_detected": res.get("security", {}).get("injection_detected", False)
            }
        })
        st.rerun()


# ==================================================================
# TAB 2: LIVE SPEECH-TO-SPEECH (AMAZON NOVA 2.5 SONIC)
# ==================================================================
with tab_voice:
    st.subheader("🎙️ Live Speech-to-Speech")
    st.caption("Bidirectional live speech powered by Amazon Nova 2.5 Sonic. Press **Start Live Session** to speak, and **End Session** to receive spoken & text answers.")

    col_start, col_end, col_clear = st.columns([1, 1, 1])

    # Status Display
    if st.session_state.voice_active:
        st.markdown(
            '<div class="live-status-active">🔴 Live Session Active — Listening to your microphone... Click "End Session" when done speaking.</div>',
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            '<div class="live-status-idle">🟢 Session Idle — Ready to start. Click "▶️ Start Live Session" and speak into your microphone.</div>',
            unsafe_allow_html=True
        )

    with col_start:
        if st.button("▶️ Start Live Session", type="primary", use_container_width=True, disabled=st.session_state.voice_active):
            st.session_state.nova_manager = LiveNovaSonicManager(
                model_id=BEDROCK_MODEL_4
            )
            st.session_state.nova_manager.start(system_prompt=NOVA_RAG_SYSTEM_PROMPT)
            st.session_state.voice_active = True
            st.session_state.last_voice_status = None
            st.rerun()

    with col_end:
        if st.button("⏹️ End Session", type="secondary", use_container_width=True, disabled=not st.session_state.voice_active):
            if "nova_manager" in st.session_state and st.session_state.nova_manager is not None:
                with st.spinner("Ending session & syncing distinct dialogue turns to Databricks..."):
                    turns = st.session_state.nova_manager.stop()
                    st.session_state.voice_active = False

                    if turns:
                        for turn in turns:
                            user_q = turn.get("user_text", "").strip()
                            ans_text = turn.get("assistant_text", "").strip()
                            if not user_q or user_q == "(Spoken Audio Stream)" or len(user_q.strip()) < 3:
                                continue
                            if not ans_text or len(ans_text.strip()) < 3:
                                ans_text = "(Spoken answer completed)"

                            qid = str(uuid.uuid4())
                            # 1. PII Masking & Flag
                            safe_q, pii_masked = mask_pii(user_q or "Live Spoken Question")

                            # 2. Jailbreak / Injection Detection
                            injection_detected = detect_prompt_injection(user_q)

                            # 3. Vector Search Retrieval against gold_vector_index
                            retrieved_chunks, retrieved_scores, retrieved_cids = [], [], []
                            try:
                                if user_q:
                                    retrieved_chunks, retrieved_scores, retrieved_cids = query_databricks_vector_search(user_q, num_results=3)
                            except Exception as ve:
                                print(f"[VOICE RETRIEVAL NOTICE] {ve}")

                            # 4. Check LLM Answering capability
                            able_to_answer = check_llm_answering(ans_text)

                            # 5. Dynamic Token & Multimodal Cost Accounting
                            sys_tokens = len(NOVA_RAG_SYSTEM_PROMPT) // 4
                            it = (len(safe_q) // 4) + sys_tokens
                            ot = max(len(ans_text) // 4, 1)
                            turn_latency_ms = turn.get("latency_ms", 1200.0)

                            # Account for live audio streaming in/out duration with Nova Sonic
                            est_audio_sec = max(turn_latency_ms / 1000.0, 3.0)
                            audio_in_sec = turn.get("audio_in_sec", est_audio_sec * 0.4)
                            audio_out_sec = turn.get("audio_out_sec", est_audio_sec * 0.6)

                            ic, oc, total_turn_cost = calculate_turn_cost(
                                model_name=BEDROCK_MODEL_4,
                                input_tokens=it,
                                output_tokens=ot,
                                audio_in_sec=audio_in_sec,
                                audio_out_sec=audio_out_sec
                            )

                            # 6. Exact Database Table Logging
                            try:
                                # Table 1: user_queries
                                log_user_query(qid, safe_q, ans_text, BATCH_ID)
                                # Table 2: rag_observability
                                log_observability(str(uuid.uuid4()), qid, turn_latency_ms, it, ot, ic, oc, able_to_answer, injection_detected, pii_masked, safe_q)
                                # Table 3: rag_retrieval_logs
                                if retrieved_cids:
                                    log_retrieval(str(uuid.uuid4()), qid, retrieved_cids, retrieved_scores, retrieved_chunks, len(retrieved_cids))
                            except Exception as _e:
                                print(f"[VOICE LOG NOTICE] {_e}")

                            # 7. Add to Session State Dialogues
                            st.session_state.voice_dialogues.append({
                                "user_text": user_q,
                                "assistant_text": ans_text,
                                "model_used": BEDROCK_MODEL_4,
                                "question_id": qid,
                                "latency_ms": turn_latency_ms,
                                "input_tokens": it,
                                "output_tokens": ot,
                                "cost": total_turn_cost,
                                "pii_masked": pii_masked,
                                "injection_detected": injection_detected,
                                "able_to_answer": able_to_answer,
                                "retrieved_chunks": retrieved_chunks,
                                "retrieved_scores": retrieved_scores,
                            })
                    else:
                        st.session_state.last_voice_status = "no_speech_detected"

            st.session_state.nova_manager = None
            st.rerun()

    with col_clear:
        if st.button("🗑️ Clear Dialogue History", use_container_width=True):
            st.session_state.voice_dialogues = []
            st.session_state.last_voice_status = None
            st.rerun()

    # Informative warning if last session ended without speech detection
    if not st.session_state.get("voice_active") and st.session_state.get("last_voice_status") == "no_speech_detected":
        st.warning(
            "⚠️ **No speech was captured during the last session.** Please speak into your microphone after clicking '▶️ Start Live Session'."
        )

    # Real-Time Live Speech Transcription Display
    @st.fragment(run_every="1s")
    def live_speech_transcription_box():
        if st.session_state.get("voice_active") and "nova_manager" in st.session_state and st.session_state.nova_manager:
            mgr = st.session_state.nova_manager
            err = mgr.get_error()
            if err:
                st.error(f"⚠️ {err}")
            u_text, a_text, past_turns, last_u, last_a = mgr.get_live_transcripts()

            # 1. Render all turns already completed in this live session
            if past_turns:
                st.markdown("##### 💬 Session Dialogue Stream")
                for t in past_turns:
                    st.markdown(
                        f"""
                        <div style="background: rgba(15, 23, 42, 0.5); border-left: 4px solid #0284c7; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #94a3b8; font-weight: 700;">QUESTION #{t['turn_id']}</div>
                            <div style="font-size: 15px; color: #f8fafc; margin-top: 4px; font-weight: 600;">🗣️ You: {t['user_text']}</div>
                            <div style="font-size: 14px; color: #38bdf8; margin-top: 6px; line-height: 1.5;">🤖 Nova Sonic: {t['assistant_text']}</div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

            # 2. Render in-progress active speech with real-time mic signal level
            mic_pct = mgr.get_mic_level()
            if mic_pct > 3:
                mic_indicator = f"<span class='status-pill-ok' style='margin-left: 8px;'>🎤 Sound Detected: {mic_pct}%</span>"
            else:
                mic_indicator = f"<span class='status-pill-warn' style='margin-left: 8px;'>⚠️ Mic Silent ({mic_pct}%) — Check Earphones</span>"

            st.markdown(
                '<div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.4); '
                'border-radius: 10px; padding: 16px; margin-top: 10px; margin-bottom: 12px;">'
                '<div style="font-weight: 700; color: #38bdf8; font-size: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">'
                f'<span>🎙️ Current Live Stream (Amazon Nova 2.5 Sonic) {mic_indicator}</span>'
                f'<span style="font-size: 11px; background: #0284c7; color: #ffffff; padding: 3px 8px; border-radius: 12px;">Turn {len(past_turns) + 1}</span>'
                '</div>',
                unsafe_allow_html=True
            )

            current_u = u_text or (last_u if not past_turns else "")
            current_a = a_text or (last_a if not past_turns else "")

            if current_u:
                st.markdown(f"**🗣️ You are saying:** {current_u}")
            else:
                st.markdown("🗣️ *Listening to microphone... Speak now (Amazon Nova transcribes your voice in real time).*")

            if current_a:
                st.markdown(f"**🤖 Nova Sonic is answering:** {current_a}")

            st.markdown('</div>', unsafe_allow_html=True)

    if st.session_state.voice_active:
        live_speech_transcription_box()

    st.divider()

    # Display Voice Conversation Logs
    if st.session_state.voice_dialogues:
        st.markdown("### 🗣️ Live Dialogue History")
        for i, dialogue in enumerate(reversed(st.session_state.voice_dialogues)):
            turn_num = len(st.session_state.voice_dialogues) - i

            with st.container():
                st.markdown(f"#### 🎙️ Live Voice Turn #{turn_num}")
                st.markdown(f"**You (Spoken):** {dialogue.get('user_text')}")
                st.markdown(f"**Nova Sonic:** {dialogue.get('assistant_text')}")

                # Telemetry
                pii_badge = "<span class='metric-badge' style='background: rgba(245, 158, 11, 0.2); color: #f59e0b;'>🔒 PII Masked</span>" if dialogue.get("pii_masked") else ""
                inj_badge = "<span class='metric-badge' style='background: rgba(239, 68, 68, 0.2); color: #ef4444;'>🚨 Jailbreak Detected</span>" if dialogue.get("injection_detected") else ""
                scope_badge = "<span class='metric-badge' style='background: rgba(148, 163, 184, 0.2); color: #94a3b8;'>⚠️ Out of Scope</span>" if not dialogue.get("able_to_answer", True) else "<span class='metric-badge' style='background: rgba(16, 185, 129, 0.2); color: #10b981;'>✅ Answered</span>"

                st.markdown(
                    f"<div style='margin-top: 4px;'>"
                    f"<span class='model-badge'>🧠 {dialogue['model_used']}</span>"
                    f"<span class='metric-badge'>⏱️ Latency: {dialogue['latency_ms']:.0f}ms</span>"
                    f"<span class='metric-badge'>📥 In: {dialogue['input_tokens']}</span>"
                    f"<span class='metric-badge'>📤 Out: {dialogue['output_tokens']}</span>"
                    f"<span class='metric-badge'>💵 Cost: ${dialogue['cost']:.6f}</span>"
                    f"<span class='metric-badge'>📚 Chunks: {len(dialogue.get('retrieved_chunks', []))}</span>"
                    f"{pii_badge}"
                    f"{inj_badge}"
                    f"{scope_badge}"
                    f"</div>",
                    unsafe_allow_html=True
                )

                # Retrieved RAG Sources
                if dialogue.get("retrieved_chunks"):
                    with st.expander(f"📚 Retrieved RAG Sources ({len(dialogue['retrieved_chunks'])})"):
                        for chunk_idx, chunk in enumerate(dialogue["retrieved_chunks"]):
                            score_str = f"(Score: {dialogue['retrieved_scores'][chunk_idx]:.4f})" if chunk_idx < len(dialogue.get("retrieved_scores", [])) else ""
                            st.caption(f"**Source #{chunk_idx + 1}** {score_str}")
                            st.markdown(f"```text\n{chunk[:400]}...\n```")

                # Feedback widget
                qid = dialogue["question_id"]
                fb_key = f"voice_feedback_{qid}"
                if not st.session_state.get(fb_key, False):
                    with st.expander("⭐ Rate this voice answer"):
                        v_rating = st.slider("Rating (1-5):", min_value=1, max_value=5, value=5, key=f"v_slider_{qid}")
                        if st.button("Submit rating", key=f"v_btn_{qid}"):
                            try:
                                log_feedback(str(uuid.uuid4()), qid, f"rating_{v_rating}", v_rating)
                                st.session_state[fb_key] = True
                                st.success(f"Rating {v_rating}/5 submitted to Databricks!")
                            except Exception as e:
                                st.warning(f"Could not save feedback: {e}")
                else:
                    st.caption("✅ Feedback submitted.")

                st.divider()
    else:
        st.info("No speech sessions recorded yet. Click **▶️ Start Live Session** above to begin speaking.")
