// Client Service for Server RTC Time Lock & Real-Time SSE Synchronization
// Single Source of Truth for Anti-Tamper Clock and Live Multi-Device Sync

export interface ServerTimeState {
  serverTimeMs: number;
  timeDriftMs: number;
  isSynced: boolean;
  isClockTampered: boolean;
  serverWibString: string;
}

export type RealtimeEventType = 
  | 'ATTENDANCE_SAVED' 
  | 'APPROVAL_UPDATED' 
  | 'APPROVAL_SUBMITTED'
  | 'EMPLOYEE_SAVED' 
  | 'EMPLOYEE_UPDATED'
  | 'SALARY_RULES_UPDATED' 
  | 'WORK_CALENDAR_UPDATED'
  | 'WORK_CALENDAR_PERIOD_TOGGLED'
  | 'PROJECT_SAVED'
  | 'AUDIT_LOG_ADDED'
  | 'CASUAL_ATTENDANCE_RECORDED'
  | 'CASUAL_ATTENDANCE_DELETED'
  | 'CASUAL_WORKER_SAVED'
  | 'RTC_RECONNECTED'
  | 'DATABASE_RESET'
  | string;

export interface RealtimePacket {
  type: RealtimeEventType;
  payload: any;
  serverTimeMs: number;
  serverTimestamp: string;
}

class RtcManager {
  private timeDriftMs: number = 0;
  private isSynced: boolean = false;
  private syncTimer: any = null;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private protocol: 'websocket' | 'sse' = 'websocket';
  private listeners: Map<string, Set<(packet: RealtimePacket) => void>> = new Map();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private isLiveConnected: boolean = false;
  private hasEverConnected: boolean = false;

  constructor() {
    this.syncServerTime();
    // Re-sync authoritative server clock every 60 seconds
    this.syncTimer = setInterval(() => this.syncServerTime(), 60000);
    this.initRealtimeStream();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncServerTime();
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.initRealtimeStream();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncServerTime();
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.initRealtimeStream();
          }
        }
      });
    }
  }

  // ========================================================
  // 1. AUTHORITATIVE SERVER RTC CLOCK (ANTI-TAMPER)
  // ========================================================
  public async syncServerTime(): Promise<number> {
    const clientSendTime = Date.now();
    try {
      const res = await fetch('/api/server-time', { cache: 'no-store' });
      if (res.ok) {
        const clientReceiveTime = Date.now();
        const roundTripLatency = (clientReceiveTime - clientSendTime) / 2;
        const data = await res.json();
        
        // Exact NTP drift calculation
        const authoritativeServerTime = data.serverTimeMs + roundTripLatency;
        this.timeDriftMs = authoritativeServerTime - clientReceiveTime;
        this.isSynced = true;
        return this.timeDriftMs;
      }
    } catch (e) {
      console.warn('[RTC] Server clock sync fallback', e);
    }
    return this.timeDriftMs;
  }

  /**
   * Returns authoritative Date object locked to Server RTC (Asia/Jakarta WIB)
   * Prevents employees from tampering with their device clock.
   */
  public getServerNow(): Date {
    return new Date(Date.now() + this.timeDriftMs);
  }

  /**
   * Checks if employee's local device clock has been manipulated by > 90 seconds
   */
  public isDeviceClockTampered(): boolean {
    return Math.abs(this.timeDriftMs) > 90000;
  }

  public getTimeDriftSeconds(): number {
    return Math.round(this.timeDriftMs / 1000);
  }

  public formatWibClock(): string {
    const now = this.getServerNow();
    return now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' WIB';
  }

  // ========================================================
  // 2. REAL-TIME DATA SYNCHRONIZATION (NATIVE WEBSOCKET ENGINE)
  // ========================================================
  public initRealtimeStream() {
    if (typeof window === 'undefined') return;

    // Use native WebSocket if available
    if (typeof window.WebSocket !== 'undefined') {
      this.initWebSocket();
      return;
    }

    // Fallback to SSE
    this.initSseFallback();
  }

  private initWebSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.protocol = 'websocket';
        this.isLiveConnected = true;
        this.notifyStatus(true);
        if (this.hasEverConnected) {
          this.dispatchPacket({
            type: 'RTC_RECONNECTED',
            payload: { protocol: 'websocket' },
            serverTimeMs: Date.now(),
            serverTimestamp: new Date().toISOString()
          });
        }
        this.hasEverConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const packet: RealtimePacket = JSON.parse(event.data);
          if (packet.type === 'CONNECTED') {
            this.isLiveConnected = true;
            this.notifyStatus(true);
            return;
          }
          if (packet.type === 'HEARTBEAT_PING') {
            this.ws?.send(JSON.stringify({ type: 'PING' }));
            return;
          }
          this.dispatchPacket(packet);
        } catch (err) {
          console.error('[RTC WS] Failed to parse realtime packet', err);
        }
      };

      this.ws.onclose = () => {
        this.isLiveConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[RTC WS] Connection error, will retry...', err);
        this.isLiveConnected = false;
        this.notifyStatus(false);
      };
    } catch (err) {
      console.warn('[RTC WS] Initialization failed, using SSE fallback', err);
      this.initSseFallback();
    }
  }

  private initSseFallback() {
    if (typeof window.EventSource === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      this.eventSource = new EventSource('/api/realtime/stream');
      this.protocol = 'sse';

      this.eventSource.addEventListener('connected', () => {
        this.isLiveConnected = true;
        this.notifyStatus(true);
        if (this.hasEverConnected) {
          this.dispatchPacket({
            type: 'RTC_RECONNECTED',
            payload: { protocol: 'sse' },
            serverTimeMs: Date.now(),
            serverTimestamp: new Date().toISOString()
          });
        }
        this.hasEverConnected = true;
      });

      this.eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          const packet: RealtimePacket = JSON.parse(event.data);
          this.dispatchPacket(packet);
        } catch (err) {
          console.error('[RTC SSE] Failed to parse realtime packet', err);
        }
      });

      this.eventSource.onerror = () => {
        this.isLiveConnected = false;
        this.notifyStatus(false);
      };
    } catch (err) {
      this.isLiveConnected = false;
      this.notifyStatus(false);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 3000);
  }

  public getActiveProtocol(): 'websocket' | 'sse' {
    return this.protocol;
  }

  public sendPacket(type: string, payload: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, clientTimeMs: Date.now() }));
      return true;
    }
    return false;
  }

  public subscribe(eventType: RealtimeEventType | '*', callback: (packet: RealtimePacket) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.isLiveConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public getIsConnected(): boolean {
    return this.isLiveConnected;
  }

  private dispatchPacket(packet: RealtimePacket) {
    // Specific listeners
    const specificListeners = this.listeners.get(packet.type);
    if (specificListeners) {
      specificListeners.forEach(cb => cb(packet));
    }
    // Wildcard listeners
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(cb => cb(packet));
    }
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach(cb => cb(connected));
  }
}

export const rtcService = new RtcManager();
