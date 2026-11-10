// 수집 함수(sync-contests, sync-hacker-news) 공통 도구

// 실행 권한: 요청 헤더 x-sync-secret이 Supabase secrets의 SYNC_SECRET과 같아야 한다.
// (함수는 --no-verify-jwt로 배포하므로 이 확인이 유일한 문지기다)
export function isAuthorized(request: Request): boolean {
  const secret = Deno.env.get('SYNC_SECRET')
  return Boolean(secret) && request.headers.get('x-sync-secret') === secret
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const forbidden = () =>
  json({ error: { code: 'FORBIDDEN', message: '실행 권한이 없습니다.' } }, 403)

// ?name=값 을 정수로 읽고 min~max 범위로 맞춘다. 없거나 이상하면 기본값.
export function intParam(request: Request, name: string, fallback: number, min: number, max: number) {
  const raw = new URL(request.url).searchParams.get(name)
  const value = raw === null ? fallback : Number(raw)
  return Math.min(Math.max(Number.isInteger(value) ? value : fallback, min), max)
}

export const USER_AGENT = 'team14-campus-roadmap-sync/0.1 (student project)'
