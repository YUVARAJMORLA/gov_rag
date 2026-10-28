"""
db_connector.py
---------------
Direct Databricks SDK Statement Execution integration matching reference implementation.
Uses WorkspaceClient statement execution without external SQL connectors.
Logs to:
1. {DB}.user_queries
2. {DB}.rag_observability (including injection_detected, pii_masked, masked_question)
3. {DB}.rag_retrieval_logs
4. {DB}.rag_feedback
"""

import os
import json
import uuid
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import ExecuteStatementRequestOnWaitTimeout

load_dotenv()

# Configuration
CATALOG = os.getenv("CATALOG", "rag_catalog").strip()
SCHEMA = os.getenv("SCHEMA", "rag_gov_schema").strip()
DB = f"{CATALOG}.{SCHEMA}"
WAREHOUSE_ID = os.getenv("WAREHOUSE_ID", "c6d8c59697d93fa3").strip()

__all__ = [
    "CATALOG",
    "SCHEMA",
    "DB",
    "WAREHOUSE_ID",
    "BATCH_ID",
    "run_sql",
    "log_user_query",
    "log_observability",
    "log_retrieval",
    "log_feedback",
    "test_databricks_platform",
    "test_databricks_tables",
    "test_vector_search_endpoint",
]

# Initialize Databricks WorkspaceClient
host = os.getenv("DATABRICKS_SERVER_HOSTNAME", "").strip()
token = os.getenv("DATABRICKS_TOKEN", "").strip()

if host and token:
    w = WorkspaceClient(host=f"https://{host}", token=token)
else:
    w = WorkspaceClient()


def run_sql(stmt: str):
    """Executes SQL statement using WorkspaceClient statement_execution."""
    try:
        # Notebook environment support
        return spark.sql(stmt)  # type: ignore
    except NameError:
        return w.statement_execution.execute_statement(
            statement=stmt,
            warehouse_id=WAREHOUSE_ID,
            wait_timeout="50s",
            on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CANCEL
        )


def _get_latest_batch_id() -> str:
    """Fetch the latest batch_id from gold_vector_embeddings at startup or use env var."""
    env_batch = os.getenv("BATCH_ID")
    if env_batch and env_batch.strip():
        return env_batch.strip()
    try:
        row = run_sql(f"""
        SELECT batch_id FROM {DB}.gold_vector_embeddings
        ORDER BY created_timestamp DESC LIMIT 1
        """)
        if hasattr(row, 'collect'):
            rows = row.collect()
        elif hasattr(row, 'result') and row.result and row.result.data_array:
            rows = row.result.data_array
        else:
            rows = []
        if rows:
            return str(rows[0][0])
    except Exception as e:
        print(f"[BATCH ID NOTICE] Could not fetch batch_id: {e}")
    return "batch_streamlit_rag_v1"


def _esc(s) -> str:
    """SQL single-quote escape helper."""
    return str(s).replace("'", "''") if s else ""


# Fetch dynamic current pipeline batch_id
BATCH_ID = _get_latest_batch_id()


# --- Exact Logging Functions as per Reference app.py ---

def log_user_query(qid: str, q: str, ans: str, bid: str = BATCH_ID):
    """Logs question and answer to {DB}.user_queries."""
    stmt = f"""INSERT INTO {DB}.user_queries (question_id, user_question, llm_answer, timestamp, batch_id)
    VALUES ('{qid}', '{_esc(q)}', '{_esc(ans)}', current_timestamp(), '{bid}')"""
    return run_sql(stmt)


def log_observability(
    oid: str,
    qid: str,
    lat: float,
    it: int,
    ot: int,
    ic: float,
    oc: float,
    able: bool,
    inj: bool = False,
    masked: bool = False,
    masked_q: str = ""
):
    """Logs metrics, security and masking telemetry to {DB}.rag_observability."""
    stmt = f"""INSERT INTO {DB}.rag_observability
    (observability_id, question_id, latency_ms, input_tokens, output_tokens, input_cost, output_cost, llm_able_to_answer, injection_detected, pii_masked, masked_question, timestamp)
    VALUES ('{oid}', '{qid}', {lat:.2f}, {it}, {ot}, {ic:.8f}, {oc:.8f}, {str(able).lower()}, {str(inj).lower()}, {str(masked).lower()}, '{_esc(masked_q)}', current_timestamp())"""
    return run_sql(stmt)


def log_retrieval(lid: str, qid: str, cids: List[str], scores: List[float], texts: List[str], n: int):
    """Logs chunk retrieval results to {DB}.rag_retrieval_logs."""
    stmt = f"""INSERT INTO {DB}.rag_retrieval_logs
    (log_id, question_id, retrieved_chunk_ids, retrieved_scores, retrieved_texts, num_retrieved, timestamp)
    VALUES ('{lid}', '{qid}', '{_esc(json.dumps(cids))}', '{_esc(json.dumps(scores))}',
            '{_esc(json.dumps([t[:500] for t in texts]))}', {n}, current_timestamp())"""
    return run_sql(stmt)


def log_feedback(fid: str, qid: str, fb: str, rating: int):
    """Logs user feedback rating to {DB}.rag_feedback."""
    stmt = f"""INSERT INTO {DB}.rag_feedback (feedback_id, question_id, user_feedback, rating, timestamp)
    VALUES ('{fid}', '{qid}', '{_esc(fb)}', {rating}, current_timestamp())"""
    return run_sql(stmt)


# --- Connection Testing & Telemetry Diagnostics ---

def test_databricks_platform() -> Dict[str, Any]:
    """Tests connection to Databricks WorkspaceClient and SQL Warehouse."""
    import time
    t0 = time.time()
    try:
        resp = run_sql("SELECT 1")
        lat = (time.time() - t0) * 1000
        success = False
        if hasattr(resp, 'result') and resp.result and resp.result.data_array:
            success = True
        elif hasattr(resp, 'collect'):
            success = True
        return {
            "status": "online" if success else "warning",
            "message": "Connected" if success else "No response payload",
            "latency_ms": round(lat, 1),
            "host": host,
            "warehouse_id": WAREHOUSE_ID
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "latency_ms": round((time.time() - t0) * 1000, 1),
            "host": host,
            "warehouse_id": WAREHOUSE_ID
        }


def test_databricks_tables() -> Dict[str, Dict[str, Any]]:
    """Checks the existence and accessibility of all target tables in {DB}."""
    target_tables = ["user_queries", "rag_observability", "rag_retrieval_logs", "rag_feedback"]
    results = {}
    import time

    # Try fast unified query first
    try:
        union_parts = [
            f"SELECT '{tbl}' AS table_name, count(1) AS row_cnt FROM {DB}.{tbl}"
            for tbl in target_tables
        ]
        union_sql = " UNION ALL ".join(union_parts)
        t0 = time.time()
        resp = run_sql(union_sql)
        lat = (time.time() - t0) * 1000
        rows = []
        if hasattr(resp, 'result') and resp.result and resp.result.data_array:
            rows = resp.result.data_array
        elif hasattr(resp, 'collect'):
            rows = resp.collect()

        row_map = {str(r[0]): int(r[1]) for r in rows if len(r) >= 2}
        for tbl in target_tables:
            if tbl in row_map:
                results[tbl] = {
                    "status": "ok",
                    "rows": row_map[tbl],
                    "message": f"{row_map[tbl]} rows",
                    "latency_ms": round(lat, 1)
                }
            else:
                results[tbl] = {"status": "missing", "rows": 0, "message": "Table missing"}
        return results
    except Exception as _e:
        pass

    # Fallback: check SHOW TABLES
    try:
        resp = run_sql(f"SHOW TABLES IN {DB}")
        existing = []
        if hasattr(resp, 'result') and resp.result and resp.result.data_array:
            existing = [str(r[1]).lower() for r in resp.result.data_array if len(r) > 1]
        elif hasattr(resp, 'collect'):
            existing = [str(r[1]).lower() for r in resp.collect() if len(r) > 1]

        for tbl in target_tables:
            if tbl.lower() in existing:
                results[tbl] = {"status": "ok", "rows": "Active", "message": "Table verified"}
            else:
                results[tbl] = {"status": "missing", "rows": 0, "message": "Not found"}
    except Exception as ex:
        for tbl in target_tables:
            results[tbl] = {"status": "error", "rows": 0, "message": str(ex)[:50]}

    return results


def test_vector_search_endpoint() -> Dict[str, Any]:
    """Checks the status of Databricks Vector Search endpoint and index."""
    import time
    t0 = time.time()
    endpoint_name = os.getenv("DATABRICKS_VECTOR_SEARCH_ENDPOINT", "rag-gov-endpoint").strip()
    index_name = os.getenv("DATABRICKS_INDEX_NAME", f"{DB}.gold_vector_index").strip()
    try:
        ep = w.vector_search_endpoints.get_endpoint(endpoint_name)
        state = "ONLINE"
        if hasattr(ep, "endpoint_status") and ep.endpoint_status and hasattr(ep.endpoint_status, "state"):
            raw_st = ep.endpoint_status.state
            state = str(raw_st.value if hasattr(raw_st, "value") else raw_st)
        return {
            "status": "ok" if "ONLINE" in state.upper() else "warning",
            "endpoint": endpoint_name,
            "index": index_name,
            "state": state.replace("EndpointStatusState.", ""),
            "latency_ms": round((time.time() - t0) * 1000, 1)
        }
    except Exception as e:
        return {
            "status": "error",
            "endpoint": endpoint_name,
            "index": index_name,
            "state": str(e)[:50],
            "latency_ms": round((time.time() - t0) * 1000, 1)
        }

