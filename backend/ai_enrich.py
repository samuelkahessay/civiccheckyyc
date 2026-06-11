"""
One‑Time AI Enrichment Pack (async, cached, idempotent)

Produces durable, cited content from existing Supabase votes:
- Ballot‑Ready Briefs (per candidate)
- Topic Stance Cards (per candidate × topic)
- High‑Impact Motion Explainers (top N)
- Pairwise Comparison Briefs (selected pairs)
- Citizen Q&A Pack (curated)
- Consistency + simple stance vectors (algorithmic)

Design goals
- Async concurrency with semaphore + retry backoff
- Cache per-entity results (JSONL) keyed by citations+prompt version
- Resume via checkpoint file; upsert-by-key to avoid duplicates
- Use gpt-5-mini with gpt-5-nano fallback
- Write results to data/enrichment/*.json; optionally upsert JSONB if columns exist

Run
  python backend/ai_enrich.py --scope all --limit_motions 75 --pairs 12
  python backend/ai_enrich.py --scope briefs,stances --resume
  python backend/ai_enrich.py --scope explainers --rebuild  # ignore cache
  python backend/ai_enrich.py --test --verbose --scope briefs,stances  # fast, very chatty

Notes
- If JSONB columns are not present yet, script still writes files.
- JSON only; every object includes citations referencing votes.id and source URLs.
"""

from __future__ import annotations

import os
import json
import math
import itertools
import asyncio
import hashlib
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Set

from dotenv import load_dotenv
from openai import (
    AsyncOpenAI,
    RateLimitError,
    APIError,
    APIConnectionError,
    APITimeoutError,
)
from supabase import create_client, Client

from config import (
    VALID_TOPICS,
    VOTE_IMPACT_LEVELS,
    PROMPT_VERSION,
    AI_MAX_TOKENS,
    AI_TEMPERATURE,
    AI_TIMEOUT,
    LOG_LEVEL,
    CONCURRENT_REQUESTS,
    ASYNC_BATCH_CHECKPOINT_SIZE,
    get_model_version,
)
from utils import (
    async_retry_with_backoff,
    CheckpointManager,
    setup_logging,
    format_duration,
    print_summary_box,
)
from ai_processor import PRIMARY_MODEL, FALLBACK_MODEL


# --------------------------------------------------------------------------------------
# Paths and setup
# --------------------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
ENRICH_DIR = DATA_DIR / "enrichment"
ENRICH_DIR.mkdir(parents=True, exist_ok=True)

CACHE_FILE = DATA_DIR / "ai_enrich_cache.jsonl"
CHECKPOINT_FILE = DATA_DIR / "ai_enrich_checkpoint.json"
REPORT_FILE = DATA_DIR / "ai_enrich_report.jsonl"

BRIEFS_JSON = ENRICH_DIR / "candidate_ballot_briefs.json"
STANCES_JSON = ENRICH_DIR / "candidate_topic_stances.json"
EXPLAINERS_JSON = ENRICH_DIR / "motion_explainers.json"
PAIRWISE_JSON = ENRICH_DIR / "pairwise_briefs.json"
QA_JSON = ENRICH_DIR / "qa_bank.json"
VECTORS_JSON = ENRICH_DIR / "position_vectors.json"

load_dotenv()
logger = setup_logging(DATA_DIR / "ai_enrich.log", LOG_LEVEL)

# OpenAI
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    logger.warning("Supabase credentials not found; will run in file-only mode")


# --------------------------------------------------------------------------------------
# Utility and cache helpers
# --------------------------------------------------------------------------------------
def _sha256_dict(d: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(d, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _cache_key(kind: str, entity_id: str, citations_fingerprint: str) -> str:
    base = f"{kind}|{entity_id}|{PROMPT_VERSION}|{citations_fingerprint}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _load_cache(path: Path) -> Dict[str, Dict[str, Any]]:
    m: Dict[str, Dict[str, Any]] = {}
    if not path.exists():
        return m
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                k = obj.get("key")
                if k:
                    m[k] = obj
            except Exception:
                continue
    return m


def _append_cache(path: Path, key: str, payload: Dict[str, Any]) -> None:
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"key": key, **payload}, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.debug(f"Cache append failed: {e}")


def _append_report(path: Path, payload: Dict[str, Any]) -> None:
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass


# --------------------------------------------------------------------------------------
# Insufficient-evidence fallbacks (no LLM)
# --------------------------------------------------------------------------------------
def _insufficient_brief(candidate: Candidate) -> Dict[str, Any]:
    return {
        "brief": "Insufficient evidence from available city voting records to summarize this candidate without speculation.",
        "strengths": [],
        "tradeoffs": [],
        "top_votes": [],
        "citations": [],
        "insufficient_evidence": True,
        "candidate": candidate.slug,
    }


def _insufficient_stance(candidate: Candidate, topic: str) -> Dict[str, Any]:
    return {
        "topic": topic,
        "stance": "Insufficient evidence from available votes to characterize a stance without speculation.",
        "evidence_votes": [],
        "confidence": 0.0,
        "coverage": 0.0,
        "citations": [],
        "insufficient_evidence": True,
        "candidate": candidate.slug,
    }


def _insufficient_pair(a: Candidate, b: Candidate) -> Dict[str, Any]:
    return {
        "agree": [],
        "disagree": [],
        "notable_agreement": "Insufficient overlapping evidence in city votes to compare.",
        "meaningful_contrast": "Insufficient overlapping evidence in city votes to compare.",
        "citations": [],
        "insufficient_evidence": True,
        "candidate_a": a.slug,
        "candidate_b": b.slug,
    }


def _insufficient_qa(question: str) -> Dict[str, Any]:
    return {
        "answer": "Insufficient evidence from available votes to answer without speculation.",
        "citations": [],
        "insufficient_evidence": True,
        "question": question,
    }


# --------------------------------------------------------------------------------------
# Data access and shaping
# --------------------------------------------------------------------------------------
@dataclass
class VoteRec:
    id: str
    candidate_id: str
    candidate_slug: str
    meeting_date: Optional[str]
    topic: Optional[str]
    impact: Optional[str]
    vote: str
    motion_title: str
    motion_summary: Optional[str]
    report_numbers: List[str]
    source_api_url: Optional[str]
    source_row_id: Optional[str]


@dataclass
class Candidate:
    id: str
    name: str
    slug: str


async def load_data() -> Tuple[List[Candidate], List[VoteRec]]:
    if not supabase:
        raise RuntimeError("Supabase not configured; set SUPABASE_PROJECT_URL and key in .env")

    # Candidates
    cres = supabase.table("candidates").select("id,name,slug").execute()
    candidates: List[Candidate] = [Candidate(**row) for row in cres.data]

    # Votes (only necessary fields)
    vres = supabase.table("votes").select(
        "id,candidate_id,meeting_date,topic,impact,vote,motion_title,motion_summary,report_numbers,source_api_url,source_row_id"
    ).execute()
    votes: List[VoteRec] = []

    # Map candidate_id→slug for denormalization
    cid_to_slug = {c.id: c.slug for c in candidates}
    for row in vres.data:
        votes.append(
            VoteRec(
                id=row["id"],
                candidate_id=row["candidate_id"],
                candidate_slug=cid_to_slug.get(row["candidate_id"], "unknown"),
                meeting_date=row.get("meeting_date"),
                topic=row.get("topic"),
                impact=row.get("impact"),
                vote=row.get("vote", "absent"),
                motion_title=row.get("motion_title") or "",
                motion_summary=row.get("motion_summary"),
                report_numbers=row.get("report_numbers") or [],
                source_api_url=row.get("source_api_url"),
                source_row_id=row.get("source_row_id"),
            )
        )

    return candidates, votes


# --------------------------------------------------------------------------------------
# Evidence selection and stance scoring (algorithmic, no LLM)
# --------------------------------------------------------------------------------------
IMPACT_WEIGHT = {"high": 3, "medium": 2, "low": 1}


def pick_evidence_votes(votes: List[VoteRec], k: int = 5) -> List[VoteRec]:
    usable = [v for v in votes if v.vote in ("for", "against")]
    usable.sort(
        key=lambda v: (
            IMPACT_WEIGHT.get((v.impact or "low"), 1),
            v.meeting_date or "",
        ),
        reverse=True,
    )
    # Encourage topic diversity
    picked: List[VoteRec] = []
    seen_topics: Set[str] = set()
    for v in usable:
        t = v.topic or "Other"
        if t not in seen_topics or len(picked) < k // 2:
            picked.append(v)
            seen_topics.add(t)
        if len(picked) >= k:
            break
    if len(picked) < k:
        picked = usable[:k]
    return picked


def fallback_candidate_evidence(votes: List[VoteRec], min_k: int = 3, max_k: int = 5) -> List[VoteRec]:
    """Broader fallback to ensure we return at least min_k items when possible.

    Strategy: take for/against; if < min_k, include remaining most recent regardless of impact; cap at max_k.
    """
    if not votes:
        return []
    primary = [v for v in votes if v.vote in ("for", "against")]
    primary.sort(key=lambda v: (v.meeting_date or ""), reverse=True)
    if len(primary) >= min_k:
        return primary[:max_k]
    # Relax: include any votes (still prefer non-absent first)
    any_votes = sorted(votes, key=lambda v: (v.meeting_date or ""), reverse=True)
    # Keep non-absent first
    any_votes.sort(key=lambda v: 0 if v.vote in ("for", "against") else 1)
    return any_votes[:max_k]


def stance_score(votes: List[VoteRec]) -> float:
    # Weighted sum(+/-), normalized to [-1, 1]
    if not votes:
        return 0.0
    s = 0.0
    w = 0.0
    for v in votes:
        sign = 1 if v.vote == "for" else (-1 if v.vote == "against" else 0)
        weight = float(IMPACT_WEIGHT.get(v.impact or "low", 1))
        s += sign * weight
        w += weight
    return s / w if w > 0 else 0.0


def build_topic_vectors(votes_by_cand_topic: Dict[str, Dict[str, List[VoteRec]]]) -> Dict[str, Dict[str, float]]:
    scores: Dict[str, Dict[str, float]] = {}
    for cid, by_topic in votes_by_cand_topic.items():
        scores[cid] = {}
        for t, arr in by_topic.items():
            scores[cid][t] = stance_score(arr)
    return scores


def consistency_metric(topic_scores: Dict[str, float]) -> float:
    # Variance of stance scores across topics; lower variance → more consistent
    if not topic_scores:
        return 0.0
    vals = list(topic_scores.values())
    mean = sum(vals) / len(vals)
    var = sum((x - mean) ** 2 for x in vals) / len(vals)
    return round(var, 4)


# --------------------------------------------------------------------------------------
# OpenAI helpers
# --------------------------------------------------------------------------------------
def _citations_from_votes(vs: List[VoteRec]) -> List[Dict[str, Any]]:
    cites: List[Dict[str, Any]] = []
    for v in vs:
        cites.append(
            {
                "vote_id": v.id,
                "source_api_url": v.source_api_url,
                "source_row_id": v.source_row_id,
                "report_numbers": v.report_numbers,
            }
        )
    return cites


def _citations_fingerprint(vs: List[VoteRec]) -> str:
    ids = sorted([v.id for v in vs])
    return hashlib.sha256(("|".join(ids) + "|" + PROMPT_VERSION).encode("utf-8")).hexdigest()


def _validate_required(obj: Dict[str, Any], fields: List[str]) -> None:
    missing = [k for k in fields if k not in obj]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")


@async_retry_with_backoff(
    exceptions=(RateLimitError, APIError, APIConnectionError, APITimeoutError),
)
async def _ask_json(prompt: str, model: str) -> Tuple[Dict[str, Any], Optional[int]]:
    # Extra diagnostics
    logger.debug(f"_ask_json model={model} prompt_chars={len(prompt)}")
    resp = await async_client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You write factual, citation-anchored summaries. Only use provided citations. Return valid JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=AI_TEMPERATURE,
        max_completion_tokens=AI_MAX_TOKENS,
        timeout=AI_TIMEOUT,
    )
    choice = resp.choices[0]
    text = (choice.message.content or "").strip()
    if not text:
        # One more attempt with stricter reminder
        logger.warning("Empty content from AI; retrying once with strict JSON reminder")
        resp2 = await async_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Return ONLY valid JSON (no backticks, no prose)."},
                {"role": "user", "content": prompt + "\n\nReturn ONLY valid minified JSON."},
            ],
            response_format={"type": "json_object"},
            temperature=AI_TEMPERATURE,
            max_completion_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT,
        )
        choice = resp2.choices[0]
        text = (choice.message.content or "").strip()
    if text.startswith("```json"):
        text = text.replace("```json", "").replace("```", "").strip()
    elif text.startswith("```"):
        text = text.replace("```", "").strip()
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed; attempting bracket extraction: {e}")
        # Try to extract first {...} block
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            snippet = text[start : end + 1]
            obj = json.loads(snippet)
        else:
            raise
    tokens = resp.usage.completion_tokens if getattr(resp, "usage", None) else None
    return obj, tokens


async def _ask_with_fallback(prompt: str) -> Tuple[Dict[str, Any], str, Optional[int]]:
    try:
        obj, tokens = await _ask_json(prompt, PRIMARY_MODEL)
        return obj, PRIMARY_MODEL, tokens
    except Exception as e:
        logger.warning(f"Primary failed, falling back to {FALLBACK_MODEL}: {e}")
        obj, tokens = await _ask_json(prompt, FALLBACK_MODEL)
        return obj, FALLBACK_MODEL, tokens


# --------------------------------------------------------------------------------------
# Prompt builders (compact; JSON-only outputs)
# --------------------------------------------------------------------------------------
def prompt_ballot_brief(candidate: Candidate, evidence: List[VoteRec]) -> str:
    citations = _citations_from_votes(evidence)
    return (
        "Create a Ballot-Ready Brief about the candidate using only these votes."
        " Return JSON with keys: brief (120-180 words), strengths (2), tradeoffs (2),"
        " top_votes (array of {title, why_it_matters, citations}), citations (array)."
        " Rules: Use only citations; no speculation; if uncertain say 'insufficient evidence'.\n\n"
        f"Candidate: {candidate.name} ({candidate.slug})\n"
        f"Votes JSON: {json.dumps([v.__dict__ for v in evidence], ensure_ascii=False)}\n"
        f"Citations: {json.dumps(citations, ensure_ascii=False)}"
    )


def prompt_topic_stance(candidate: Candidate, topic: str, evidence: List[VoteRec], confidence: float, coverage: float) -> str:
    citations = _citations_from_votes(evidence)
    return (
        "Write a Topic Stance Card. JSON keys: topic, stance (1-2 sentences),"
        " evidence_votes (array of {title, rationale, citations}), confidence (0-1), coverage (0-1), citations."
        " Rules: only use citations; no speculation; may return insufficient evidence.\n\n"
        f"Candidate: {candidate.name} ({candidate.slug})\nTopic: {topic}\n"
        f"Votes JSON: {json.dumps([v.__dict__ for v in evidence], ensure_ascii=False)}\n"
        f"Confidence: {confidence:.2f}, Coverage: {coverage:.2f}\n"
        f"Citations: {json.dumps(citations, ensure_ascii=False)}"
    )


def prompt_motion_explainer(motion_key: str, votes: List[VoteRec]) -> str:
    citations = _citations_from_votes(votes)
    return (
        "Write a High-Impact Motion Explainer (JSON). Keys: eli5, why_it_matters, key_impacts (2-3 bullets), citations."
        " No speculation; only citations.\n\n"
        f"Motion: {motion_key}\n"
        f"Votes JSON: {json.dumps([v.__dict__ for v in votes], ensure_ascii=False)}\n"
        f"Citations: {json.dumps(citations, ensure_ascii=False)}"
    )


def prompt_pairwise(candidate_a: Candidate, candidate_b: Candidate, topics: List[str], votes_a: List[VoteRec], votes_b: List[VoteRec]) -> str:
    citations = _citations_from_votes(votes_a[:5] + votes_b[:5])
    return (
        "Write a Pairwise Comparison Brief (JSON). Keys: agree (2-3 bullets), disagree (2-3 bullets),"
        " notable_agreement, meaningful_contrast, citations. Every bullet must cite vote IDs."
        " No speculation.\n\n"
        f"Candidates: {candidate_a.name} vs {candidate_b.name}\nTopics: {topics}\n"
        f"Votes A JSON: {json.dumps([v.__dict__ for v in votes_a], ensure_ascii=False)}\n"
        f"Votes B JSON: {json.dumps([v.__dict__ for v in votes_b], ensure_ascii=False)}\n"
        f"Citations: {json.dumps(citations, ensure_ascii=False)}"
    )


def prompt_qa(question: str, evidence: List[VoteRec]) -> str:
    citations = _citations_from_votes(evidence)
    return (
        "Answer the citizen question using only the provided votes. JSON keys: answer (2-4 sentences),"
        " citations (array of vote IDs and URLs). No speculation; reply 'insufficient evidence' if needed.\n\n"
        f"Question: {question}\n"
        f"Votes JSON: {json.dumps([v.__dict__ for v in evidence], ensure_ascii=False)}\n"
        f"Citations: {json.dumps(citations, ensure_ascii=False)}"
    )


# --------------------------------------------------------------------------------------
# Output guardrails (citations/top_votes backfill; insufficient downgrades)
# --------------------------------------------------------------------------------------
def ensure_brief_has_citations_and_votes(data: Dict[str, Any], evidence: List[VoteRec]) -> Dict[str, Any]:
    cites = data.get("citations") or []
    if not cites and evidence:
        data["citations"] = _citations_from_votes(evidence)
    # Ensure top_votes (3-5)
    tv = data.get("top_votes")
    if (not isinstance(tv, list) or len(tv) == 0) and evidence:
        filled = []
        for v in evidence[:5]:
            filled.append({
                "title": v.motion_title,
                "why_it_matters": "",
                "citations": [{"vote_id": v.id, "source_api_url": v.source_api_url}],
            })
        data["top_votes"] = filled[: max(3, min(5, len(filled)))]
    return data


def ensure_stance_has_citations_or_downgrade(card: Dict[str, Any], candidate: Candidate, topic: str, evidence: List[VoteRec]) -> Dict[str, Any]:
    cites = card.get("citations") or []
    if cites:
        return card
    if evidence:
        # Backfill minimal evidence_votes and citations
        ev = []
        for v in evidence[:3]:
            ev.append({
                "title": v.motion_title,
                "rationale": "",
                "citations": [{"vote_id": v.id, "source_api_url": v.source_api_url}],
            })
        card["evidence_votes"] = ev
        card["citations"] = _citations_from_votes(evidence)
        return card
    # Downgrade
    return _insufficient_stance(candidate, topic)


def ensure_pair_has_citations_or_downgrade(data: Dict[str, Any], ca: Candidate, cb: Candidate, arr_a: List[VoteRec], arr_b: List[VoteRec]) -> Dict[str, Any]:
    cites = data.get("citations") or []
    if cites:
        return data
    # Looser: if we have any evidence on either side, backfill citations rather than downgrade
    ev = (arr_a or []) + (arr_b or [])
    if ev:
        data["citations"] = _citations_from_votes(ev[:6])
        # Ensure required keys exist even if empty
        data.setdefault("agree", [])
        data.setdefault("disagree", [])
        data.setdefault("notable_agreement", "")
        data.setdefault("meaningful_contrast", "")
        return data
    return _insufficient_pair(ca, cb)


# --------------------------------------------------------------------------------------
# Enrichment tasks (async)
# --------------------------------------------------------------------------------------
async def enrich_ballot_briefs(
    candidates: List[Candidate],
    votes_by_candidate: Dict[str, List[VoteRec]],
    cache_map: Dict[str, Dict[str, Any]],
    semaphore: asyncio.Semaphore,
    rebuild: bool,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    async def one(c: Candidate):
        evid = pick_evidence_votes(votes_by_candidate.get(c.id, []), k=5)
        if len(evid) == 0:
            # Fallback evidence selection to avoid empty prompts
            evid = fallback_candidate_evidence(votes_by_candidate.get(c.id, []), min_k=3, max_k=5)
        fp = _citations_fingerprint(evid)
        key = _cache_key("brief", c.id, fp)
        if key in cache_map and not rebuild:
            payload = cache_map[key]
            try:
                data_cached = payload.get("data", {})
                _validate_required(data_cached, ["brief", "strengths", "tradeoffs", "top_votes", "citations"])
                # Treat empty citations as stale; recompute to backfill
                if not (isinstance(data_cached.get("citations"), list) and len(data_cached["citations"])>0):
                    raise ValueError("cached brief has empty citations")
                results[c.slug] = data_cached
                logger.info(f"[BRIEF][cache] {c.slug} evid={len(evid)}")
                return
            except Exception:
                logger.info(f"[BRIEF][cache-stale] {c.slug} -> recompute")

        if len(evid) == 0:
            logger.info(f"[BRIEF][insufficient] {c.slug} (no evidence votes)")
            data = _insufficient_brief(c)
            model_used = "none"
            tokens = 0
        else:
            prompt = prompt_ballot_brief(c, evid)
            logger.info(f"[BRIEF][ask] {c.slug} evid={len(evid)} prompt_chars={len(prompt)}")
            async with semaphore:
                try:
                    data, model_used, tokens = await _ask_with_fallback(prompt)
                except Exception as e:
                    logger.error(f"[BRIEF] AI failed for {c.slug}, falling back to insufficient: {e}")
                    data = _insufficient_brief(c)
                    model_used = "none"
                    tokens = 0
            # Backfill citations/top_votes if missing; then validate keys exist
            data = ensure_brief_has_citations_and_votes(data, evid)
            _validate_required(data, ["brief", "strengths", "tradeoffs", "top_votes", "citations"])

        enriched = {
            "candidate_slug": c.slug,
            "prompt_version": PROMPT_VERSION,
            "model_version": get_model_version(model_used),
            "ai_model_used": model_used,
            "ai_response_tokens": tokens,
            "data": data,
        }
        results[c.slug] = data
        _append_cache(CACHE_FILE, key, enriched)
        _append_report(REPORT_FILE, {"type": "brief", "candidate": c.slug, "key": key, "ts": datetime.now().isoformat()})

    gathered = await asyncio.gather(*[one(c) for c in candidates], return_exceptions=True)
    for g in gathered:
        if isinstance(g, Exception):
            logger.error(f"[BRIEF] task error: {g}")
    with open(BRIEFS_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return results


async def enrich_topic_stances(
    candidates: List[Candidate],
    votes_by_candidate_topic: Dict[str, Dict[str, List[VoteRec]]],
    cache_map: Dict[str, Dict[str, Any]],
    semaphore: asyncio.Semaphore,
    rebuild: bool,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    async def one(c: Candidate, topic: str, arr: List[VoteRec]):
        if topic == "Other":
            return
        evid = pick_evidence_votes(arr, k=3)
        if len(evid) < 2 and arr:
            # Loosen for stances too to avoid empty prompts
            evid = fallback_candidate_evidence(arr, min_k=2, max_k=3)
        confidence = min(1.0, len(arr) / 10.0)
        coverage = min(1.0, len(set(v.id for v in arr)) / 20.0)
        fp = _citations_fingerprint(evid)
        key = _cache_key("stance", f"{c.id}:{topic}", fp)
        if key in cache_map and not rebuild:
            payload = cache_map[key]
            try:
                data_cached = payload.get("data", {})
                _validate_required(data_cached, ["topic", "stance", "evidence_votes", "confidence", "coverage", "citations"])
                if not (isinstance(data_cached.get("citations"), list) and len(data_cached["citations"])>0):
                    raise ValueError("cached stance has empty citations")
                results.setdefault(c.slug, {})[topic] = data_cached
                logger.info(f"[STANCE][cache] {c.slug}:{topic} evid={len(evid)}")
                return
            except Exception:
                logger.info(f"[STANCE][cache-stale] {c.slug}:{topic} -> recompute")

        if len(evid) == 0:
            logger.info(f"[STANCE][insufficient] {c.slug}:{topic} (no evidence votes)")
            data = _insufficient_stance(c, topic)
            model_used = "none"
            tokens = 0
        else:
            prompt = prompt_topic_stance(c, topic, evid, confidence, coverage)
            logger.info(f"[STANCE][ask] {c.slug}:{topic} evid={len(evid)} prompt_chars={len(prompt)}")
            async with semaphore:
                try:
                    data, model_used, tokens = await _ask_with_fallback(prompt)
                except Exception as e:
                    logger.error(f"[STANCE] AI failed for {c.slug}:{topic}, insufficient: {e}")
                    data = _insufficient_stance(c, topic)
                    model_used = "none"
                    tokens = 0
            data = ensure_stance_has_citations_or_downgrade(data, c, topic, evid)
            _validate_required(data, ["topic", "stance", "evidence_votes", "confidence", "coverage", "citations"])
        enriched = {
            "candidate_slug": c.slug,
            "topic": topic,
            "prompt_version": PROMPT_VERSION,
            "model_version": get_model_version(model_used),
            "ai_model_used": model_used,
            "ai_response_tokens": tokens,
            "data": data,
        }
        results.setdefault(c.slug, {})[topic] = data
        _append_cache(CACHE_FILE, key, enriched)
        _append_report(REPORT_FILE, {"type": "stance", "candidate": c.slug, "topic": topic, "key": key, "ts": datetime.now().isoformat()})

    tasks = []
    for c in candidates:
        for topic, arr in votes_by_candidate_topic.get(c.id, {}).items():
            if not arr:
                continue
            tasks.append(one(c, topic, arr))
    if tasks:
        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        for g in gathered:
            if isinstance(g, Exception):
                logger.error(f"[STANCE] task error: {g}")

    with open(STANCES_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return results


async def enrich_motion_explainers(
    motions: Dict[str, List[VoteRec]],
    cache_map: Dict[str, Dict[str, Any]],
    semaphore: asyncio.Semaphore,
    limit: int,
    rebuild: bool,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    # Select top motions by (count of high-impact votes, then recency)
    keys = list(motions.keys())
    def motion_score(k: str) -> Tuple[int, str]:
        arr = motions[k]
        high = sum(1 for v in arr if v.impact == "high")
        recent = max(v.meeting_date or "" for v in arr)
        return (high, recent)
    keys.sort(key=motion_score, reverse=True)
    keys = keys[:limit]

    async def one(key: str):
        arr = motions[key]
        evid = pick_evidence_votes(arr, k=3)
        fp = _citations_fingerprint(evid)
        ckey = _cache_key("explainer", key, fp)
        if ckey in cache_map and not rebuild:
            try:
                data_cached = cache_map[ckey].get("data", {})
                _validate_required(data_cached, ["eli5", "why_it_matters", "key_impacts", "citations"])
                if not (isinstance(data_cached.get("citations"), list) and len(data_cached["citations"])>0):
                    raise ValueError("cached explainer has empty citations")
                results[key] = data_cached
                logger.info(f"[EXPLAINER][cache] {key} evid={len(evid)}")
                return
            except Exception:
                logger.info(f"[EXPLAINER][cache-stale] {key} -> recompute")
        prompt = prompt_motion_explainer(key, evid)
        logger.info(f"[EXPLAINER][ask] {key} evid={len(evid)} prompt_chars={len(prompt)}")
        async with semaphore:
            data, model_used, tokens = await _ask_with_fallback(prompt)
        _validate_required(data, ["eli5", "why_it_matters", "key_impacts", "citations"])
        enriched = {
            "motion_key": key,
            "prompt_version": PROMPT_VERSION,
            "model_version": get_model_version(model_used),
            "ai_model_used": model_used,
            "ai_response_tokens": tokens,
            "data": data,
        }
        results[key] = data
        _append_cache(CACHE_FILE, ckey, enriched)
        _append_report(REPORT_FILE, {"type": "explainer", "motion": key, "key": ckey, "ts": datetime.now().isoformat()})

    gathered = await asyncio.gather(*[one(k) for k in keys], return_exceptions=True)
    for g in gathered:
        if isinstance(g, Exception):
            logger.error(f"[EXPLAINER] task error: {g}")
    with open(EXPLAINERS_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return results


async def enrich_pairwise(
    candidates: List[Candidate],
    votes_by_candidate_topic: Dict[str, Dict[str, List[VoteRec]]],
    cache_map: Dict[str, Dict[str, Any]],
    semaphore: asyncio.Semaphore,
    pairs_limit: int,
    rebuild: bool,
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []

    # Build stance vectors to select dissimilar pairs
    topic_scores = build_topic_vectors(votes_by_candidate_topic)

    def distance(a: str, b: str) -> float:
        ta = topic_scores.get(a, {})
        tb = topic_scores.get(b, {})
        topics = set(ta) | set(tb)
        if not topics:
            return 0.0
        # Euclidean distance
        return math.sqrt(sum((ta.get(t, 0.0) - tb.get(t, 0.0)) ** 2 for t in topics))

    pairs = []
    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            ca, cb = candidates[i], candidates[j]
            pairs.append(((ca, cb), distance(ca.id, cb.id)))
    pairs.sort(key=lambda x: x[1], reverse=True)
    pairs = pairs[:pairs_limit]

    def evidence_stats(cid: str) -> Tuple[int, int]:
        by_t = votes_by_candidate_topic.get(cid, {})
        total = sum(1 for arr in by_t.values() for v in arr if v.vote in ("for","against"))
        topics = sum(1 for t,arr in by_t.items() if any(v.vote in ("for","against") for v in arr))
        return total, topics

    async def one(ca: Candidate, cb: Candidate):
        topics = list(set(list(votes_by_candidate_topic.get(ca.id, {}).keys()) + list(votes_by_candidate_topic.get(cb.id, {}).keys())))
        # Build evidence: top 5 each, emphasize topics with largest differences
        arr_a = []
        arr_b = []
        diffs = []
        for t in topics:
            sa = topic_scores.get(ca.id, {}).get(t, 0.0)
            sb = topic_scores.get(cb.id, {}).get(t, 0.0)
            diffs.append((abs(sa - sb), t))
        diffs.sort(reverse=True)
        top_topics = [t for _, t in diffs[:5]]
        for t in top_topics:
            arr_a.extend(votes_by_candidate_topic.get(ca.id, {}).get(t, [])[:3])
            arr_b.extend(votes_by_candidate_topic.get(cb.id, {}).get(t, [])[:3])
        arr_a = pick_evidence_votes(arr_a, k=5)
        arr_b = pick_evidence_votes(arr_b, k=5)
        fp = _citations_fingerprint(arr_a + arr_b)
        key = _cache_key("pair", f"{ca.id}:{cb.id}", fp)
        if key in cache_map and not rebuild:
            payload = cache_map[key]
            try:
                data_cached = payload.get("data", {})
                _validate_required(data_cached, ["agree", "disagree", "notable_agreement", "meaningful_contrast", "citations"])
                if not (isinstance(data_cached.get("citations"), list) and len(data_cached["citations"])>0):
                    raise ValueError("cached pair has empty citations")
                results.append(data_cached)
                logger.info(f"[PAIR][cache] {ca.slug} vs {cb.slug} topics={len(top_topics)}")
                return
            except Exception:
                logger.info(f"[PAIR][cache-stale] {ca.slug} vs {cb.slug} -> recompute")
        # Looser gating: only require some evidence on at least one side
        ta, ta_topics = evidence_stats(ca.id)
        tb, tb_topics = evidence_stats(cb.id)
        if len(arr_a) == 0 and len(arr_b) == 0:
            logger.info(f"[PAIR][insufficient] {ca.slug} vs {cb.slug} (no evidence)")
            data = _insufficient_pair(ca, cb)
            results.append({
                "candidate_a": ca.slug,
                "candidate_b": cb.slug,
                "prompt_version": PROMPT_VERSION,
                "model_version": "none",
                "ai_model_used": "none",
                "ai_response_tokens": 0,
                "data": data,
            })
            return
        prompt = prompt_pairwise(ca, cb, top_topics, arr_a, arr_b)
        logger.info(f"[PAIR][ask] {ca.slug} vs {cb.slug} topics={len(top_topics)} prompt_chars={len(prompt)}")
        async with semaphore:
            try:
                data, model_used, tokens = await _ask_with_fallback(prompt)
            except Exception as e:
                logger.error(f"[PAIR] AI failed for {ca.slug} vs {cb.slug}, insufficient: {e}")
                data = _insufficient_pair(ca, cb)
                model_used = "none"
                tokens = 0
        data = ensure_pair_has_citations_or_downgrade(data, ca, cb, arr_a, arr_b)
        _validate_required(data, ["agree", "disagree", "notable_agreement", "meaningful_contrast", "citations"])
        enriched = {
            "candidate_a": ca.slug,
            "candidate_b": cb.slug,
            "prompt_version": PROMPT_VERSION,
            "model_version": get_model_version(model_used),
            "ai_model_used": model_used,
            "ai_response_tokens": tokens,
            "data": data,
        }
        results.append(enriched)
        _append_cache(CACHE_FILE, key, enriched)
        _append_report(REPORT_FILE, {"type": "pair", "a": ca.slug, "b": cb.slug, "key": key, "ts": datetime.now().isoformat()})

    gathered = await asyncio.gather(*[one(ca, cb) for (ca, cb), _ in pairs], return_exceptions=True)
    for g in gathered:
        if isinstance(g, Exception):
            logger.error(f"[PAIR] task error: {g}")
    with open(PAIRWISE_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return results


async def enrich_qa(
    questions: List[str],
    votes_all: List[VoteRec],
    cache_map: Dict[str, Dict[str, Any]],
    semaphore: asyncio.Semaphore,
    rebuild: bool,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    # Simple retrieval: pick top evidence by matching topics keywords
    topic_keywords = {
        "Housing": ["Housing"],
        "Transit": ["Transit", "transport"],
        "Budget": ["Budget", "tax"],
        "PublicSafety": ["Police", "Fire", "Safety"],
        "Environment": ["climate", "environment", "emissions"],
    }

    def evidence_for_question(q: str) -> List[VoteRec]:
        hits = []
        ql = q.lower()
        for v in votes_all:
            if v.topic and any(kw.lower() in v.topic.lower() or kw.lower() in (v.motion_title or "").lower() for kws in topic_keywords.values() for kw in kws):
                hits.append(v)
        hits.sort(key=lambda v: (IMPACT_WEIGHT.get(v.impact or "low", 1), v.meeting_date or ""), reverse=True)
        return hits[:6]

    async def one(q: str):
        evid = evidence_for_question(q)
        fp = _citations_fingerprint(evid)
        key = _cache_key("qa", q, fp)
        if key in cache_map and not rebuild:
            try:
                data_cached = cache_map[key].get("data", {})
                _validate_required(data_cached, ["answer", "citations"])
                if not (isinstance(data_cached.get("citations"), list) and len(data_cached["citations"])>0):
                    raise ValueError("cached qa has empty citations")
                results[q] = data_cached
                logger.info(f"[QA][cache] q='{q}' evid={len(evid)}")
                return
            except Exception:
                logger.info(f"[QA][cache-stale] q='{q}' -> recompute")
        if len(evid) == 0:
            logger.info(f"[QA][insufficient] q='{q}' (no evidence)")
            data = _insufficient_qa(q)
            model_used = "none"
            tokens = 0
            enriched = {
                "question": q,
                "prompt_version": PROMPT_VERSION,
                "model_version": "none",
                "ai_model_used": model_used,
                "ai_response_tokens": tokens,
                "data": data,
            }
            results[q] = data
            _append_cache(CACHE_FILE, key, enriched)
            _append_report(REPORT_FILE, {"type": "qa", "q": q, "key": key, "ts": datetime.now().isoformat()})
            return
        prompt = prompt_qa(q, evid)
        logger.info(f"[QA][ask] q='{q}' evid={len(evid)} prompt_chars={len(prompt)}")
        async with semaphore:
            try:
                data, model_used, tokens = await _ask_with_fallback(prompt)
            except Exception as e:
                logger.error(f"[QA] AI failed for '{q}', insufficient: {e}")
                data = _insufficient_qa(q)
                model_used = "none"
                tokens = 0
        _validate_required(data, ["answer", "citations"])
        enriched = {
            "question": q,
            "prompt_version": PROMPT_VERSION,
            "model_version": get_model_version(model_used) if model_used != "none" else "none",
            "ai_model_used": model_used,
            "ai_response_tokens": tokens,
            "data": data,
        }
        results[q] = data
        _append_cache(CACHE_FILE, key, enriched)
        _append_report(REPORT_FILE, {"type": "qa", "q": q, "key": key, "ts": datetime.now().isoformat()})

    gathered = await asyncio.gather(*[one(q) for q in questions], return_exceptions=True)
    for g in gathered:
        if isinstance(g, Exception):
            logger.error(f"[QA] task error: {g}")
    with open(QA_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return results


# --------------------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------------------
async def run_enrichment(
    scope: Set[str],
    limit_motions: int,
    pairs_limit: int,
    resume: bool,
    rebuild: bool,
    test_mode: bool,
):
    start = datetime.now()

    # Load cache and checkpoint
    cache_map = _load_cache(CACHE_FILE)
    checkpoint = CheckpointManager(CHECKPOINT_FILE, interval=ASYNC_BATCH_CHECKPOINT_SIZE)
    if resume and checkpoint.exists():
        checkpoint.load()  # We keep checkpoint for logging/resume metadata; processing is idempotent via cache keys

    # Data
    candidates, votes = await load_data()
    votes_by_candidate: Dict[str, List[VoteRec]] = defaultdict(list)
    votes_by_candidate_topic: Dict[str, Dict[str, List[VoteRec]]] = defaultdict(lambda: defaultdict(list))
    motions: Dict[str, List[VoteRec]] = defaultdict(list)

    for v in votes:
        votes_by_candidate[v.candidate_id].append(v)
        t = v.topic or "Other"
        votes_by_candidate_topic[v.candidate_id][t].append(v)
        # Build motion key by report number if available else title+date
        mkey = v.report_numbers[0] if v.report_numbers else f"{v.motion_title[:80]}|{v.meeting_date}"
        motions[mkey].append(v)

    logger.info(
        f"Loaded: candidates={len(candidates)} votes={len(votes)} candidate_topics={len(votes_by_candidate_topic)} motions={len(motions)}"
    )

    # Verbose topic distribution per candidate
    for c in candidates:
        by_topic = votes_by_candidate_topic.get(c.id, {})
        counts = {t: len(arr) for t, arr in by_topic.items()}
        top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:8]
        logger.debug(f"[DIST] {c.slug}: " + ", ".join(f"{t}={n}" for t, n in top))

    # TEST mode thinning
    if test_mode:
        # Keep first 3 candidates for speed
        candidates = sorted(candidates, key=lambda c: c.slug)[:3]
        # Reduce motions/pairs if not explicitly overridden
        limit_motions = min(limit_motions, 10)
        pairs_limit = min(pairs_limit, 4)

    # Reduce topics per candidate in test
    if test_mode:
        trimmed: Dict[str, Dict[str, List[VoteRec]]] = defaultdict(lambda: defaultdict(list))
        for cid, by_topic in votes_by_candidate_topic.items():
            # pick top 3 topics by volume
            tops = sorted(by_topic.items(), key=lambda kv: len(kv[1]), reverse=True)[:3]
            for t, arr in tops:
                trimmed[cid][t] = arr
        votes_by_candidate_topic = trimmed

    sem_count = CONCURRENT_REQUESTS if not test_mode else max(4, CONCURRENT_REQUESTS // 2)
    logger.info(f"Concurrency: {sem_count} (test_mode={test_mode})")
    sem = asyncio.Semaphore(sem_count)

    # Algorithmic vectors/consistency
    vectors: Dict[str, Any] = {}
    if "vectors" in scope or "all" in scope:
        scores = build_topic_vectors(votes_by_candidate_topic)
        for c in candidates:
            ts = scores.get(c.id, {})
            vectors[c.slug] = {
                "axes": {"fiscal_vs_service": None, "growth_vs_conservation": None},  # Placeholder axes (requires designed mapping)
                "topic_scores": ts,
                "consistency": consistency_metric(ts),
            }
        with open(VECTORS_JSON, "w", encoding="utf-8") as f:
            json.dump(vectors, f, indent=2, ensure_ascii=False)

    # AI tasks
    if "briefs" in scope or "all" in scope:
        logger.info(f"Starting: briefs (candidates={len(candidates)})")
        await enrich_ballot_briefs(candidates, votes_by_candidate, cache_map, sem, rebuild)
        checkpoint.save({"last": "briefs", "ts": datetime.now().isoformat()})

    if "stances" in scope or "all" in scope:
        tot_topics = sum(len(votes_by_candidate_topic.get(c.id, {})) for c in candidates)
        logger.info(f"Starting: stances (candidates={len(candidates)}, topics~{tot_topics})")
        await enrich_topic_stances(candidates, votes_by_candidate_topic, cache_map, sem, rebuild)
        checkpoint.save({"last": "stances", "ts": datetime.now().isoformat()})

    if "explainers" in scope or "all" in scope:
        logger.info(f"Starting: explainers (motions~{min(len(motions), limit_motions)})")
        await enrich_motion_explainers(motions, cache_map, sem, limit_motions, rebuild)
        checkpoint.save({"last": "explainers", "ts": datetime.now().isoformat()})

    if "pairs" in scope or "all" in scope:
        logger.info(f"Starting: pairs (limit={pairs_limit})")
        await enrich_pairwise(candidates, votes_by_candidate_topic, cache_map, sem, pairs_limit, rebuild)
        checkpoint.save({"last": "pairs", "ts": datetime.now().isoformat()})

    if "qa" in scope or "all" in scope:
        questions = [
            "Who is most transit-forward?",
            "Who prioritizes budget restraint?",
            "Who has the strongest record on public safety?",
            "Who most consistently supports housing initiatives?",
            "Who supports climate action the most?",
        ]
        logger.info(f"Starting: QA (questions={len(questions)})")
        await enrich_qa(questions, votes, cache_map, sem, rebuild)
        checkpoint.save({"last": "qa", "ts": datetime.now().isoformat()})

    # Post-run quick validator to flag any objects still missing citations
    try:
        problems = []
        # Briefs
        b = json.load(open(BRIEFS_JSON, 'r')) if BRIEFS_JSON.exists() else {}
        for slug, obj in b.items():
            if not (isinstance(obj.get('citations'), list) and len(obj['citations'])>0):
                problems.append(f"brief:{slug}: no citations")
        # Stances
        s = json.load(open(STANCES_JSON, 'r')) if STANCES_JSON.exists() else {}
        for slug,topics in s.items():
            for t,obj in topics.items():
                if not (isinstance(obj.get('citations'), list) and len(obj['citations'])>0):
                    problems.append(f"stance:{slug}:{t}: no citations/insufficient")
        # Pairs
        p = json.load(open(PAIRWISE_JSON, 'r')) if PAIRWISE_JSON.exists() else []
        for row in p:
            d=row.get('data',{})
            if not (isinstance(d.get('citations'), list) and len(d['citations'])>0):
                problems.append(f"pair:{row.get('candidate_a')}:{row.get('candidate_b')}: no citations/insufficient")
        # Report
        if problems:
            for line in problems[:50]:
                logger.warning(f"VALIDATION: {line}")
            _append_report(REPORT_FILE, {"type":"validation_summary","ts": datetime.now().isoformat(),"missing_citations": len(problems)})
    except Exception as e:
        logger.warning(f"Validator failed: {e}")

    dur = (datetime.now() - start).total_seconds()
    stats = {
        "Started": start.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(dur),
        "Output dir": str(ENRICH_DIR),
        "Cache": str(CACHE_FILE),
        "Checkpoint": str(CHECKPOINT_FILE),
        "Prompt version": PROMPT_VERSION,
        "Models": f"{PRIMARY_MODEL} → {FALLBACK_MODEL}",
    }
    print_summary_box("AI ENRICHMENT SUMMARY", stats)


def _parse_scope(arg: Optional[str]) -> Set[str]:
    if not arg:
        return {"all"}
    parts = [p.strip().lower() for p in arg.split(",") if p.strip()]
    valid = {"all", "briefs", "stances", "explainers", "pairs", "qa", "vectors"}
    out = set(p for p in parts if p in valid)
    return out or {"all"}


def main():
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="CivicCheckYYC AI Enrichment")
    parser.add_argument("--scope", type=str, default="all", help="Comma list: briefs,stances,explainers,pairs,qa,vectors,all")
    parser.add_argument("--limit_motions", type=int, default=75, help="Top N motions for explainers")
    parser.add_argument("--pairs", type=int, default=12, help="Number of pairwise briefs")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint (best-effort)")
    parser.add_argument("--rebuild", action="store_true", help="Ignore cache and recompute")
    parser.add_argument("--test", action="store_true", help="Run a thin, fast pass (few candidates, topics, motions, pairs)")
    parser.add_argument("--verbose", action="store_true", help="Very verbose logging (DEBUG)")

    args = parser.parse_args()

    logger.info("CivicCheckYYC - AI Enrichment (Async + Cache)")
    logger.info("=" * 60)
    logger.info(f"Scope: {args.scope}")
    logger.info(f"Models: {PRIMARY_MODEL} (fallback {FALLBACK_MODEL})")
    logger.info(f"Supabase URL: {SUPABASE_URL or 'none'}\n")

    # Increase verbosity in test/verbose
    if args.verbose or args.test:
        import logging as _logging
        _logging.getLogger().setLevel(_logging.DEBUG)
        logger.debug("Verbose mode enabled (DEBUG)")

    scope = _parse_scope(args.scope)

    try:
        asyncio.run(
            run_enrichment(
                scope=scope,
                limit_motions=args.limit_motions,
                pairs_limit=args.pairs,
                resume=args.resume,
                rebuild=args.rebuild,
                test_mode=args.test,
            )
        )
    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
        raise


if __name__ == "__main__":
    main()
