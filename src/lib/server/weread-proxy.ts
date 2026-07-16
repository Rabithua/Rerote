import { ProxyAgent, fetch as undiciFetch } from 'undici'

const WEREAD_GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'
const UPSTREAM_TIMEOUT_MS = 30_000
const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy
const proxyDispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const ALLOWED_APIS = new Set([
  '/user/notebooks',
  '/book/bookmarklist',
  '/review/list/mine',
])

export async function proxyWereadRequest(request: Request): Promise<Response> {
  const authorization = request.headers.get('Authorization')
  if (!authorization || !/^Bearer wrk-.+$/u.test(authorization)) {
    return Response.json(
      { errmsg: '缺少有效的微信读书 API Key' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ errmsg: '请求数据不是有效的 JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ errmsg: '请求数据格式无效' }, { status: 400 })
  }
  const apiName = (body as Record<string, unknown>).api_name
  if (typeof apiName !== 'string' || !ALLOWED_APIS.has(apiName)) {
    return Response.json(
      { errmsg: '不允许调用该微信读书接口' },
      { status: 403 },
    )
  }

  let response
  try {
    response = await undiciFetch(WEREAD_GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      dispatcher: proxyDispatcher,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      return Response.json(
        { errmsg: '连接微信读书服务超时，请重试' },
        { status: 504 },
      )
    }
    return Response.json(
      { errmsg: '无法连接微信读书服务，请稍后重试' },
      { status: 502 },
    )
  }
  const responseBody = await response.text()

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type':
        response.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
}
