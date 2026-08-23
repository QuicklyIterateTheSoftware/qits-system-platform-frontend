import { InjectionToken } from '@angular/core';

/**
 * The part of `WebSocket` this application uses, named so a spec can hand over something else.
 *
 * A socket is opened by the browser and never goes through `HttpClient`, so
 * `HttpTestingController` has nothing to intercept — and everything worth testing about a terminal
 * attachment is in its edges: the replay that arrives on every open, the clean close that must not
 * be retried into, the backoff that must be. None of it is reachable without driving `onopen`,
 * `onmessage` and `onclose` by hand.
 *
 * It is deliberately smaller than the real thing — no `binaryType`, because this service's terminal
 * socket is text in both directions, and no `addEventListener`, because one handler each is all
 * anything here sets.
 *
 * `close()` takes no arguments on purpose. The client never closes with a code; only the *server's*
 * code is read, and a 1000 from the server means "this terminal is finished", which this client
 * must not be able to fake.
 */
export interface WebSocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  readonly readyState: number;
  send(data: string): void;
  close(): void;
}

/** `WebSocket.OPEN` — the only state in which {@link WebSocketLike.send} is allowed to be called. */
export const WEB_SOCKET_OPEN = 1;

/** Opens a socket at an absolute `ws://` or `wss://` URL. One function, so a fake is one function. */
export type WebSocketFactory = (url: string) => WebSocketLike;

/** How this application opens a socket. */
export const WEB_SOCKET_FACTORY = new InjectionToken<WebSocketFactory>('qits.web-socket', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url) as WebSocketLike,
});
