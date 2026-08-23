import { WEB_SOCKET_OPEN, type WebSocketLike } from '../api/web-socket';

/**
 * A socket the specs drive by hand.
 *
 * Everything worth asserting about a terminal is in its edges — the replay on open, the clean close
 * that must be final, the reconnect on anything else — and none of it is reachable through a real
 * `WebSocket`: it is opened by the browser, so `HttpTestingController` never sees it. This is the
 * other half of the `WEB_SOCKET_FACTORY` seam.
 */
export class FakeSocket implements WebSocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;
  closedByClient = false;
  readonly sent: string[] = [];

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closedByClient = true;
  }

  /** The server accepted the upgrade. */
  connect(): void {
    this.readyState = WEB_SOCKET_OPEN;
    this.onopen?.(new Event('open'));
  }

  /** One raw PTY frame. */
  deliver(text: string): void {
    this.onmessage?.(new MessageEvent<string>('message', { data: text }));
  }

  /** The server closed. 1000 is final; anything else makes the client reconnect. */
  serverClose(code: number): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { code }));
  }
}

/** Every socket a spec's component opened, newest last, and the factory that records them. */
export class FakeSockets {
  readonly opened: FakeSocket[] = [];

  readonly open = (url: string): WebSocketLike => {
    const socket = new FakeSocket(url);
    this.opened.push(socket);
    return socket;
  };

  get latest(): FakeSocket | undefined {
    return this.opened[this.opened.length - 1];
  }
}
