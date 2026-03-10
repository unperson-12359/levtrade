export const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info'

export async function postHyperliquidInfo<T>(
  body: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 9_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Hyperliquid request failed: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }

  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown }
    return candidate.name === 'AbortError'
  }

  return false
}
