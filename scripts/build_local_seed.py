"""Build frontend/data/local-seed.sql from Calgary Open Data.

Every vote row in the archive seed is an exact row from the Council and
Committee Votes dataset (ruq3-99hx), keyed by its Socrata row id so anyone can
check it against the source. Motion titles, topics, and impact levels are short
editorial labels; the full resolution text is stored verbatim.

Run from the repo root:  python3 scripts/build_local_seed.py
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

DATASET = "ruq3-99hx"
API = f"https://data.calgary.ca/resource/{DATASET}.json"
PORTAL = f"https://data.calgary.ca/Government/Council-and-Committee-Votes/{DATASET}"
STAMP = "2026-09-30T00:00:00Z"
SEED = Path(__file__).resolve().parent.parent / "frontend" / "data" / "local-seed.sql"

# Voter names as they appear in the dataset, per candidate.
CANDIDATES = [
    {
        "id": "cand-farkas",
        "name": "Jeromy Farkas",
        "slug": "jeromy-farkas",
        "current_role": "Ward 11 councillor, 2017-2021",
        "wikipedia_url": "https://en.wikipedia.org/wiki/Jeromy_Farkas",
        "bio": "Ward 11 councillor from 2017 to 2021 and a 2025 mayoral candidate. "
        "Won the October 2025 election. His council votes in this dataset run from October 2020 to September 2021.",
        "voters": ["Jeromy Farkas"],
    },
    {
        "id": "cand-gondek",
        "name": "Jyoti Gondek",
        "slug": "jyoti-gondek",
        "current_role": "Mayor of Calgary, 2021-2025",
        "wikipedia_url": "https://en.wikipedia.org/wiki/Jyoti_Gondek",
        "bio": "Ward 3 councillor from 2017 to 2021 and mayor from 2021 to 2025. "
        "Ran for re-election in 2025.",
        "voters": ["Jyoti Gondek", "Mayor J. Gondek"],
    },
    {
        "id": "cand-davison",
        "name": "Jeff Davison",
        "slug": "jeff-davison",
        "current_role": "Ward 6 councillor, 2017-2021",
        "wikipedia_url": None,
        "bio": "Ward 6 councillor from 2017 to 2021 and a 2025 mayoral candidate. "
        "His council votes in this dataset run from November 2020 to September 2021.",
        "voters": ["Jeff Davison"],
    },
    {
        "id": "cand-sharp",
        "name": "Sonya Sharp",
        "slug": "sonya-sharp",
        "current_role": "Ward 1 councillor, 2021-2025",
        "wikipedia_url": None,
        "bio": "Ward 1 councillor from 2021 to 2025 and a 2025 mayoral candidate.",
        "voters": ["Sonya Sharp"],
    },
]

# Contested council decisions where these candidates split. Each is matched by
# meeting date plus the start of the resolution text in the source dataset.
MOTIONS = [
    {
        "id": "motion-fluoride-2021",
        "date": "2021-02-01",
        "starts": "That with respect to Report C2021-0170, the following be adopted: That Council restore fluoride",
        "title": "Restore fluoride to the City's water supply",
        "topic": "Public Health",
        "impact": "high",
    },
    {
        "id": "motion-property-tax-2021",
        "date": "2021-03-22",
        "starts": "That with respect to Report C2021-0329",
        "title": "2021 Property Tax Bylaw",
        "topic": "Budget",
        "impact": "high",
    },
    {
        "id": "motion-face-coverings-2021",
        "date": "2021-07-05",
        "starts": "That with respect to Report C2021-1032, the following be adopted: That Council: Give three readings to Bylaw 59M2021",
        "title": "Repeal the Face Coverings Bylaw",
        "topic": "Public Health",
        "impact": "medium",
    },
    {
        "id": "motion-event-centre-2021",
        "date": "2021-07-26",
        "starts": "That with respect to Revised Report C2021-1164, the following be adopted: That Council: 2.",
        "title": "Event Centre: up to $10 million more for City costs",
        "topic": "Economic Development",
        "impact": "medium",
    },
    {
        "id": "motion-property-tax-2024",
        "date": "2024-03-19",
        "starts": "That with respect to Report C2024-0264, the following be adopted: That Council give three readings to: The proposed 2024 Property Tax Bylaw",
        "title": "2024 Property Tax Bylaw",
        "topic": "Budget",
        "impact": "high",
    },
    {
        "id": "motion-green-line-2024",
        "date": "2024-09-17",
        "starts": "That with respect to Verbal Report C2024-1045, the following be adopted: That Council:  Authorize the Green Line Board",
        "title": "Wind down the Green Line LRT program",
        "topic": "Transit",
        "impact": "high",
    },
    {
        "id": "motion-budget-2025",
        "date": "2024-11-22",
        "starts": "That Council: 1. Approve the plan and budget adjustments",
        "title": "2025 budget adjustments",
        "topic": "Budget",
        "impact": "high",
        "report_numbers": ["C2024-1097"],
    },
]

VOTE_MAP = {"Yes": "for", "No": "against", "Absent": "absent"}
REPORT_RE = re.compile(r"\b[A-Z]{1,4}\d{4}-\d{4}\b")


def fetch(where):
    params = {
        "$select": ":id,meetingtype,meetingdate,resolution,voter,vote,result",
        "$where": where,
        "$limit": "1000",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)


def squash(text):
    """Collapse whitespace; the source mixes newlines and double spaces."""
    return " ".join(text.split())


def sql(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def row(values):
    return "(" + ", ".join(sql(v) for v in values) + ")"


def main():
    voter_to_candidate = {v: c["id"] for c in CANDIDATES for v in c["voters"]}
    voter_list = ",".join(sql(v) for v in voter_to_candidate)

    motion_rows, vote_rows = [], []
    for motion in MOTIONS:
        rows = fetch(
            f"meetingdate='{motion['date']}T00:00:00.000' and voter in({voter_list})"
        )
        rows = [r for r in rows if squash(r["resolution"]).startswith(squash(motion["starts"]))]
        resolutions = {r["resolution"] for r in rows}
        if len(resolutions) != 1:
            raise SystemExit(f"{motion['id']}: expected 1 resolution, found {len(resolutions)}")
        resolution = resolutions.pop()
        first = rows[0]

        # Whole-council tally for the same decision, one row per voter.
        council = fetch(
            f"meetingdate='{motion['date']}T00:00:00.000' and resolution={sql(resolution)}"
        )
        by_voter = {r["voter"]: r["vote"] for r in council}
        tally = {v: sum(1 for x in by_voter.values() if x == v) for v in ("Yes", "No", "Absent")}
        reports = motion.get("report_numbers") or sorted(set(REPORT_RE.findall(resolution)))[:3]

        motion_rows.append(row([
            motion["id"], resolution, motion["title"], motion["date"], None,
            first["meetingtype"], motion["topic"], motion["impact"], json.dumps(reports),
            None, None, None, DATASET, API, PORTAL, STAMP, STAMP,
            first["result"].split()[-1].capitalize(), tally["Yes"], tally["No"], tally["Absent"],
        ]))

        for r in sorted(rows, key=lambda r: voter_to_candidate[r["voter"]]):
            row_id = r[":id"]
            api_url = API + "?" + urllib.parse.urlencode({"$where": f":id='{row_id}'"})
            vote_rows.append(row([
                f"vote-{row_id}", voter_to_candidate[r["voter"]], motion["id"],
                motion["title"], f"{first['result'].capitalize()}.", VOTE_MAP[r["vote"]],
                motion["date"], None, r["meetingtype"], motion["topic"], motion["impact"],
                "verified", None, f"Calgary Open Data {DATASET}", STAMP, resolution,
                json.dumps(reports), row_id, DATASET, row_id, api_url, PORTAL, None,
                None, None, None, STAMP, STAMP, None, None, None, STAMP, STAMP,
            ]))

    candidate_rows = [
        row([
            c["id"], c["name"], c["slug"], c["current_role"], None, None,
            c["wikipedia_url"], c["bio"], None, None, None, STAMP, STAMP,
        ])
        for c in CANDIDATES
    ]

    text = SEED.read_text()
    schema = text[: text.index("DELETE FROM")]
    if "council_result" not in schema:
        schema = schema.replace(
            "  source_portal_url TEXT,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS votes",
            "  source_portal_url TEXT,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n"
            "  council_result TEXT,\n  council_for INTEGER,\n  council_against INTEGER,\n  council_absent INTEGER\n);\n\n"
            "CREATE TABLE IF NOT EXISTS votes",
            1,
        )
        assert "council_result" in schema, "motions schema changed; update build_local_seed.py"
    out = [
        schema.rstrip(),
        "",
        "-- Generated by scripts/build_local_seed.py from Calgary Open Data (ruq3-99hx).",
        "-- Every vote is a verbatim source row; do not edit by hand.",
        "DELETE FROM pairwise_briefs;",
        "DELETE FROM motion_explainers;",
        "DELETE FROM platform_stances;",
        "DELETE FROM votes;",
        "DELETE FROM motions;",
        "DELETE FROM candidates;",
        "",
        "INSERT INTO candidates VALUES\n" + ",\n".join(candidate_rows) + ";",
        "",
        "INSERT INTO motions VALUES\n" + ",\n".join(motion_rows) + ";",
        "",
        "INSERT INTO votes VALUES\n" + ",\n".join(vote_rows) + ";",
        "",
    ]
    SEED.write_text("\n".join(out))
    print(f"Wrote {len(candidate_rows)} candidates, {len(motion_rows)} motions, {len(vote_rows)} votes")


if __name__ == "__main__":
    main()
