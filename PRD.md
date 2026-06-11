# CivicCheckYYC - Product Requirements Document

**Last Updated**: October 2025
**Election Day**: October 20, 2025

---

## Product Vision

CivicCheckYYC helps Calgary voters understand mayoral candidates through their historical council voting records, with AI-powered analysis to make complex governance accessible.

**Tagline**: What they say. What they did. What it means.

---

## Current Status

### ✅ Completed Features (Phase 1 + 1.5 + 2.5)

**Data Pipeline**:
- ✅ Automated data fetching from Calgary Open Data API
- ✅ AI processing with OpenAI GPT-5-mini
- ✅ Full provenance tracking (source links, hashes, timestamps)
- ✅ Database schema with migrations
- ✅ Link verification system

**AI Analysis**:
- ✅ Motion titles (max 120 chars, smart truncation)
- ✅ Plain-language summaries
- ✅ Topic classification (14 categories)
- ✅ Impact assessment (high/medium/low)
- ✅ Report number extraction

**Source Attribution**:
- ✅ Direct JSON API links (100% coverage)
- ✅ Portal UI links (~90-95% coverage)
- ✅ Calendar event links (~70-90% coverage)
- ✅ SHA-256 deduplication hashes
- ✅ Timestamped immutable archives

**Frontend**:
- ✅ Next.js 15 with TypeScript
- ✅ Candidate listing page
- ✅ Individual candidate pages
- ✅ Vote cards with confidence badges
- ✅ Topic badges
- ✅ Source links
- ✅ Mobile responsive
- ✅ Null-safe for candidates without voting records

---

## Data Source

**Primary**: [Calgary Open Data - Council and Committee Votes](https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx)
- Dataset ID: `ruq3-99hx`
- Records: 46,000+ votes (October 2020 - Present)
- Format: Socrata JSON API
- Update frequency: Real-time
- Fields: voter, resolution, vote, meeting date, meeting type

**Secondary**: [Calgary Council Calendar](https://data.calgary.ca/resource/23m4-i42g.json)
- Meeting metadata for calendar event links
- Match rate: 70-90%

---

## Tech Stack

### Backend
- **Language**: Python 3.9+
- **AI Model**: OpenAI GPT-5-mini (`gpt-5-mini@2025-10-01`)
- **API**: Calgary Open Data Socrata API
- **Dependencies**: openai, requests, supabase, python-dotenv

### Database
- **Platform**: Supabase (PostgreSQL)
- **Extensions**: uuid-ossp (for UUID generation)
- **Tables**: candidates, votes, meetings
- **Migrations**: 4 migrations (001-004)

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Custom React components
- **Deployment**: Vercel

---

## User Personas

### Primary: Calgary Voter (Oct 2025)
- **Goal**: Understand candidates before voting
- **Needs**: Clear, factual voting records with context
- **Pain**: Too much information, unclear what votes mean

### Secondary: Journalist/Researcher
- **Goal**: Verify candidate claims
- **Needs**: Source links, full voting history
- **Pain**: Time-consuming to fact-check

### Tertiary: Campaign Teams
- **Goal**: Understand opposition record
- **Needs**: Topic filtering, trend analysis
- **Pain**: Manual research required

---

## Core Features

### 1. Data Ingestion Pipeline

**Fetch Votes** (`backend/fetch_votes.py`)
- Fetch from Calgary Open Data API
- Generate SHA-256 source hashes for deduplication
- Extract Socrata row IDs (`:id` field)
- Capture timestamps (`fetched_at`)
- Save to `data/raw_votes.json`
- Create immutable archive in `data/archives/`

**AI Processing** (`backend/ai_processor.py`)
- Load versioned prompt from `backend/prompts/`
- Process with GPT-5-mini
- Generate:
  - Motion title (max 120 chars)
  - Plain-language summary (1-2 sentences, flexible)
  - Topic classification (14 categories)
  - Impact level (high/medium/low)
  - Report numbers (array)
- Enforce JSON output format
- Track token usage
- Checkpoint system (resume on interrupt)
- Save to `data/processed_votes.json`

**Upload** (`backend/upload_to_supabase.py`)
- Map councillor names to candidates
- Construct source URLs:
  - `source_api_url`: Direct JSON API
  - `source_portal_url`: Portal UI link
- Match votes to meetings for calendar links
- Deduplicate via `source_hash`
- Populate all provenance fields
- Display link coverage stats

**Verification** (`backend/verify_sources.py`)
- Test HTTP accessibility of all link types
- Validate JSON data integrity
- Calculate coverage statistics
- Generate timestamped report

### 2. Topic Classification

**14 Topic Categories**:

**Substantive Policy**:
- Housing
- Transit
- Budget
- PublicSafety
- Environment
- EconomicDevelopment
- Infrastructure
- SocialServices
- Planning

**Governance**:
- IndigenousRelations
- IntergovernmentalAffairs
- Governance
- Procedural

**Other**: Catch-all for unclassified votes

**Validation**: All topics validated against `VALID_TOPICS` in `backend/config.py`

### 3. Impact Assessment

**Three Levels**:
- **High**: Major policy changes, large budget items, significant community impact
- **Medium**: Important approvals, moderate budget, notable governance
- **Low**: Procedural votes, routine admin, minor approvals

**Usage**: Helps users prioritize which votes to read first

### 4. Confidence Badges

**Three States**:
- **AI Generated**: Default for all AI-processed votes
- **Under Review**: Flagged for human verification (future)
- **Verified**: Human-confirmed accuracy (future)

**Current**: All votes are "AI Generated"

### 5. Source Attribution (Phase 1)

**Every vote has**:
- `source_api_url`: Direct JSON API link (100% coverage)
- `source_portal_url`: Portal UI link (90-95% coverage)
- `source_hash`: SHA-256 deduplication hash
- `source_row_id`: Socrata row identifier
- `fetched_at`: When fetched from API
- `processed_at`: When processed by AI
- `prompt_version`: Prompt template version
- `model_version`: AI model identifier
- `ai_response_tokens`: Token count for cost tracking

### 6. Meeting Links (Phase 1.5 - Partial)

**Currently implemented**:
- `meetings` table with meeting metadata
- `calendar_event_url`: Links to Trumba calendar (70-90% coverage)
- Meeting date/type matching

**Not yet implemented**:
- `agenda_url`: Direct links to meeting agendas (Phase 1.5 Real)
- `minutes_url`: Direct links to meeting minutes (Phase 1.5 Real)
- eScribe scraping (`ENABLE_ESCRIBA_SCRAPING = False`)

---

## Database Schema

### candidates
- `id` (UUID): Primary key
- `name`: Candidate full name
- `slug`: URL-friendly identifier
- `current_role`: e.g., "Ward 1 Councillor"
- `photo_url`: Headshot URL
- `website`: Campaign website
- `bio`: Candidate biography
- Timestamps: `created_at`, `updated_at`

### votes
- `id` (UUID): Primary key
- `candidate_id` (UUID): FK to candidates
- `motion_title`: AI-generated title
- `motion_summary`: Plain-language summary
- `vote`: for | against | absent
- `meeting_date`: Date of vote
- `meeting_type`: e.g., "Regular Meeting of Council"
- `topic`: One of 14 categories
- `impact`: high | medium | low
- `confidence`: ai_generated | under_review | verified
- `report_numbers`: Array of report IDs
- Source fields: `source_api_url`, `source_portal_url`, `source_hash`, `source_row_id`
- Provenance: `fetched_at`, `processed_at`, `prompt_version`, `model_version`, `ai_response_tokens`
- Meeting links: `calendar_event_url`, `agenda_url`, `minutes_url`
- Metadata: `source_text`, `ai_extraction_notes`, `verified_by`, `verified_at`

### meetings
- `id` (UUID): Primary key
- `meeting_date`: Date
- `meeting_type`: Original type string
- `normalized_type`: Standardized for matching
- `calendar_event_url`: Trumba calendar link
- `calendar_event_id`: Extracted event ID
- `escriba_meeting_id`: eScribe GUID (future)
- `escriba_meeting_url`: eScribe meeting page (future)
- `agenda_url`: Agenda document link (future)
- `minutes_url`: Minutes document link (future)
- Metadata: `source_dataset_id`, `fetched_at`, `updated_at`

---

## Calgary 2025 Mayoral Candidates

**Total**: 9 candidates

**With Council Voting Records**:
1. **Jyoti Gondek** - Incumbent Mayor
2. **Jeromy Farkas** - Former Ward 11 Councillor
3. **Jeff Davison** - Former Councillor
4. **Sonya Sharp** - Ward 1 Councillor

**Without Voting Records**:
5. Grant Prior - Directional Driller
6. Brian Thiessen - Employment Lawyer
7. Sarah Elder - Business Owner
8. Jaeger Gustafson - Doctor of Acupuncture
9. Larry Heather - Frequent Candidate

---

## Cost & Performance

### AI Processing Costs (GPT-5-mini)
- **Average**: ~150 tokens per vote
- **Cost**: ~$0.00002 per vote
- **5,000 votes**: ~$0.10 USD
- **50,000 votes**: ~$1.00 USD

### Processing Time
- **With retry logic**: ~1.2 seconds per vote
- **5,000 votes**: ~100 minutes (~1.5 hours)
- **Checkpoint frequency**: Every 50 votes

### Link Verification
- **20 votes**: ~30 seconds
- **1,000 votes**: ~20 minutes
- **Timeout**: 10 seconds per request

---

## Expected Coverage Rates

| Link Type | Expected | Notes |
|-----------|----------|-------|
| `source_api_url` | **100%** | Direct Socrata API - always available |
| `source_portal_url` | **90-95%** | Portal UI - depends on row ID |
| `calendar_event_url` | **70-90%** | Requires date/type matching |
| `agenda_url` | **40-60%** | Older meetings may lack digital docs |
| `minutes_url` | **40-60%** | Only finalized meetings |

---

## Future Enhancements (Post-Launch)

### Phase 1.5 Real: eScribe Scraper
- Implement eScribe meeting search
- Extract agenda/minutes URLs
- Add rate limiting and caching
- Dependencies: BeautifulSoup, lxml

### Phase 2: Verification Workflow
- Admin dashboard for manual verification
- Flag inaccurate AI extractions
- Bulk verification tools
- Verified badge system

### Phase 3: Advanced Features
- Topic filtering on frontend
- Vote comparison across candidates
- Campaign promises vs voting record
- Search functionality
- Export to CSV/PDF
- Email alerts for new votes

### Phase 4: Expansion
- Calgary council ward candidates
- Other Alberta municipalities
- Historical trend analysis
- Data visualizations

---

## Known Limitations

1. **AI Accuracy**: Not human-verified yet (all votes marked "AI Generated")
2. **Portal Links**: Relies on Socrata row ID availability
3. **Meeting Matching**: 70-90% match rate (date/type normalization)
4. **eScribe Links**: Not yet implemented (agenda/minutes)
5. **Historical Data**: Only back to October 2020 (dataset limitation)
6. **Real-time Updates**: Manual re-run required (no automation yet)

---

## Success Metrics

### Pre-Launch (MVP)
- ✅ 5,000+ votes in database
- ✅ All 9 candidates populated
- ✅ 100% source_api_url coverage
- ✅ >90% source_portal_url coverage
- ✅ Frontend deployed to Vercel
- ✅ Mobile responsive

### Post-Launch (Week 1)
- [ ] 1,000+ unique visitors
- [ ] 50+ returning users
- [ ] Average session: 3+ minutes
- [ ] <1% reported inaccuracies
- [ ] Mentioned by 1+ Calgary news outlet

### Ongoing
- [ ] Weekly data updates
- [ ] Human verification of top 100 votes
- [ ] User feedback mechanism
- [ ] Topic filter usage >20%

---

## Governance & Ethics

### Transparency
- All AI-generated content labeled as such
- Source links provided for every vote
- No editorial bias in content
- Clear about limitations

### Data Integrity
- Deduplication via SHA-256 hashes
- Immutable archives for audit trail
- Version tracking for prompts and models
- Link verification for quality assurance

### Privacy
- No user data collection (read-only public data)
- No tracking beyond basic analytics
- No user accounts (public access only)
- Calgary Open Data is public domain

### Neutrality
- Not affiliated with any campaign or party
- Equal treatment of all candidates
- No editorializing in summaries
- No vote recommendations

---

## Deployment

**Backend**: Run locally or GitHub Actions (future automation)
**Frontend**: Vercel (continuous deployment from main branch)
**Database**: Supabase (cloud-hosted PostgreSQL)

**Environment Variables**:
- `OPENAI_KEY`: OpenAI API key
- `SUPABASE_PROJECT_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service key (backend only)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL (frontend)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (frontend)

---

## Next Steps

See `START_HERE.md` for implementation TODO checklist.
