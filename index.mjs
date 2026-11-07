/**
 * dsh-plugin-balance — server half.
 *
 * Reads the signed-in account's balance through the host's own `deepseekAccount`
 * service (the same one the Account settings page uses) and exposes it as a
 * read-only JSON route for `client.js`. No token, no API key, no Platform call
 * made by this plugin: the host already holds the credential and does the work.
 *
 * Route: GET /dsh-plugin-balance/state
 *   { ok: true,  balance: 12.34, currency: "CNY", raw: <service payload> }
 *   { ok: false, error: "..." }
 */

export const name = 'dsh-plugin-balance'

const ROUTE = '/dsh-plugin-balance/state'

/** Build the current time zone offset in seconds (east of UTC is positive). */
function timezoneOffsetSeconds() {
  try {
    return -new Date().getTimezoneOffset() * 60
  } catch {
    return 0
  }
}

/**
 * The account metadata every account call carries. The shape is the host's own
 * `accountClientMetadata(locale, version)` result: version, locale, offset.
 * The version string is informational — the host labels the requesting UI with it.
 */
function clientMetadata() {
  return {
    version: '0.1.0',
    locale: 'zh',
    timezoneOffsetSeconds: timezoneOffsetSeconds(),
  }
}

/** Walk a nested payload for the first plausible money value. */
function pickNumber(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value !== 'object') return null
  for (const key of ['balance', 'amount', 'total', 'remaining', 'available', 'value', 'cash']) {
    if (key in value) {
      const n = pickNumber(value[key], depth + 1)
      if (n !== null) return n
    }
  }
  for (const child of Object.values(value)) {
    const n = pickNumber(child, depth + 1)
    if (n !== null) return n
  }
  return null
}

/** Walk a nested payload for a currency code. */
function pickCurrency(value, depth = 0) {
  if (value === null || value === undefined || typeof value !== 'object' || depth > 6) return null
  for (const key of ['currency', 'currencyCode', 'unit']) {
    const v = value[key]
    if (typeof v === 'string' && v.trim()) return v.trim().toUpperCase()
  }
  for (const child of Object.values(value)) {
    const c = pickCurrency(child, depth + 1)
    if (c) return c
  }
  return null
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function mount(host) {
  const server = host && host.webServer
  if (!server || typeof server.register !== 'function') return
  if (typeof host.effect !== 'function') return

  host.effect(() =>
    server.register({
      kind: 'exact',
      path: ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        try {
          const account = host.deepseekAccount
          if (!account || typeof account.getBalance !== 'function') {
            sendJson(res, 200, { ok: false, error: 'deepseekAccount.getBalance is unavailable' })
            return
          }
          const payload = await account.getBalance(clientMetadata())
          sendJson(res, 200, {
            ok: true,
            balance: pickNumber(payload),
            currency: pickCurrency(payload) || 'CNY',
            raw: payload,
          })
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error && error.message ? error.message : String(error) })
        }
      },
    }),
  )
}

export function apply(ctx) {
  if (!ctx) return
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['webServer', 'deepseekAccount'], (host) => mount(host))
      return
    } catch {
      /* fall through to a direct check */
    }
  }
  if (ctx.webServer && ctx.deepseekAccount) mount(ctx)
}
