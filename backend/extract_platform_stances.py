"""
Extract key stances and verbatim quotes from candidate platform pages.

Pipeline
- Read `campaign_pages` with page_type='platform' (and content present)
- For each page, prompt OpenAI to return up to N stances with: title, topic, summary, quote
- Validate that quote appears in page content; build scroll-to-text fragment URL
- Upsert into `platform_stances` with stance_hash for dedupe

Usage
  python backend/extract_platform_stances.py                 # dry run
  python backend/extract_platform_stances.py --write         # save to Supabase
  python backend/extract_platform_stances.py --limit 20      # limit pages
  python backend/extract_platform_stances.py --candidate jeff-davison

Env
  OPENAI_KEY
  SUPABASE_PROJECT_URL
  SUPABASE_SERVICE_ROLE_KEY (write) or SUPABASE_ANON_KEY (read-only)
"""

from __future__ import annotations

import os
import re
import json
import argparse
import hashlib
import urllib.parse as up
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError

from config import VALID_TOPICS, AI_TEMPERATURE, AI_TIMEOUT


load_dotenv()


@dataclass
class CampaignPage:
    id: str
    candidate_id: str
    url: str
    title: Optional[str]
    content: Optional[str]
    page_type: Optional[str]
    candidate_slug: Optional[str] = None
    candidate_name: Optional[str] = None


def create_supabase() -> Client:
    url = os.getenv("SUPABASE_PROJECT_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase credentials missing: set SUPABASE_PROJECT_URL and SERVICE_ROLE_KEY/ANON_KEY")
    return create_client(url, key)


def openai_client() -> OpenAI:
    key = os.getenv("OPENAI_KEY")
    if not key:
        raise RuntimeError("OPENAI_KEY is required")
    return OpenAI(api_key=key)


def fetch_platform_pages(sb: Client, limit: Optional[int], candidate_slug: Optional[str]) -> List[CampaignPage]:
    # Fetch pages first
    q = (
        sb.table("campaign_pages")
        .select("id,candidate_id,url,title,content,page_type")
        .eq("page_type", "platform")
        .not_.is_("content", None)
    )
    if limit is not None:
        q = q.limit(limit)
    pages_res = q.execute()
    raw_pages = pages_res.data or []

    # Fetch candidate metadata in one query
    cand_ids = sorted({p["candidate_id"] for p in raw_pages})
    cand_map: Dict[str, Dict] = {}
    if cand_ids:
        cres = sb.table("candidates").select("id,slug,name").in_("id", cand_ids).execute()
        for r in (cres.data or []):
            cand_map[r["id"]] = r

    pages: List[CampaignPage] = []
    for r in raw_pages:
        cmeta = cand_map.get(r["candidate_id"], {})
        if candidate_slug and cmeta.get("slug") != candidate_slug:
            continue
        pages.append(CampaignPage(
            id=r["id"],
            candidate_id=r["candidate_id"],
            url=r["url"],
            title=r.get("title"),
            content=r.get("content"),
            page_type=r.get("page_type"),
            candidate_slug=cmeta.get("slug"),
            candidate_name=cmeta.get("name"),
        ))
    return pages


PROMPT = (
    "You are extracting key campaign stances from a candidate's official platform page. "
    "Return only valid JSON with a 'stances' array (max 7 items). For each stance, provide: "
    "title (short), topic (choose from the provided list), summary (one sentence), and quote. "
    "The quote MUST be copied verbatim from the provided page content. Keep quotes under 240 characters.\n\n"
    "Candidate: {candidate_name}\n"
    "Page title: {page_title}\n"
    "Allowed topics: {topics}\n\n"
    "Page content (truncate as needed):\n---\n{content}\n---\n\n"
    "Return ONLY this JSON structure (no markdown):\n"
    "{{\n  \"stances\": [\n    {{\n      \"title\": \"...\",\n      \"topic\": \"...\",\n      \"summary\": \"...\",\n      \"quote\": \"...\"\n    }}\n  ]\n}}\n\n"
    "Rules:\n"
    "- Use only the content provided.\n"
    "- Quotes must be exact substrings of the content.\n"
    "- If unsure, omit the item.\n"
)


def ask_openai_extract(client: OpenAI, candidate_name: str, page_title: str, content: str) -> Dict:
    model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    # enforce gpt-5 family only
    if not model.startswith("gpt-5"):
        raise ValueError("OPENAI_MODEL must be a gpt-5 family model")

    user_prompt = PROMPT.format(
        candidate_name=candidate_name or "",
        page_title=page_title or "",
        topics=", ".join(VALID_TOPICS),
        content=content[:12000],  # larger context for platform pages
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You extract structured data from political platform pages. Always return strict JSON."},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=AI_TEMPERATURE,
        max_completion_tokens=1200,
        timeout=AI_TIMEOUT,
    )
    txt = resp.choices[0].message.content or "{}"
    # strip code fences if any
    if txt.startswith("```json"):
        txt = txt.replace("```json", "").replace("```", "").strip()
    elif txt.startswith("```"):
        txt = txt.replace("```", "").strip()
    return json.loads(txt)


def keyword_topic(text: str) -> str:
    t = text.lower()
    kw = [
        ("Housing", ["housing", "rent", "home", "afford", "shelter"]),
        ("Transit", ["transit", "lrt", "bus", "train", "fare"]),
        ("Budget", ["budget", "tax", "mill rate", "property tax", "spend", "deficit"]),
        ("PublicSafety", ["crime", "police", "safety", "enforcement", "fire", "ems"]),
        ("Environment", ["climate", "emission", "environment", "green", "net-zero", "energy"]),
        ("EconomicDevelopment", ["business", "econom", "jobs", "downtown", "innovation"]),
        ("Infrastructure", ["infrastructure", "roads", "water", "sewer", "pipes", "bridges"]),
        ("SocialServices", ["social", "poverty", "homeless", "mental health", "addiction", "seniors"]),
        ("Planning", ["planning", "zoning", "rezoning", "density", "land use", "dp ", "outline plan"]),
    ]
    for label, words in kw:
        for w in words:
            if w in t:
                return label
    return "Other"


def heuristic_extract(content: str, max_items: int = 7) -> List[Dict[str, str]]:
    """Fallback extraction from plain text using bullet lines and will/commit phrases."""
    text = content or ""
    # Normalize bullets and whitespace
    text = text.replace("\u2022", "•").replace("\u2013", "- ").replace("\u2014", "- ")
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]

    items: List[str] = []
    for ln in lines:
        if re.match(r"^([\-•\*]\s+|\d+\.|[A-Za-z].*:\s)", ln):
            # bullet or heading-like
            core = re.sub(r"^[\-•\*]\s+", "", ln)
            if 30 <= len(core) <= 240:
                items.append(core)

    # If not enough, look for sentences with commitment verbs
    if len(items) < 3:
        sentences = re.split(r"(?<=[\.!?])\s+", " ".join(lines))
        for s in sentences:
            if re.search(r"\b(we will|i will|i'll|we'll|commit|pledge|ensure|deliver)\b", s, flags=re.I):
                s2 = s.strip()
                if 40 <= len(s2) <= 240:
                    items.append(s2)
            if len(items) >= max_items:
                break

    # Dedupe while preserving order
    seen = set()
    uniq: List[str] = []
    for it in items:
        key = it.lower()
        if key not in seen:
            seen.add(key)
            uniq.append(it)

    stances: List[Dict[str, str]] = []
    for it in uniq[:max_items]:
        topic = keyword_topic(it)
        title = it.split(" ")
        title = " ".join(title[:8]).strip()
        stances.append({
            "title": title if len(title) >= 4 else (it[:40] + ("…" if len(it) > 40 else "")),
            "topic": topic,
            "summary": it,
            "quote": it,
        })
    return stances


def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def build_scroll_to_text(url: str, quote: str) -> str:
    """Build a Scroll-To-Text fragment link for the given quote.

    Format per spec:
      - First directive:    #:\~:text=<encoded>
      - Additional quotes:  &text=<encoded>
      - With existing hash: #<frag>:~:text=<encoded>
    """
    snippet = normalize_ws(quote)[:200]
    enc = up.quote(snippet, safe="")

    if "#:~:text=" in url:
        return f"{url}&text={enc}"
    if "#" in url:
        base, frag = url.split("#", 1)
        return f"{base}#{frag}:~:text={enc}"
    return f"{url}#:~:text={enc}"


def stance_hash(candidate_id: str, page_id: Optional[str], quote: str) -> str:
    key = f"{candidate_id}|{page_id or ''}|{normalize_ws(quote)}"
    return hashlib.sha256(key.encode("utf-8", errors="ignore")).hexdigest()


def upsert_stance(sb: Client, st: Dict) -> None:
    sb.table("platform_stances").upsert(st, on_conflict="stance_hash").execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract key stances from platform pages")
    parser.add_argument("--write", action="store_true", help="Write to Supabase (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of pages to process")
    parser.add_argument("--candidate", type=str, default=None, help="Limit to candidate slug")
    parser.add_argument("--max-stances", type=int, default=7, help="Max stances to save per page")
    parser.add_argument("--no-heuristic", action="store_true", help="Disable heuristic fallback if AI returns none")
    parser.add_argument("--debug", action="store_true", help="Print model JSON when no stances found")
    args = parser.parse_args()

    sb = create_supabase()
    client = openai_client()

    pages = fetch_platform_pages(sb, args.limit, args.candidate)
    total_saved = 0
    report: List[Dict] = []

    for i, p in enumerate(pages, start=1):
        if not p.content:
            continue
        print(f"[{i}/{len(pages)}] {p.candidate_name} :: {p.title or '(untitled)'}")
        try:
            data = ask_openai_extract(client, p.candidate_name or "", p.title or "", p.content)
        except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
            print(f"  ✗ OpenAI error: {e}")
            data = {}
        except Exception as e:
            print(f"  ✗ Parse error: {e}")
            data = {}

        stances = (data or {}).get("stances") or []
        if not stances and not args.no_heuristic:
            if args.debug:
                print("  (debug) AI returned no stances; using heuristic fallback")
            stances = heuristic_extract(p.content, args.max_stances)
        elif not stances and args.debug:
            print("  (debug) AI returned no stances and heuristic disabled")
        kept = 0
        for s in stances[: args.max_stances]:
            title = (s.get("title") or "").strip()
            topic = (s.get("topic") or "Other").strip()
            summary = (s.get("summary") or "").strip()
            quote = (s.get("quote") or "").strip()
            if not title or not quote:
                continue

            # Validate topic
            if topic not in VALID_TOPICS:
                topic = "Other"

            # Ensure quote appears in content (loose whitespace)
            content_norm = normalize_ws(p.content)
            quote_norm = normalize_ws(quote)
            if quote_norm and quote_norm not in content_norm:
                # If not found, skip to avoid bad anchors
                continue

            scroll_url = build_scroll_to_text(p.url, quote)
            shash = stance_hash(p.candidate_id, p.id, quote)
            rec = {
                "candidate_id": p.candidate_id,
                "campaign_page_id": p.id,
                "topic": topic,
                "title": title[:140],
                "stance_summary": summary[:400] if summary else None,
                "quote": quote[:1000],
                "source_url": p.url,
                "source_scroll_url": scroll_url,
                "confidence": "ai_generated",
                "stance_hash": shash,
            }

            report.append({"page": p.url, "title": title, "topic": topic, "has_anchor": True})
            if args.write:
                try:
                    upsert_stance(sb, rec)
                    total_saved += 1
                    kept += 1
                except Exception as e:
                    print(f"  ✗ Upsert failed: {e}")

        print(f"  ✓ Extracted {kept}/{len(stances)} stances saved")

    # Save report
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out = os.path.join(root, "data", "platform_stances_report.json")
    try:
        with open(out, "w", encoding="utf-8") as f:
            json.dump({"saved": total_saved, "pages": len(pages), "items": report}, f, indent=2)
        print(f"Report: {out}")
    except Exception as e:
        print(f"Failed to write report: {e}")


if __name__ == "__main__":
    main()
