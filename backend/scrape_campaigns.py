"""
Scrape candidate campaign websites and store readable page content.

Overview
- Fetch candidates (id, name, slug, website) from Supabase
- For each website, crawl same-domain pages up to a per-site limit
- Respect robots.txt, rate limit, and skip non-HTML content
- Extract readable main text and simple title, classify page type heuristically
- Upsert into `campaign_pages` table (unique per candidate_id + url)

Usage
  python backend/scrape_campaigns.py                 # dry run (no DB writes)
  python backend/scrape_campaigns.py --write         # save to Supabase
  python backend/scrape_campaigns.py --limit 3       # limit candidates
  python backend/scrape_campaigns.py --per-site 10   # pages per site
  python backend/scrape_campaigns.py --only-missing  # skip candidates with pages already

Env
  SUPABASE_PROJECT_URL
  SUPABASE_SERVICE_ROLE_KEY (write) or SUPABASE_ANON_KEY (read-only)
"""

from __future__ import annotations

import os
import re
import time
import json
import argparse
import hashlib
from dataclasses import dataclass
from typing import Optional, Dict, Set, List, Tuple
from urllib.parse import urlparse, urljoin, urldefrag

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from urllib import robotparser


HTTP_HEADERS = {
    "User-Agent": "CivicCheckYYC/1.0 (campaign-crawler; contact: admin@civiccheckyyc.example)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Path hints to prioritize campaign-relevant pages
RELEVANT_PATH_HINTS = (
    "platform",
    "policy",
    "policies",
    "priorities",
    "issues",
    "plan",
    "vision",
    "values",
    "about",
    "bio",
)

# Skip obvious non-content paths
SKIP_PATH_HINTS = (
    "wp-json",
    "/feed",
    ".xml",
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".ico",
    ".zip",
    ".css",
    ".js",
)


@dataclass
class Candidate:
    id: str
    name: str
    slug: str
    website: Optional[str]


def create_supabase() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_PROJECT_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase credentials missing: set SUPABASE_PROJECT_URL and SERVICE_ROLE_KEY/ANON_KEY")
    return create_client(url, key)


def normalize_url(url: str) -> str:
    # Remove fragment, lower scheme+host, keep path/query
    url, _ = urldefrag(url)
    p = urlparse(url)
    netloc = (p.netloc or "").lower()
    scheme = (p.scheme or "http").lower()
    path = p.path or "/"
    query = f"?{p.query}" if p.query else ""
    return f"{scheme}://{netloc}{path}{query}"


def same_domain(u: str, base_netloc: str) -> bool:
    nu = urlparse(u).netloc.lower()
    return nu == base_netloc or nu == f"www.{base_netloc}" or f".{base_netloc}" in nu


def can_fetch(rp: robotparser.RobotFileParser, url: str) -> bool:
    try:
        return rp.can_fetch(HTTP_HEADERS["User-Agent"], url)
    except Exception:
        return True


def fetch_html(url: str, timeout: float = 12.0) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    try:
        resp = requests.get(url, headers=HTTP_HEADERS, timeout=timeout, allow_redirects=True)
        ctype = resp.headers.get("Content-Type", "").lower()
        if "text/html" not in ctype:
            return None, resp.status_code, ctype
        return resp.text, resp.status_code, ctype
    except Exception:
        return None, None, None


def extract_readable(html: str) -> Tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")

    # Remove obvious chrome
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()
    for tag in soup.find_all(["nav", "footer", "header", "aside"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find("h1")
        if h1 and h1.get_text(strip=True):
            title = h1.get_text(strip=True)

    # Prefer main/article/section blocks, choose longest text
    candidates: List[str] = []
    for sel in ("main", "article"):
        for el in soup.select(sel):
            txt = el.get_text("\n", strip=True)
            if txt:
                candidates.append(txt)
    if not candidates:
        # Fallback: pick largest section-like divs
        best_txt = ""
        best_len = 0
        for el in soup.find_all(["section", "div"]):
            txt = el.get_text("\n", strip=True)
            if txt and len(txt) > best_len:
                best_txt, best_len = txt, len(txt)
        if best_txt:
            candidates.append(best_txt)

    text = max(candidates, key=len) if candidates else soup.get_text("\n", strip=True)
    # Normalize whitespace a bit
    text = re.sub(r"\n{3,}", "\n\n", text)
    return title, text


def classify_page(url_path: str, text: str) -> str:
    p = url_path.lower()
    if any(k in p for k in ("platform", "policy", "policies", "priorities", "issues", "plan", "vision", "values")):
        return "platform"
    if any(k in p for k in ("about", "bio", "meet")):
        return "about"
    if any(k in p for k in ("news", "press", "media", "blog", "updates")):
        return "news"
    # Content keyword backup
    t = text.lower()[:2000]
    if any(k in t for k in ("my plan", "our plan", "priorities", "issues", "platform", "policies")):
        return "platform"
    return "other"


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()


def crawl_site(seed_url: str, per_site_limit: int = 15, delay: float = 0.5) -> List[Tuple[str, Optional[int], Optional[str], Optional[str], Optional[str]]]:
    """Return list of (url, status_code, content_type, title, text) for crawled pages."""
    seed = normalize_url(seed_url)
    parsed = urlparse(seed)
    base = f"{parsed.scheme}://{parsed.netloc}"
    base_netloc = parsed.netloc.lower()

    # robots.txt
    rp = robotparser.RobotFileParser()
    try:
        rp.set_url(urljoin(base, "/robots.txt"))
        rp.read()
    except Exception:
        pass

    seen: Set[str] = set()
    q: List[str] = [seed]
    results: List[Tuple[str, Optional[int], Optional[str], Optional[str], Optional[str]]] = []

    while q and len(results) < per_site_limit:
        cur = q.pop(0)
        if cur in seen:
            continue
        seen.add(cur)

        # Robots
        if not can_fetch(rp, cur):
            continue

        # Skip static and non-contenty URLs quickly
        path = urlparse(cur).path.lower()
        if any(path.endswith(ext) or ext in path for ext in SKIP_PATH_HINTS):
            continue

        html, status, ctype = fetch_html(cur)
        if html is None:
            results.append((cur, status, ctype, None, None))
            continue

        title, text = extract_readable(html)
        results.append((cur, status, ctype, title, text))

        # Enqueue links from this page (only same-domain, normalized, and relevant hints)
        try:
            soup = BeautifulSoup(html, "lxml")
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                abs_url = urljoin(cur, href)
                abs_url = normalize_url(abs_url)
                if abs_url in seen:
                    continue
                if not same_domain(abs_url, base_netloc):
                    continue
                ap = urlparse(abs_url).path.lower()
                if any(bad in ap for bad in SKIP_PATH_HINTS):
                    continue
                # prefer relevant pages; still allow a small amount of exploratory links
                if any(h in ap for h in RELEVANT_PATH_HINTS) or abs_url == seed:
                    q.append(abs_url)
                elif len(q) < per_site_limit // 2:  # small exploratory budget
                    q.append(abs_url)
        except Exception:
            pass

        time.sleep(delay)

    return results


def fetch_candidates(sb: Client, limit: Optional[int]) -> List[Candidate]:
    q = sb.table("candidates").select("id,name,slug,website").order("name")
    if limit is not None:
        q = q.limit(limit)
    resp = q.execute()
    rows = resp.data or []
    return [Candidate(**r) for r in rows]


def count_existing_pages(sb: Client, candidate_id: str) -> int:
    try:
        r = sb.table("campaign_pages").select("id", count="exact").eq("candidate_id", candidate_id).execute()
        # postgrest returns count in r.count in some clients; supabase-py returns None; use len when data is present
        if hasattr(r, "count") and r.count is not None:
            return int(r.count)
        return len(r.data or [])
    except Exception:
        return 0


def upsert_page(sb: Client, candidate_id: str, url: str, status_code: Optional[int], title: Optional[str], text: Optional[str], source_domain: str) -> None:
    url_norm = normalize_url(url)
    content_hash = sha256_text(text or "") if text else None
    page_type = classify_page(urlparse(url_norm).path, text or "")
    record = {
        "candidate_id": candidate_id,
        "url": url,
        "url_normalized": url_norm,
        "status_code": status_code,
        "title": title,
        "page_type": page_type,
        "language": "en",  # default; could add detection later
        "content": text,
        "content_hash": content_hash,
        "source_domain": source_domain,
    }
    # Upsert based on unique (candidate_id, url)
    sb.table("campaign_pages").upsert(record, on_conflict="candidate_id,url").execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl candidate campaign websites")
    parser.add_argument("--write", action="store_true", help="Write scraped pages to Supabase (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of candidates to process")
    parser.add_argument("--per-site", type=int, default=12, help="Max pages to crawl per site")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between page fetches (seconds)")
    parser.add_argument("--only-missing", action="store_true", help="Skip candidates that already have pages scraped")
    args = parser.parse_args()

    sb = create_supabase()
    candidates = fetch_candidates(sb, args.limit)

    # Filter to those with websites
    candidates = [c for c in candidates if c.website]

    results: List[Dict[str, object]] = []
    for idx, c in enumerate(candidates, start=1):
        try:
            # Optionally skip candidates with existing pages
            if args.only_missing:
                existing = count_existing_pages(sb, c.id)
                if existing > 0:
                    print(f"[{idx}/{len(candidates)}] {c.name}: skip (already has {existing} pages)")
                    continue

            seed = c.website or ""
            parsed = urlparse(seed)
            if not parsed.scheme or not parsed.netloc:
                print(f"[{idx}/{len(candidates)}] {c.name}: invalid website '{seed}'")
                continue
            source_domain = parsed.netloc.lower()

            print(f"[{idx}/{len(candidates)}] Crawling {c.name} → {seed}")
            pages = crawl_site(seed, per_site_limit=args.per_site, delay=args.delay)

            saved = 0
            for (url, status, ctype, title, text) in pages:
                entry = {
                    "candidate_id": c.id,
                    "name": c.name,
                    "slug": c.slug,
                    "url": url,
                    "status_code": status,
                    "title": title,
                    "page_type": classify_page(urlparse(url).path, text or ""),
                    "has_text": bool(text and text.strip()),
                }
                results.append(entry)

                if args.write:
                    try:
                        upsert_page(sb, c.id, url, status, title, text, source_domain)
                        saved += 1
                    except Exception as e:
                        print(f"  ✗ Upsert failed for {url}: {e}")

            print(f"  ✓ Done: {len(pages)} pages crawled, {saved} saved")

            # Gentle pause between sites
            time.sleep(max(0.2, args.delay))

        except KeyboardInterrupt:
            print("Interrupted by user")
            break
        except Exception as e:
            print(f"[{idx}/{len(candidates)}] {c.name}: error {e}")

    # Write crawl report
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    report_path = os.path.join(root, "data", "campaign_crawl_report.json")
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "write": args.write,
                "per_site": args.per_site,
                "only_missing": args.only_missing,
                "count": len(results),
                "results": results,
            }, f, indent=2)
        print(f"\nReport written to: {report_path}")
    except Exception as e:
        print(f"Failed to write report: {e}")


if __name__ == "__main__":
    main()
