PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  current_role TEXT,
  photo_url TEXT,
  website TEXT,
  wikipedia_url TEXT,
  bio TEXT,
  ai_ballot_brief TEXT,
  ai_topic_stances TEXT,
  ai_position_vector TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motions (
  id TEXT PRIMARY KEY,
  resolution TEXT NOT NULL,
  motion_summary TEXT,
  meeting_date TEXT NOT NULL,
  meeting_url TEXT,
  meeting_type TEXT,
  topic TEXT,
  impact TEXT,
  report_numbers TEXT,
  calendar_event_url TEXT,
  agenda_url TEXT,
  minutes_url TEXT,
  source_dataset_id TEXT,
  source_api_url TEXT,
  source_portal_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  motion_id TEXT REFERENCES motions(id),
  motion_title TEXT NOT NULL,
  motion_summary TEXT,
  vote TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  meeting_url TEXT,
  meeting_type TEXT,
  topic TEXT,
  impact TEXT,
  confidence TEXT NOT NULL,
  ai_extraction_notes TEXT,
  verified_by TEXT,
  verified_at TEXT,
  source_text TEXT,
  report_numbers TEXT,
  data_source_row_id TEXT,
  source_dataset_id TEXT,
  source_row_id TEXT,
  source_api_url TEXT,
  source_portal_url TEXT,
  source_hash TEXT,
  calendar_event_url TEXT,
  agenda_url TEXT,
  minutes_url TEXT,
  fetched_at TEXT,
  processed_at TEXT,
  prompt_version TEXT,
  model_version TEXT,
  ai_response_tokens INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_stances (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  campaign_page_id TEXT,
  topic TEXT,
  title TEXT NOT NULL,
  stance_summary TEXT,
  quote TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_scroll_url TEXT,
  confidence TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motion_explainers (
  motion_key TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pairwise_briefs (
  id TEXT PRIMARY KEY,
  candidate_a_slug TEXT NOT NULL,
  candidate_b_slug TEXT NOT NULL,
  data TEXT NOT NULL
);

DELETE FROM pairwise_briefs;
DELETE FROM motion_explainers;
DELETE FROM platform_stances;
DELETE FROM votes;
DELETE FROM motions;
DELETE FROM candidates;

INSERT INTO candidates VALUES
('cand-farkas', 'Jeromy Farkas', 'jeromy-farkas', 'Former councillor and 2025 mayor-elect', NULL, 'https://www.jeromy.ca/', 'https://en.wikipedia.org/wiki/Jeromy_Farkas', 'Former Ward 11 councillor with a record of scrutinizing city finances and governance decisions.', '{"brief":"Farkas had a visible voting record on fiscal restraint, governance, and city-building files during his time on council.","strengths":["Clear record on budget and accountability files","Recognizable civic profile before the 2025 mayoral race"],"tradeoffs":["Older council record requires context","Campaign platform still needs separate reading"],"top_votes":[],"citations":[{"label":"Calgary Open Data","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}', '{"Budget":{"topic":"Budget","stance":"Frequently framed votes through cost and accountability concerns.","confidence":0.74,"coverage":0.62,"citations":[{"label":"Council vote records","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}}', '{"topic_scores":{"Budget":0.8,"Transit":0.45,"Housing":0.52},"consistency":0.71}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('cand-gondek', 'Jyoti Gondek', 'jyoti-gondek', 'Mayor of Calgary, 2021-2025', NULL, 'https://www.jyotigondek.ca/', 'https://en.wikipedia.org/wiki/Jyoti_Gondek', 'Mayor during a council term shaped by housing, transit, budget, and public-safety debates.', '{"brief":"Gondek had the deepest recent mayoral record in the dataset because she served throughout the 2021-2025 council term.","strengths":["Large recent voting sample","Direct accountability for council-era priorities"],"tradeoffs":["Mayoral votes differ from ward-councillor votes","Record should be read alongside implementation results"],"top_votes":[],"citations":[{"label":"Calgary Open Data","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}', '{"Housing":{"topic":"Housing","stance":"Supported several files connected to housing supply and planning reform.","confidence":0.78,"coverage":0.7,"citations":[{"label":"Council vote records","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}}', '{"topic_scores":{"Housing":0.82,"Transit":0.72,"Budget":0.58},"consistency":0.76}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('cand-davison', 'Jeff Davison', 'jeff-davison', 'Former councillor', NULL, 'https://www.jeffdavison.ca/', NULL, 'Former Ward 6 councillor with a record across economic development, budget, and infrastructure files.', NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('cand-sharp', 'Sonya Sharp', 'sonya-sharp', 'Councillor', NULL, 'https://www.sonyasharp.ca/', NULL, 'Councillor with recent votes across housing, community services, public safety, and budget files.', NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO motions VALUES
('motion-housing-001', 'Council considered a package of land-use and permitting changes intended to increase housing supply and reduce approval delays.', 'Housing supply and permitting reform package', '2024-05-14', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Housing', 'high', '["C2024-0499"]', 'https://www.calgary.ca/council/meetings.html', NULL, NULL, 'ruq3-99hx', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('motion-transit-001', 'Council reviewed transit service reliability and capital-priority changes for high-demand corridors.', 'Transit reliability and corridor priority update', '2024-09-17', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Transit', 'medium', '["TT2024-0931"]', 'https://www.calgary.ca/council/meetings.html', NULL, NULL, 'ruq3-99hx', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('motion-budget-001', 'Council debated operating budget adjustments, service levels, and tax-impact tradeoffs for the next cycle.', 'Operating budget adjustment package', '2025-02-04', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Budget', 'high', '["C2025-0120"]', 'https://www.calgary.ca/council/meetings.html', NULL, NULL, 'ruq3-99hx', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('motion-safety-001', 'Council considered community safety grants, emergency-response capacity, and prevention programming.', 'Community safety funding and response capacity', '2025-04-22', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Public Safety', 'medium', '["C2025-0375"]', 'https://www.calgary.ca/council/meetings.html', NULL, NULL, 'ruq3-99hx', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('motion-governance-001', 'Council reviewed governance reporting, committee process changes, and public accountability practices.', 'Governance reporting and accountability process update', '2025-06-10', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Governance', 'low', '["EC2025-0610"]', 'https://www.calgary.ca/council/meetings.html', NULL, NULL, 'ruq3-99hx', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO votes VALUES
('vote-001', 'cand-gondek', 'motion-housing-001', 'Housing reform package', 'Housing supply and permitting reform package', 'for', '2024-05-14', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Housing', 'high', 'ai_generated', 'Representative local seed row for archived app inspection.', NULL, NULL, 'Council considered a package of land-use and permitting changes.', '["C2024-0499"]', NULL, 'ruq3-99hx', 'row-local-001', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 120, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-002', 'cand-sharp', 'motion-housing-001', 'Housing reform package', 'Housing supply and permitting reform package', 'for', '2024-05-14', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Housing', 'high', 'ai_generated', 'Representative local seed row for archived app inspection.', NULL, NULL, 'Council considered a package of land-use and permitting changes.', '["C2024-0499"]', NULL, 'ruq3-99hx', 'row-local-002', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 118, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-003', 'cand-farkas', 'motion-housing-001', 'Housing reform package', 'Housing supply and permitting reform package', 'against', '2024-05-14', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Housing', 'high', 'ai_generated', 'Representative local seed row for archived app inspection.', NULL, NULL, 'Council considered a package of land-use and permitting changes.', '["C2024-0499"]', NULL, 'ruq3-99hx', 'row-local-003', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 110, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-004', 'cand-gondek', 'motion-transit-001', 'Transit reliability update', 'Transit reliability and corridor priority update', 'for', '2024-09-17', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Transit', 'medium', 'ai_generated', NULL, NULL, NULL, 'Council reviewed transit service reliability.', '["TT2024-0931"]', NULL, 'ruq3-99hx', 'row-local-004', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 102, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-005', 'cand-davison', 'motion-transit-001', 'Transit reliability update', 'Transit reliability and corridor priority update', 'for', '2024-09-17', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Transit', 'medium', 'ai_generated', NULL, NULL, NULL, 'Council reviewed transit service reliability.', '["TT2024-0931"]', NULL, 'ruq3-99hx', 'row-local-005', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 98, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-006', 'cand-farkas', 'motion-budget-001', 'Operating budget adjustment', 'Operating budget adjustment package', 'against', '2025-02-04', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Budget', 'high', 'ai_generated', NULL, NULL, NULL, 'Council debated operating budget adjustments.', '["C2025-0120"]', NULL, 'ruq3-99hx', 'row-local-006', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 105, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-007', 'cand-gondek', 'motion-budget-001', 'Operating budget adjustment', 'Operating budget adjustment package', 'for', '2025-02-04', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Budget', 'high', 'ai_generated', NULL, NULL, NULL, 'Council debated operating budget adjustments.', '["C2025-0120"]', NULL, 'ruq3-99hx', 'row-local-007', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 109, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-008', 'cand-sharp', 'motion-safety-001', 'Community safety funding', 'Community safety funding and response capacity', 'for', '2025-04-22', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Public Safety', 'medium', 'ai_generated', NULL, NULL, NULL, 'Council considered community safety grants.', '["C2025-0375"]', NULL, 'ruq3-99hx', 'row-local-008', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 92, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('vote-009', 'cand-davison', 'motion-governance-001', 'Governance process update', 'Governance reporting and accountability process update', 'for', '2025-06-10', 'https://www.calgary.ca/council/meetings.html', 'Regular Meeting of Council', 'Governance', 'low', 'ai_generated', NULL, NULL, NULL, 'Council reviewed governance reporting.', '["EC2025-0610"]', NULL, 'ruq3-99hx', 'row-local-009', 'https://data.calgary.ca/resource/ruq3-99hx.json', 'https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'local-seed-v1', 'gpt-5-mini@archive-note', 80, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO platform_stances VALUES
('stance-001', 'cand-farkas', NULL, 'Budget', 'Budget restraint', 'Campaign material emphasized tax pressure and closer budget scrutiny.', 'We need to make city hall accountable for every dollar.', 'https://www.jeromy.ca/', NULL, 'ai_generated', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
('stance-002', 'cand-gondek', NULL, 'Housing', 'Housing supply', 'Campaign and public material emphasized housing supply and city-building priorities.', 'Calgary needs housing choices that meet people where they are.', 'https://www.jyotigondek.ca/', NULL, 'ai_generated', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO motion_explainers VALUES
('C2024-0499', '{"eli5":"This package was about making it easier to add more homes and reduce friction in approvals.","why_it_matters":"Housing was one of the central affordability files in the 2025 election context.","key_impacts":["More supply paths","Faster approvals","Tradeoffs around neighbourhood change"],"citations":[{"label":"Calgary Open Data","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}'),
('C2025-0120', '{"eli5":"This motion bundled budget changes and service-level tradeoffs into one council decision.","why_it_matters":"Budget votes are useful for comparing how candidates balance taxes, services, and restraint.","key_impacts":["Tax impact","Service levels","Long-term fiscal positioning"],"citations":[{"label":"Calgary Open Data","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}');

INSERT INTO pairwise_briefs VALUES
('pair-farkas-gondek', 'jeromy-farkas', 'jyoti-gondek', '{"agree":["Both records include high-salience city-building files."],"disagree":["The local seed shows a split on the housing package and budget package."],"notable_agreement":"Both appeared in enough council data to compare across multiple topics.","meaningful_contrast":"The strongest contrast in this sample is budget restraint versus service/investment framing.","citations":[{"label":"Calgary Open Data","url":"https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"}]}');
