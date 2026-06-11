import { NextResponse } from 'next/server'
import { getFilteredMotions, getFilteredMotionsCount } from '@/lib/localData'
import { parseArray } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q') || undefined
  const topics = parseArray(searchParams.get('topics'))
  const candidates = parseArray(searchParams.get('candidates'))
  const impactHigh = searchParams.get('impact') === 'high'
  const limit = parseInt(searchParams.get('limit') || '120', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const [motions, total] = await Promise.all([
      getFilteredMotions({ q, topics, candidateIds: candidates, impactHigh, limit, offset }),
      getFilteredMotionsCount({ q, topics, candidateIds: candidates, impactHigh })
    ])

    return NextResponse.json({ motions, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

