type MessageHandler = (data: unknown) => void

interface Subscription {
  key: string
  sub: Record<string, unknown>
  handler: MessageHandler
}

const WS_URL = 'wss://api.hyperliquid.xyz/ws'
const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000

export class HyperliquidWS {
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Subscription>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = INITIAL_RECONNECT_DELAY
  private intentionalClose = false
  private statusCallback: ((status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) | null = null

  onStatusChange(cb: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void): void {
    this.statusCallback = cb
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.intentionalClose = false
    this.statusCallback?.('connecting')

    try {
      this.ws = new WebSocket(WS_URL)
    } catch {
      this.statusCallback?.('error')
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_DELAY
      this.statusCallback?.('connected')
      // Resubscribe all active subscriptions
      for (const sub of this.subscriptions.values()) {
        this.sendSubscribe(sub.sub)
      }
    }

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event)
    }

    this.ws.onclose = () => {
      this.statusCallback?.('disconnected')
      if (!this.intentionalClose) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      this.statusCallback?.('error')
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.statusCallback?.('disconnected')
  }

  /** Subscribe to a channel. Returns an unsubscribe function. */
  subscribe(sub: Record<string, unknown>, handler: MessageHandler): () => void {
    const key = JSON.stringify(sub)
    this.subscriptions.set(key, { key, sub, handler })

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(sub)
    }

    return () => {
      this.subscriptions.delete(key)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscribe(sub)
      }
    }
  }

  private sendSubscribe(sub: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify({ method: 'subscribe', subscription: sub }))
  }

  private sendUnsubscribe(sub: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify({ method: 'unsubscribe', subscription: sub }))
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const msg = JSON.parse(event.data as string) as { channel?: string; data?: unknown }
      if (!msg.channel) return

      // Route to matching handlers
      for (const sub of this.subscriptions.values()) {
        const subType = sub.sub.type as string | undefined
        if (subType && msg.channel === subType) {
          sub.handler(msg.data)
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)
      this.connect()
    }, this.reconnectDelay)
  }
}
