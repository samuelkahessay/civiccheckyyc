import { NextResponse } from 'next/server'
import { getFilteredCandidates, getFilteredCandidatesCount } from '@/lib/supabase'
import { parseArray } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q') || undefined
  const topics = parseArray(searchParams.get('topics'))
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const [candidates, total] = await Promise.all([
      getFilteredCandidates({ q, topics, limit, offset }),
      getFilteredCandidatesCount({ q, topics })
    ])

    return NextResponse.json({ candidates, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
