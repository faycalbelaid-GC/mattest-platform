import type { WsMessage } from '../types'

type Handler = (msg: WsMessage) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Set<Handler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${window.location.host}/ws`)

    this.ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data)
        this.handlers.forEach(h => h(msg))
      } catch {}
    }

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }

    this.ws.onerror = () => this.ws?.close()
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }

  subscribe(handler: Handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  ping() {
    this.ws?.send('ping')
  }
}

export const wsClient = new WsClient()
