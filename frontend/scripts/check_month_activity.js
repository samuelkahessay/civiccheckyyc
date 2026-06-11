// Count votes in given month using Supabase
// Usage: node scripts/check_month_activity.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvFromDotenv() {
  const envPath = path.resolve(__dirname, '../../.env')
  if (!fs.existsSync(envPath)) return {}
  const text = fs.readFileSync(envPath, 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.+?)"?\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

async function main() {
  const env = { ...process.env, ...loadEnvFromDotenv() }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PROJECT_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing Supabase env (URL/KEY).')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  async function countMonth(yyyy, mm /* 1-12 */) {
    const start = `${yyyy}-${String(mm).padStart(2, '0')}-01`
    const endMonth = mm === 12 ? { y: yyyy + 1, m: 1 } : { y: yyyy, m: mm + 1 }
    const end = `${endMonth.y}-${String(endMonth.m).padStart(2, '0')}-01`
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .gte('meeting_date', start)
      .lt('meeting_date', end)
    if (error) throw error
    return count || 0
  }

  const aug2025 = await countMonth(2025, 8)
  const oct2025 = await countMonth(2025, 10)

  console.log(JSON.stringify({ aug2025, oct2025 }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })

