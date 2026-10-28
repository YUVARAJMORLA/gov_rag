"""
python_bridge.py
----------------
Fast, robust HTTP Microservice (Flask) bridging the Node.js/MERN stack
to the Python Databricks SDK, Vector AI Search, AWS Bedrock models, and Guardrails.

Runs on port 5001.
"""

import os
import sys

# Configure UTF-8 stdout/stderr on Windows to prevent charmap encoding errors with Indic scripts
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import uuid
import json
import traceback
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Load workspace environment variables
load_dotenv()

def _esc(val):
    """Escape single quotes for safe Databricks SQL string literals."""
    return str(val).replace("'", "''").strip()

# Import existing application modules
try:
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
        test_vector_search_endpoint,
        host as DB_HOST
    )
    from rag_service import (
        execute_rag_pipeline,
        query_databricks_vector_search,
        calculate_turn_cost,
        get_model_pricing,
        BEDROCK_MODEL_PRICING,
        BEDROCK_MODELS,
        BEDROCK_MODEL_1,
        BEDROCK_MODEL_2,
        BEDROCK_MODEL_3,
        BEDROCK_MODEL_4,
        DATABRICKS_FALLBACK_LLM
    )
    from guardrails import mask_pii, detect_prompt_injection, check_llm_answering
    from tts_service import synthesize_speech_base64
except Exception as e:
    print(f"[CRITICAL ERROR] Failed to import core modules: {e}")
    traceback.print_exc()

app = Flask(__name__)

# Basic CORS headers for all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Gov Schemes RAG AI Engine",
        "timestamp": time.time(),
        "databricks_db": DB,
        "batch_id": BATCH_ID
    })

@app.route('/api/rag/query', methods=['POST'])
def rag_query():
    """Execute text query against RAG pipeline with guardrails & multi-model fallback."""
    try:
        data = request.get_json(force=True) or {}
        user_query = data.get("query", "").strip()
        selected_model = data.get("model", "Auto")
        num_results = int(data.get("num_results", 5))
        is_first_turn = bool(data.get("is_first_turn", False))
        target_language = data.get("target_language", "en")
        is_voice = bool(data.get("is_voice", False))

        if not user_query:
            return jsonify({"error": "Query string is required"}), 400

        result = execute_rag_pipeline(
            user_query=user_query,
            selected_model=selected_model,
            num_results=num_results,
            is_first_turn=is_first_turn,
            target_language=target_language,
            is_voice=is_voice
        )

        if result.get("audio_response") and isinstance(result["audio_response"], bytes):
            import base64
            result["audio_base64"] = base64.b64encode(result["audio_response"]).decode('ascii')
            result["audio_response"] = None

        return jsonify({
            "success": True,
            "data": result
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/databricks/test', methods=['GET'])
def test_connections():
    """Test Databricks Platform, Unity Catalog tables, and Vector Search endpoint."""
    try:
        p_res = test_databricks_platform()
        t_res = test_databricks_tables()
        v_res = test_vector_search_endpoint()

        return jsonify({
            "success": True,
            "platform": p_res,
            "tables": t_res,
            "vector": v_res,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/databricks/feedback', methods=['POST'])
def submit_feedback():
    """Log user rating (1-5) and feedback directly to Databricks rag_feedback table."""
    try:
        data = request.get_json(force=True) or {}
        question_id = data.get("question_id", "").strip()
        rating = int(data.get("rating", 5))
        feedback_text = data.get("feedback", f"rating_{rating}")
        feedback_id = data.get("feedback_id") or str(uuid.uuid4())

        if not question_id:
            return jsonify({"error": "question_id is required"}), 400

        log_feedback(feedback_id, question_id, feedback_text, rating)

        return jsonify({
            "success": True,
            "message": f"Rating {rating}/5 recorded in Databricks",
            "feedback_id": feedback_id
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Known schema columns for target Databricks tables
TABLE_COLUMNS = {
    "user_queries": ["question_id", "user_question", "llm_answer", "timestamp", "batch_id"],
    "rag_observability": [
        "observability_id", "question_id", "latency_ms", "input_tokens", "output_tokens",
        "input_cost", "output_cost", "llm_able_to_answer", "injection_detected",
        "pii_masked", "masked_question", "timestamp"
    ],
    "rag_retrieval_logs": [
        "log_id", "question_id", "retrieved_chunk_ids", "retrieved_scores",
        "retrieved_texts", "num_retrieved", "timestamp"
    ],
    "rag_feedback": ["feedback_id", "question_id", "user_feedback", "rating", "timestamp"]
}

@app.route('/api/databricks/table-data', methods=['GET'])
def get_table_data():
    """Fetch recent rows from Databricks tables for admin inspection."""
    try:
        table_name = request.args.get("table", "user_queries").strip()
        limit = min(int(request.args.get("limit", 15)), 50)

        # Security check: only allow safe known tables
        allowed_tables = ["user_queries", "rag_observability", "rag_retrieval_logs", "rag_feedback"]
        if table_name not in allowed_tables:
            return jsonify({"error": f"Invalid table. Allowed: {allowed_tables}"}), 400

        query_sql = f"SELECT * FROM {DB}.{table_name} ORDER BY timestamp DESC LIMIT {limit}"
        res = run_sql(query_sql)

        rows = []
        columns = []

        if hasattr(res, 'result') and res.result:
            if hasattr(res.result, 'schema') and res.result.schema and res.result.schema.columns:
                columns = [col.name for col in res.result.schema.columns]
            elif hasattr(res, 'manifest') and hasattr(res.manifest, 'schema') and res.manifest.schema.columns:
                columns = [col.name for col in res.manifest.schema.columns]

            if not columns:
                columns = TABLE_COLUMNS.get(table_name, [])

            if res.result.data_array:
                for row in res.result.data_array:
                    row_dict = {}
                    for idx, val in enumerate(row):
                        col_name = columns[idx] if idx < len(columns) else f"col_{idx}"
                        row_dict[col_name] = str(val) if val is not None else None
                    rows.append(row_dict)
        elif hasattr(res, 'collect'):
            for r in res.collect():
                rows.append(dict(r.asDict()))
            if rows:
                columns = list(rows[0].keys())

        if not columns:
            columns = TABLE_COLUMNS.get(table_name, [])

        return jsonify({
            "success": True,
            "table": f"{DB}.{table_name}",
            "columns": columns,
            "total_rows": len(rows),
            "rows": rows
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "table": table_name,
            "columns": TABLE_COLUMNS.get(table_name, []),
            "rows": []
        }), 200

@app.route('/api/databricks/analytics-summary', methods=['GET'])
def get_analytics_summary():
    """Aggregated Databricks tables metrics for Admin Dashboards."""
    try:
        # 1. Query aggregate stats from rag_observability
        stats_sql = f"""
        SELECT 
            count(*) as total_obs,
            coalesce(sum(input_tokens), 0) as total_in_tok,
            coalesce(sum(output_tokens), 0) as total_out_tok,
            coalesce(sum(input_cost + output_cost), 0) as total_cost,
            coalesce(avg(latency_ms), 0) as avg_lat,
            count(case when pii_masked then 1 end) as pii_count,
            count(case when injection_detected then 1 end) as injection_count,
            count(case when not llm_able_to_answer then 1 end) as unanswered_count,
            count(case when llm_able_to_answer then 1 end) as answered_count
        FROM {DB}.rag_observability
        """
        obs_res = run_sql(stats_sql)
        obs_row = obs_res.result.data_array[0] if (hasattr(obs_res, 'result') and obs_res.result and obs_res.result.data_array) else [0, 0, 0, 0, 0, 0, 0, 0, 0]

        total_obs = int(obs_row[0] or 0)
        total_in_tok = int(obs_row[1] or 0)
        total_out_tok = int(obs_row[2] or 0)
        total_cost = float(obs_row[3] or 0.0)
        avg_lat = float(obs_row[4] or 0.0)
        pii_count = int(obs_row[5] or 0)
        injection_count = int(obs_row[6] or 0)
        unanswered_count = int(obs_row[7] or 0)
        answered_count = int(obs_row[8] or 0)

        # 2. Query feedback stats
        fb_sql = f"SELECT count(*), coalesce(avg(rating), 0) FROM {DB}.rag_feedback"
        fb_res = run_sql(fb_sql)
        fb_row = fb_res.result.data_array[0] if (hasattr(fb_res, 'result') and fb_res.result and fb_res.result.data_array) else [0, 0]
        fb_count = int(fb_row[0] or 0)
        fb_avg = float(fb_row[1] or 0.0)

        # 3. Query security incidents (recent masked & injection rows)
        sec_sql = f"""
        SELECT question_id, masked_question, pii_masked, injection_detected, timestamp
        FROM {DB}.rag_observability
        WHERE pii_masked = true OR injection_detected = true
        ORDER BY timestamp DESC
        LIMIT 15
        """
        sec_res = run_sql(sec_sql)
        security_incidents = []
        if hasattr(sec_res, 'result') and sec_res.result and sec_res.result.data_array:
            for r in sec_res.result.data_array:
                security_incidents.append({
                    "question_id": str(r[0]),
                    "masked_question": str(r[1]) if r[1] else "",
                    "pii_masked": bool(r[2] and str(r[2]).lower() == 'true'),
                    "injection_detected": bool(r[3] and str(r[3]).lower() == 'true'),
                    "timestamp": str(r[4])
                })

        # 4. Query unanswered / out-of-scope questions
        unanswered_sql = f"""
        SELECT o.question_id, o.masked_question, coalesce(q.llm_answer, 'Out of scope refusal') as answer, o.timestamp
        FROM {DB}.rag_observability o
        LEFT JOIN {DB}.user_queries q ON o.question_id = q.question_id
        WHERE o.llm_able_to_answer = false
        ORDER BY o.timestamp DESC
        LIMIT 15
        """
        un_res = run_sql(unanswered_sql)
        unanswered_list = []
        if hasattr(un_res, 'result') and un_res.result and un_res.result.data_array:
            for r in un_res.result.data_array:
                unanswered_list.append({
                    "question_id": str(r[0]),
                    "question": str(r[1]) if r[1] else "",
                    "answer": str(r[2]) if r[2] else "",
                    "timestamp": str(r[3])
                })

        return jsonify({
            "success": True,
            "metrics": {
                "total_questions": total_obs,
                "total_cost_usd": round(total_cost, 6),
                "total_tokens": total_in_tok + total_out_tok,
                "input_tokens": total_in_tok,
                "output_tokens": total_out_tok,
                "avg_latency_ms": round(avg_lat, 1),
                "total_security_incidents": pii_count + injection_count,
                "pii_masked_count": pii_count,
                "injection_detected_count": injection_count,
                "unanswered_questions_count": unanswered_count,
                "answered_questions_count": answered_count,
                "domain_accuracy_pct": round((answered_count / total_obs * 100), 1) if total_obs > 0 else 100.0,
                "total_feedback_count": fb_count,
                "avg_rating": round(fb_avg, 2)
            },
            "security_incidents": security_incidents,
            "unanswered_questions": unanswered_list
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/voice/synthesize', methods=['POST'])
def synthesize_voice():
    """Generate on-demand high-quality neural voice audio for Telugu, Hindi, or English."""
    try:
        data = request.get_json(force=True) or {}
        text = data.get("text", "").strip()
        target_language = data.get("target_language", "en")
        voice_gender = data.get("voice_gender", "Female")
        is_nova_sonic = bool(data.get("is_nova_sonic", False))

        if not text:
            return jsonify({"error": "text is required"}), 400

        audio_base64 = synthesize_speech_base64(
            text=text,
            target_language=target_language,
            voice_gender=voice_gender,
            is_nova_sonic=is_nova_sonic
        )

        return jsonify({
            "success": bool(audio_base64),
            "audio_base64": audio_base64,
            "target_language": target_language
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/voice/process-turn', methods=['POST'])
def process_voice_turn():
    """Process a voice conversation turn with PII masking, vector search, LLM, and cost logging."""
    try:
        data = request.get_json(force=True) or {}
        user_text = data.get("user_text", "").strip()
        selected_model = data.get("model", BEDROCK_MODEL_4)
        target_language = data.get("target_language", "en")

        if not user_text or len(user_text) < 2:
            return jsonify({"error": "user_text is required"}), 400

        # Execute RAG pipeline
        result = execute_rag_pipeline(
            user_query=user_text,
            selected_model=selected_model,
            num_results=3,
            target_language=target_language
        )

        if result.get("audio_response") and isinstance(result["audio_response"], bytes):
            import base64
            result["audio_base64"] = base64.b64encode(result["audio_response"]).decode('ascii')
            result["audio_response"] = None

        return jsonify({
            "success": True,
            "data": result
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/config/info', methods=['GET'])
def get_config_info():
    """Return non-sensitive configuration details for Admin Dashboard."""
    return jsonify({
        "success": True,
        "databricks": {
            "host": DB_HOST,
            "warehouse_id": WAREHOUSE_ID,
            "catalog": CATALOG,
            "schema": SCHEMA,
            "full_db": DB,
            "batch_id": BATCH_ID,
            "vector_endpoint": os.getenv("DATABRICKS_VECTOR_SEARCH_ENDPOINT", "rag-gov-endpoint"),
            "vector_index": os.getenv("DATABRICKS_INDEX_NAME", f"{DB}.gold_vector_index"),
            "embedding_model": os.getenv("EMBEDDING_MODEL", "databricks-gte-large-en"),
            "llm_model": os.getenv("Databricks_LLM_MODEL", DATABRICKS_FALLBACK_LLM)
        },
        "bedrock": {
            "region": os.getenv("AWS_REGION", "us-east-1"),
            "model_1": BEDROCK_MODEL_1,
            "model_2": BEDROCK_MODEL_2,
            "model_3": BEDROCK_MODEL_3,
            "model_4_voice": BEDROCK_MODEL_4
        },
        "available_models": [
            "Auto",
            BEDROCK_MODEL_1,
            BEDROCK_MODEL_2,
            BEDROCK_MODEL_3,
            BEDROCK_MODEL_4,
            DATABRICKS_FALLBACK_LLM
        ],
        "pricing": BEDROCK_MODEL_PRICING
    })

# In-memory cache for high-performance Knowledge Graph rendering
_KG_CACHE = {
    "data": None,
    "timestamp": 0
}

@app.route('/api/databricks/knowledge-graph', methods=['GET'])
def get_knowledge_graph():
    """
    Constructs an interactive Knowledge Graph from Databricks Unity Catalog tables:
    1. Core content nodes:
       - silver_documents (doc_id, file_name, version, num_pages, file_size)
       - silver_chunks (chunk_id, doc_id, file_name, chunk_index, page_number, snippet)
       - silver_embeddings (semantic-similarity edges between chunks with cosine > 0.85)
    2. Lineage / provenance edges:
       - raw_documents (source -> document via file_id/content_hash, duplicate identification)
       - bronze_validated (validated status)
       - bronze_quarantine (failed validation nodes, excluded branch with reason)
    3. Usage / interaction edges:
       - user_queries (user query nodes)
       - rag_retrieval_logs (question -> chunk retrieved edges)
    """
    global _KG_CACHE
    import math
    try:
        force_refresh = request.args.get("refresh", "false").lower() == "true"
        doc_filter = request.args.get("doc_id", "").strip()
        sim_threshold = float(request.args.get("similarity_threshold", "0.85"))
        max_chunks_per_doc = int(request.args.get("chunks_per_doc", "8"))

        now = time.time()
        if not force_refresh and not doc_filter and _KG_CACHE["data"] and (now - _KG_CACHE["timestamp"] < 300):
            return jsonify(_KG_CACHE["data"])

        nodes = []
        edges = []
        node_id_set = set()

        def add_node(n_id, label, n_type, group, properties=None):
            if n_id not in node_id_set:
                node_id_set.add(n_id)
                nodes.append({
                    "id": n_id,
                    "label": label,
                    "type": n_type,
                    "group": group,
                    "properties": properties or {}
                })

        def add_edge(src, tgt, e_type, label, properties=None):
            if src in node_id_set and tgt in node_id_set:
                edges.append({
                    "id": f"{src}->{tgt}:{e_type}",
                    "source": src,
                    "target": tgt,
                    "type": e_type,
                    "label": label,
                    "properties": properties or {}
                })

        # 1. Fetch Raw Documents (Ingestion Lineage) - Ordered by file_name
        raw_res = run_sql(f"SELECT file_id, file_name, content_hash, source, file_size, ingestion_timestamp FROM {DB}.raw_documents ORDER BY file_name")
        raw_rows = raw_res.result.data_array if hasattr(raw_res, 'result') and raw_res.result and raw_res.result.data_array else (raw_res.collect() if hasattr(raw_res, 'collect') else [])
        raw_map = {}
        for r in raw_rows:
            f_id = str(r[0])
            f_name = str(r[1])
            ing_time = str(r[5]) if len(r) > 5 and r[5] else ""
            raw_map[f_id] = {
                "file_name": f_name,
                "content_hash": str(r[2]) if len(r) > 2 else "",
                "source": str(r[3]) if len(r) > 3 else "s3",
                "file_size": int(r[4]) if len(r) > 4 and r[4] else 0,
                "timestamp": ing_time
            }
            add_node(
                n_id=f"raw_{f_id}",
                label=f_name,
                n_type="raw_document",
                group="raw",
                properties={
                    "file_id": f_id,
                    "file_name": f_name,
                    "source": raw_map[f_id]["source"],
                    "file_size": raw_map[f_id]["file_size"],
                    "content_hash": raw_map[f_id]["content_hash"],
                    "timestamp": ing_time,
                    "ingestion_timestamp": ing_time,
                    "table": f"{DB}.raw_documents",
                    "stage": "1. Raw Source Ingestion"
                }
            )

        # 2. Fetch Bronze Validated - Ordered by file_name
        val_res = run_sql(f"SELECT file_id, file_name, status, num_pages, validation_timestamp FROM {DB}.bronze_validated ORDER BY file_name")
        val_rows = val_res.result.data_array if hasattr(val_res, 'result') and val_res.result and val_res.result.data_array else (val_res.collect() if hasattr(val_res, 'collect') else [])
        for r in val_rows:
            f_id = str(r[0])
            f_name = str(r[1])
            status = str(r[2])
            pages = int(r[3]) if len(r) > 3 and r[3] else 1
            val_time = str(r[4]) if len(r) > 4 and r[4] else ""
            v_node_id = f"val_{f_id}"
            add_node(
                n_id=v_node_id,
                label=f_name,
                n_type="bronze_validated",
                group="validated",
                properties={
                    "file_id": f_id,
                    "file_name": f_name,
                    "status": status,
                    "num_pages": pages,
                    "timestamp": val_time,
                    "validation_timestamp": val_time,
                    "table": f"{DB}.bronze_validated",
                    "stage": "2. Bronze Validation Passed"
                }
            )
            add_edge(f"raw_{f_id}", v_node_id, "validated_as", "Validation Passed", {"file_name": f_name})

        # 3. Fetch Bronze Quarantine (Excluded branch) - Ordered by file_name
        quar_res = run_sql(f"SELECT file_id, file_name, quarantine_reason, is_duplicate, is_blank, is_pdf, quarantine_timestamp FROM {DB}.bronze_quarantine ORDER BY file_name")
        quar_rows = quar_res.result.data_array if hasattr(quar_res, 'result') and quar_res.result and quar_res.result.data_array else (quar_res.collect() if hasattr(quar_res, 'collect') else [])
        for r in quar_rows:
            f_id = str(r[0])
            f_name = str(r[1])
            q_reason = str(r[2])
            is_dup = bool(r[3] and str(r[3]).lower() == 'true')
            is_blank = bool(r[4] and str(r[4]).lower() == 'true')
            is_pdf = bool(r[5] and str(r[5]).lower() == 'true')
            quar_time = str(r[6]) if len(r) > 6 and r[6] else ""
            q_node_id = f"quar_{f_id}"
            add_node(
                n_id=q_node_id,
                label=f"{f_name} [{q_reason}]",
                n_type="bronze_quarantine",
                group="quarantine",
                properties={
                    "file_id": f_id,
                    "file_name": f_name,
                    "quarantine_reason": q_reason,
                    "is_duplicate": is_dup,
                    "is_blank": is_blank,
                    "is_pdf": is_pdf,
                    "timestamp": quar_time,
                    "quarantine_timestamp": quar_time,
                    "table": f"{DB}.bronze_quarantine",
                    "stage": "2. Quarantined (Excluded Branch)"
                }
            )
            add_edge(f"raw_{f_id}", q_node_id, "quarantined_to", f"Quarantined: {q_reason}", {"reason": q_reason})

        # 4. Fetch Silver Documents (Core Content Nodes) - Ordered by file_name
        doc_sql = f"SELECT doc_id, file_id, file_name, normalized_name, version, num_pages, file_size, versioning_timestamp FROM {DB}.silver_documents"
        if doc_filter:
            doc_sql += f" WHERE doc_id = '{_esc(doc_filter)}'"
        doc_sql += " ORDER BY file_name"
        doc_res = run_sql(doc_sql)
        doc_rows = doc_res.result.data_array if hasattr(doc_res, 'result') and doc_res.result and doc_res.result.data_array else (doc_res.collect() if hasattr(doc_res, 'collect') else [])
        
        silver_doc_ids = []
        for r in doc_rows:
            d_id = str(r[0])
            f_id = str(r[1])
            f_name = str(r[2])
            norm_name = str(r[3]) if len(r) > 3 else f_name
            ver = str(r[4]) if len(r) > 4 else "v1.0"
            pages = int(r[5]) if len(r) > 5 and r[5] else 1
            f_size = int(r[6]) if len(r) > 6 and r[6] else 0
            doc_time = str(r[7]) if len(r) > 7 and r[7] else ""

            silver_doc_ids.append(d_id)
            d_node_id = f"doc_{d_id}"
            add_node(
                n_id=d_node_id,
                label=f_name,
                n_type="silver_document",
                group="document",
                properties={
                    "doc_id": d_id,
                    "file_id": f_id,
                    "file_name": f_name,
                    "normalized_name": norm_name,
                    "version": ver,
                    "num_pages": pages,
                    "file_size": f_size,
                    "timestamp": doc_time,
                    "versioning_timestamp": doc_time,
                    "table": f"{DB}.silver_documents",
                    "stage": "3. Silver Canonical Document"
                }
            )
            # Explicit, guaranteed edge connecting Bronze Validated to Silver Canonical Document
            add_edge(f"val_{f_id}", d_node_id, "promoted_to", "Promoted to Silver", {"file_name": f_name, "stage": "Promotion"})

        # 5. Fetch Recent User Queries and Interaction Edges (rag_retrieval_logs) FIRST
        logs_sql = f"""
        SELECT q.question_id, q.user_question, q.timestamp, l.retrieved_chunk_ids, l.retrieved_scores, coalesce(q.llm_answer, '')
        FROM {DB}.user_queries q
        JOIN {DB}.rag_retrieval_logs l ON q.question_id = l.question_id
        WHERE l.retrieved_chunk_ids IS NOT NULL AND length(l.retrieved_chunk_ids) > 10
        ORDER BY q.timestamp DESC
        LIMIT 10
        """
        logs_res = run_sql(logs_sql)
        logs_rows = logs_res.result.data_array if hasattr(logs_res, 'result') and logs_res.result and logs_res.result.data_array else (logs_res.collect() if hasattr(logs_res, 'collect') else [])

        all_retrieved_chunk_ids = []
        parsed_logs = []
        for r in logs_rows:
            q_id = str(r[0])
            q_text = str(r[1])
            q_time = str(r[2])
            cids_raw = str(r[3])
            scores_raw = str(r[4]) if len(r) > 4 else "[]"
            q_ans = str(r[5]) if len(r) > 5 else ""
            try:
                retrieved_cids = json.loads(cids_raw) if isinstance(cids_raw, str) else cids_raw
                retrieved_scores = json.loads(scores_raw) if isinstance(scores_raw, str) else scores_raw
            except Exception:
                retrieved_cids = []
                retrieved_scores = []
            if isinstance(retrieved_cids, list):
                all_retrieved_chunk_ids.extend(retrieved_cids[:3])
            parsed_logs.append((q_id, q_text, q_time, retrieved_cids, retrieved_scores, q_ans))

        # 6. Fetch Silver Chunks - Including specific chunks retrieved by citizen queries
        cids_in_sql = "', '".join([_esc(cid) for cid in set(all_retrieved_chunk_ids)]) if all_retrieved_chunk_ids else ""
        if doc_filter:
            chunk_sql = f"SELECT chunk_id, doc_id, file_name, version, chunk_index, page_number, substring(chunk_text, 1, 350) as snippet FROM {DB}.silver_chunks WHERE doc_id = '{_esc(doc_filter)}' ORDER BY chunk_index"
        elif cids_in_sql:
            chunk_sql = f"""
            SELECT chunk_id, doc_id, file_name, version, chunk_index, page_number, substring(chunk_text, 1, 350) as snippet
            FROM {DB}.silver_chunks
            WHERE chunk_index < {max_chunks_per_doc} OR chunk_id IN ('{cids_in_sql}')
            ORDER BY doc_id, chunk_index
            """
        else:
            chunk_sql = f"""
            SELECT chunk_id, doc_id, file_name, version, chunk_index, page_number, substring(chunk_text, 1, 350) as snippet
            FROM {DB}.silver_chunks
            WHERE chunk_index < {max_chunks_per_doc}
            ORDER BY doc_id, chunk_index
            """
        chunk_res = run_sql(chunk_sql)
        chunk_rows = chunk_res.result.data_array if hasattr(chunk_res, 'result') and chunk_res.result and chunk_res.result.data_array else (chunk_res.collect() if hasattr(chunk_res, 'collect') else [])

        chunk_id_list = []
        for r in chunk_rows:
            c_id = str(r[0])
            d_id = str(r[1])
            f_name = str(r[2])
            ver = str(r[3]) if len(r) > 3 else "1.0"
            idx = int(r[4]) if len(r) > 4 and r[4] else 0
            page = int(r[5]) if len(r) > 5 and r[5] else 1
            snippet = str(r[6]) if len(r) > 6 else ""

            chunk_id_list.append(c_id)
            c_node_id = f"chunk_{c_id}"
            add_node(
                n_id=c_node_id,
                label=f"{f_name[:18]}... [p.{page}]",
                n_type="silver_chunk",
                group="chunk",
                properties={
                    "chunk_id": c_id,
                    "doc_id": d_id,
                    "file_name": f_name,
                    "version": ver,
                    "chunk_index": idx,
                    "page_number": page,
                    "snippet": snippet,
                    "table": f"{DB}.silver_chunks",
                    "vector_embedding": "1024-dim GTE Large",
                    "stage": "4. Silver Chunk"
                }
            )
            # Edge connecting Silver Document to its Chunks
            add_edge(f"doc_{d_id}", c_node_id, "has_chunk", f"Page {page} (#{idx})", {"chunk_index": idx, "page": page})

        # 7. Derive Semantic Similarity Edges (silver_embeddings with cosine > threshold)
        if chunk_id_list:
            cid_in = "', '".join([_esc(cid) for cid in chunk_id_list[:35]])
            emb_sql = f"SELECT chunk_id, embedding FROM {DB}.silver_embeddings WHERE chunk_id IN ('{cid_in}')"
            emb_res = run_sql(emb_sql)
            emb_rows = emb_res.result.data_array if hasattr(emb_res, 'result') and emb_res.result and emb_res.result.data_array else (emb_res.collect() if hasattr(emb_res, 'collect') else [])

            parsed_embeddings = []
            for r in emb_rows:
                cid = str(r[0])
                raw_emb = r[1]
                try:
                    vec = [float(x) for x in (json.loads(raw_emb) if isinstance(raw_emb, str) else raw_emb)]
                    norm = math.sqrt(sum(x*x for x in vec))
                    if norm > 0:
                        parsed_embeddings.append((cid, vec, norm))
                except Exception:
                    pass

            for i in range(len(parsed_embeddings)):
                c1, v1, n1 = parsed_embeddings[i]
                for j in range(i + 1, len(parsed_embeddings)):
                    c2, v2, n2 = parsed_embeddings[j]
                    dot_prod = sum(x*y for x, y in zip(v1, v2))
                    cos_sim = dot_prod / (n1 * n2)
                    if cos_sim >= sim_threshold:
                        add_edge(
                            f"chunk_{c1}",
                            f"chunk_{c2}",
                            "similar_to",
                            f"Semantic ({round(cos_sim * 100, 1)}%)",
                            properties={"similarity": round(cos_sim, 4)}
                        )

        # 8. Add Citizen Query Nodes and RAG Retrieval Edges
        for q_id, q_text, q_time, retrieved_cids, retrieved_scores, q_ans in parsed_logs:
            q_node_id = f"query_{q_id}"
            add_node(
                n_id=q_node_id,
                label=f"Query: {q_text[:28]}...",
                n_type="user_query",
                group="query",
                properties={
                    "question_id": q_id,
                    "query_text": q_text,
                    "timestamp": q_time,
                    "llm_answer": q_ans,
                    "table": f"{DB}.user_queries",
                    "stage": "5. Citizen Query & Answer"
                }
            )

            if isinstance(retrieved_cids, list):
                for idx, c_id in enumerate(retrieved_cids[:3]):
                    tgt_chunk = f"chunk_{c_id}"
                    score = retrieved_scores[idx] if idx < len(retrieved_scores) else 0.85
                    add_edge(
                        tgt_chunk,
                        q_node_id,
                        "retrieved",
                        f"Retrieved (score: {round(float(score), 4)})",
                        properties={"score": round(float(score), 4)}
                    )

        graph_payload = {
            "success": True,
            "database": DB,
            "stats": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "raw_documents_count": len(raw_rows),
                "bronze_validated_count": len(val_rows),
                "bronze_quarantine_count": len(quar_rows),
                "silver_documents_count": len(doc_rows),
                "silver_chunks_sample_count": len(chunk_rows),
                "queries_count": len(logs_rows)
            },
            "nodes": nodes,
            "edges": edges,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        if not doc_filter:
            _KG_CACHE["data"] = graph_payload
            _KG_CACHE["timestamp"] = time.time()

        return jsonify(graph_payload)
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "nodes": [],
            "edges": [],
            "stats": {}
        }), 500

if __name__ == '__main__':
    port = int(os.getenv("PYTHON_BRIDGE_PORT", 5001))
    print(f"[*] Starting Python RAG AI Bridge on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)

