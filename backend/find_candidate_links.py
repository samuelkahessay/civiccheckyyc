"""
Find and populate candidate Wikipedia and official website links.

Strategy:
- Fetch candidates from Supabase (id, name, slug, website, wikipedia_url)
- For each missing link, use Wikipedia API to find the correct page
- Use Wikidata (via pageprops.wikibase_item) to fetch P856 (official website)
- Update Supabase with discovered links (unless --dry-run)

Usage:
  python backend/find_candidate_links.py            # dry run (no DB writes)
  python backend/find_candidate_links.py --write    # update Supabase
  python backend/find_candidate_links.py --limit 3  # limit candidates

Requires env vars:
  SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON for read-only)
"""

import os
import time
import json
import argparse
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple

import requests
from supabase import create_client, Client
from dotenv import load_dotenv


WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
HTTP_HEADERS = {
    "User-Agent": "CivicCheckYYC/1.0 (link-discovery; contact: admin@civiccheckyyc.example)",
}

# Conservative manual overrides for known, unambiguous personal Wikipedia pages
KNOWN_WIKIS_BY_SLUG: Dict[str, str] = {
    "jyoti-gondek": "https://en.wikipedia.org/wiki/Jyoti_Gondek",
    "jeromy-farkas": "https://en.wikipedia.org/wiki/Jeromy_Farkas",
    "larry-heather": "https://en.wikipedia.org/wiki/Larry_R._Heather",
}


@dataclass
class CandidateRow:
    id: str
    name: str
    slug: str
    website: Optional[str]
    wikipedia_url: Optional[str]


def create_supabase() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_PROJECT_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase credentials missing: set SUPABASE_PROJECT_URL and SERVICE_ROLE_KEY/ANON_KEY")
    return create_client(url, key)


def fetch_candidates(sb: Client, limit: Optional[int] = None) -> List[CandidateRow]:
    query = sb.table("candidates").select("id,name,slug,website,wikipedia_url").order("name")
    if limit is not None:
        query = query.limit(limit)
    resp = query.execute()
    rows = resp.data or []
    return [CandidateRow(**r) for r in rows]


def wiki_search_title(name: str) -> Optional[Dict[str, Any]]:
    """Search Wikipedia for a candidate and return first likely result (pageid/title/snippet)."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{name} Calgary",
        "format": "json",
        "srlimit": 5,
        "srprop": "snippet|size|wordcount|timestamp",
    }
    try:
        r = requests.get(WIKI_API, params=params, timeout=12, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        results = data.get("query", {}).get("search", [])
        if not results:
            # retry without Calgary hint
            params["srsearch"] = name
            r = requests.get(WIKI_API, params=params, timeout=12, headers=HTTP_HEADERS)
            r.raise_for_status()
            data = r.json()
            results = data.get("query", {}).get("search", [])
        if not results:
            return None
        # Prefer results that mention Calgary/councillor/mayor
        preferred: List[Tuple[int, Dict[str, Any]]] = []
        for idx, item in enumerate(results):
            snippet = (item.get("snippet") or "").lower()
            score = 0
            if "calgary" in snippet:
                score += 3
            if "mayor" in snippet:
                score += 2
            if "councillor" in snippet or "council" in snippet:
                score += 2
            # earlier results get slight preference
            score += max(0, 4 - idx)
            preferred.append((score, item))
        preferred.sort(key=lambda x: x[0], reverse=True)
        return preferred[0][1]
    except Exception:
        return None


def wiki_page_info(pageid: int) -> Optional[Dict[str, Any]]:
    """Get page fullurl and wikibase_item for a given pageid."""
    params = {
        "action": "query",
        "prop": "info|pageprops",
        "inprop": "url",
        "pageids": str(pageid),
        "format": "json",
    }
    try:
        r = requests.get(WIKI_API, params=params, timeout=12, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        pages = data.get("query", {}).get("pages", {})
        if not pages:
            return None
        page = next(iter(pages.values()))
        return page
    except Exception:
        return None


def wikidata_official_site(qid: str) -> Optional[str]:
    """Fetch P856 (official website) from Wikidata for entity QID."""
    params = {
        "action": "wbgetclaims",
        "entity": qid,
        "property": "P856",
        "format": "json",
    }
    try:
        r = requests.get(WIKIDATA_API, params=params, timeout=12, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        claims = data.get("claims", {}).get("P856", [])
        for claim in claims:
            mainsnak = claim.get("mainsnak", {})
            datavalue = mainsnak.get("datavalue", {})
            value = datavalue.get("value")
            if isinstance(value, str) and value.startswith("http"):
                return value
        return None
    except Exception:
        return None


def wikidata_is_human(qid: str) -> bool:
    """Return True if Wikidata entity has P31=Q5 (instance of human)."""
    params = {
        "action": "wbgetclaims",
        "entity": qid,
        "property": "P31",
        "format": "json",
    }
    try:
        r = requests.get(WIKIDATA_API, params=params, timeout=12, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        claims = data.get("claims", {}).get("P31", [])
        for claim in claims:
            mainsnak = claim.get("mainsnak", {})
            datavalue = mainsnak.get("datavalue", {})
            if not datavalue:
                continue
            value = datavalue.get("value", {})
            if isinstance(value, dict) and value.get("id") == "Q5":
                return True
        return False
    except Exception:
        return False


def wikidata_label(qid: str, lang: str = "en") -> Optional[str]:
    params = {
        "action": "wbgetentities",
        "ids": qid,
        "props": "labels",
        "languages": lang,
        "format": "json",
    }
    try:
        r = requests.get(WIKIDATA_API, params=params, timeout=12, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        ent = data.get("entities", {}).get(qid, {})
        labels = ent.get("labels", {})
        if lang in labels:
            return labels[lang].get("value")
        return None
    except Exception:
        return None


def choose_official_from_extlinks(name: str, links: List[str]) -> Optional[str]:
    """Deprecated: Do not infer official site from extlinks to avoid news/third-party links."""
    return None


def discover_links(name: str) -> Dict[str, Optional[str]]:
    """Discover wikipedia_url and website for a person by name."""
    result: Dict[str, Optional[str]] = {"wikipedia_url": None, "website": None}

    search = wiki_search_title(name)
    if not search:
        return result

    pageid = search.get("pageid")
    page = wiki_page_info(pageid)
    if not page:
        return result

    fullurl = page.get("fullurl")
    if fullurl and fullurl.startswith("http"):
        # Only accept if Wikidata identifies as a human and label roughly matches
        qid = None
        pageprops = page.get("pageprops") or {}
        qid = pageprops.get("wikibase_item")
        if qid and wikidata_is_human(qid):
            label = wikidata_label(qid) or ""
            nm = name.lower()
            if nm.split()[0] in label.lower() and nm.split()[-1] in label.lower():
                result["wikipedia_url"] = fullurl

    # Try Wikidata for official website
    # Official website: Wikidata P856 only (no extlinks fallback)
    qid = page.get("pageprops", {}).get("wikibase_item")
    if qid:
        official = wikidata_official_site(qid)
        if official:
            result["website"] = official

    return result


def _domain_candidates_for(name: str) -> List[str]:
    first, *rest = name.lower().split()
    last = rest[-1] if rest else ""
    parts = [
        f"{first}{last}",
        f"{first}-{last}",
        f"{last}{first}",
        f"{first}{last}yyc",
        f"{first}{last}formayor",
        f"{last}formayor",
        f"{first}formayor",
    ]
    domains = []
    for base in parts:
        for tld in (".ca", ".com"):
            domains.append(base + tld)
    return list(dict.fromkeys(domains))  # dedupe, preserve order


def guess_official_site_by_patterns(name: str, timeout: float = 6.0) -> Optional[str]:
    """Attempt a conservative guess of an official site via common patterns.

    Accept only if page contains both first and last name and one of keywords.
    """
    import re

    # Require at least one core campaign keyword to reduce false positives
    core_kw = ["mayor", "vote", "elect"]
    first, *rest = name.lower().split()
    last = rest[-1] if rest else ""
    if not first or not last:
        return None

    for host in _domain_candidates_for(name):
        for scheme in ("https://", "http://"):
            url = scheme + host
            try:
                r = requests.get(url, headers=HTTP_HEADERS, timeout=timeout, allow_redirects=True)
                if r.status_code >= 400:
                    continue
                text = r.text.lower()
                if any(bad in text for bad in ("parking", "parked", "for sale", "suspended")):
                    continue
                # Ensure we didn't redirect to an unrelated domain
                from urllib.parse import urlparse
                final_host = urlparse(r.url).hostname or ""
                allowed_hosts = {host, "www." + host}
                if final_host not in allowed_hosts:
                    continue
                if first in text and last in text and any(k in text for k in core_kw):
                    return r.url  # final URL after redirects
            except Exception:
                continue
    return None


def update_candidate(sb: Client, candidate_id: str, updates: Dict[str, str]) -> None:
    sb.table("candidates").update(updates).eq("id", candidate_id).execute()


def cleanup_generic_wiki(sb: Client) -> int:
    """Remove generic election pages from wikipedia_url column."""
    patterns = [
        "%/2025_Calgary_municipal_election%",
        "%/2025_Alberta_municipal_elections%",
    ]
    removed = 0
    for p in patterns:
        # Select rows to update for reporting
        resp = sb.table("candidates").select("id,name,wikipedia_url").ilike("wikipedia_url", p).execute()
        rows = resp.data or []
        if rows:
            ids = [r["id"] for r in rows]
            sb.table("candidates").update({"wikipedia_url": None}).in_("id", ids).execute()
            removed += len(ids)
    return removed


def cleanup_non_official_websites(sb: Client) -> int:
    """Remove websites that point to media/news or social hosts (likely not official)."""
    bad_domains = [
        "%calgaryherald.com%",
        "%cbc.ca%",
        "%globalnews.ca%",
        "%calgarysun.com%",
        "%ctvnews.ca%",
        "%reddit.com%",
        "%facebook.com%",
        "%twitter.com%",
        "%x.com%",
        "%instagram.com%",
        "%linkedin.com%",
        "%youtube.com%",
        "%wikipedia.org%",
    ]
    removed = 0
    for p in bad_domains:
        resp = sb.table("candidates").select("id,name,website").ilike("website", p).execute()
        rows = resp.data or []
        if rows:
            ids = [r["id"] for r in rows]
            sb.table("candidates").update({"website": None}).in_("id", ids).execute()
            removed += len(ids)
    return removed


def main():
    parser = argparse.ArgumentParser(description="Find and upload candidate links")
    parser.add_argument("--write", action="store_true", help="Perform DB updates (default is dry-run)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of candidates to process")
    parser.add_argument("--only-missing", action="store_true", help="Only process candidates missing either link")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls (seconds)")
    parser.add_argument("--cleanup-generic", action="store_true", help="Remove generic election Wikipedia links from DB")
    parser.add_argument("--cleanup-news", action="store_true", help="Remove non-official website URLs (news/social)")
    parser.add_argument("--apply-overrides", action="store_true", help="Apply overrides from data/candidate_links_overrides.json and known safe Wikipedia overrides by slug if fields are missing")
    args = parser.parse_args()

    sb = create_supabase()
    if args.cleanup_generic and args.write:
        removed = cleanup_generic_wiki(sb)
        print(f"Removed {removed} generic wikipedia_url entries")
    if args.cleanup_news and args.write:
        removed = cleanup_non_official_websites(sb)
        print(f"Removed {removed} non-official website entries")

    candidates = fetch_candidates(sb, limit=args.limit)

    # Apply manual overrides for wikis if requested
    if args.apply_overrides and args.write:
        # File-based overrides
        try:
            import json, pathlib
            overrides_path = pathlib.Path(__file__).resolve().parents[1] / "data" / "candidate_links_overrides.json"
            if overrides_path.exists():
                overrides = json.loads(overrides_path.read_text())
                for c in candidates:
                    ov = overrides.get(c.slug)
                    if not ov:
                        continue
                    updates: Dict[str, str] = {}
                    if not c.website and isinstance(ov.get("website"), str):
                        updates["website"] = ov["website"]
                    if not c.wikipedia_url and isinstance(ov.get("wikipedia_url"), str):
                        # Only apply if it's a personal wiki page (heuristic: contains candidate name tokens)
                        nm = c.name.lower()
                        if all(tok in ov["wikipedia_url"].lower() for tok in nm.split()[:1] + nm.split()[-1:]):
                            updates["wikipedia_url"] = ov["wikipedia_url"]
                    if updates:
                        try:
                            update_candidate(sb, c.id, updates)
                            print(f"Override applied for {c.name}: {updates}")
                        except Exception as e:
                            print(f"Override failed for {c.name}: {e}")
        except Exception as e:
            print(f"Failed reading overrides file: {e}")

        # Known safe Wikipedia overrides map (backup)
        for c in candidates:
            if not c.wikipedia_url:
                url = KNOWN_WIKIS_BY_SLUG.get(c.slug)
                if url:
                    try:
                        update_candidate(sb, c.id, {"wikipedia_url": url})
                        print(f"Known override applied: {c.name} -> {url}")
                    except Exception as e:
                        print(f"Known override failed for {c.name}: {e}")

    to_process: List[CandidateRow] = []
    for c in candidates:
        if args.only_missing:
            if not c.website or not c.wikipedia_url:
                to_process.append(c)
        else:
            to_process.append(c)

    results: List[Dict[str, Any]] = []
    for i, c in enumerate(to_process, start=1):
        links = discover_links(c.name)
        # Conservative guessing for official site if still missing (no Wikipedia fallback)
        if not links.get("website"):
            guessed = guess_official_site_by_patterns(c.name)
            if guessed:
                links["website"] = guessed
        updates: Dict[str, str] = {}
        # Preserve existing values
        if not c.wikipedia_url and links.get("wikipedia_url"):
            updates["wikipedia_url"] = links["wikipedia_url"]  # type: ignore
        if not c.website and links.get("website"):
            updates["website"] = links["website"]  # type: ignore

        results.append({
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "found": links,
            "will_update": updates,
        })

        if updates and args.write:
            try:
                update_candidate(sb, c.id, updates)
                action = "UPDATED"
            except Exception as e:
                action = f"ERROR: {e}"
        else:
            action = "SKIP (dry-run or nothing new)"

        print(f"[{i}/{len(to_process)}] {c.name}: {action} -> {json.dumps(updates) if updates else '{}'}")

        # gentle rate limit
        time.sleep(args.delay)

    # Write report
    report_path = os.path.join(os.path.dirname(__file__), "..", "data", "candidate_links_report.json")
    report_path = os.path.abspath(report_path)
    with open(report_path, "w") as f:
        json.dump({
            "count": len(results),
            "write": args.write,
            "only_missing": args.only_missing,
            "results": results,
        }, f, indent=2)
    print(f"\nReport written to: {report_path}")


if __name__ == "__main__":
    main()
