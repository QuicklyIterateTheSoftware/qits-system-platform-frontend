import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import { routes } from '../app.routes';
import { WEB_SOCKET_FACTORY } from '../api/web-socket';
import { FakeSockets } from '../testing/fake-socket';
import { settle as settleFixture } from '../testing/settle';

const NODE = {
  id: 'n1',
  hostname: 'wohlben',
  role: 'manager',
  availability: 'Active',
  status: 'Ready',
};

const CONTAINER = {
  id: 'f3a9c2e18b7d4a6f5c0e9b2d7a1f8c3e5b6d9a0f2c4e7b1d8a3f6c9e2b5d7a0f',
  name: 'qits-platform-idp.1.abc',
  image: 'qits/platform-idp:2026.822.1',
  state: 'running',
  status: 'Up 3 hours',
  createdAt: '2026-08-23T09:00:00Z',
  ports: '8080/tcp',
};

const CONTAINERS_URL = '/system/api/nodes/n1/containers';

/**
 * A node's containers, and the two buttons an operator actually came for.
 *
 * The exec assertions are the point of the file: **the body must spell `container`**, because a
 * `containerId` is a 400 that reads on screen as "this image has no bash"; and **the press must
 * navigate**, because a terminal created and not opened is a PTY nobody will ever close.
 */
describe('NodeContainersTab', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let sockets: FakeSockets;

  beforeEach(() => {
    sockets = new FakeSockets();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideQitsNavigationLinks([]),
        { provide: WEB_SOCKET_FACTORY, useValue: sockets.open },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  const settle = () => settleFixture(harness.fixture);

  /** Open the tab with the node's own read already answered — this file is about the tab. */
  async function open(): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create('/swarm/nodes/n1/containers');
    http.expectOne('/system/api/swarm/nodes/n1').flush(NODE);
    return harness.routeNativeElement as HTMLElement;
  }

  function text(element: HTMLElement): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
  }

  it('says it is working, then draws a row per container', async () => {
    const page = await open();
    expect(text(page)).toContain('Loading the containers');

    http.expectOne((request) => request.url === CONTAINERS_URL).flush([CONTAINER]);
    await settle();

    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(text(page)).toContain('qits-platform-idp.1.abc');
    expect(text(page)).toContain('f3a9c2e18b7d');
    expect(text(page)).toContain('Up 3 hours');
    expect(text(page)).toContain('8080/tcp');
  });

  it('says so when the node runs nothing at all', async () => {
    const page = await open();
    http.expectOne((request) => request.url === CONTAINERS_URL).flush([]);
    await settle();

    expect(text(page)).toContain('This node is running no containers');
  });

  it('reports a failed read rather than an empty table', async () => {
    const page = await open();
    http
      .expectOne((request) => request.url === CONTAINERS_URL)
      .flush({ message: 'docker is unreachable' }, { status: 503, statusText: 'Unavailable' });
    await settle();

    expect(text(page)).toContain('Could not load the containers — 503 docker is unreachable');
  });

  /**
   * v1's boundary, not an outage. A red bar here would send an operator looking for a broken node.
   */
  it('draws a foreign node as a card in the service’s own words', async () => {
    const page = await open();
    http
      .expectOne((request) => request.url === CONTAINERS_URL)
      .flush(
        { code: 'NODE_REMOTE', message: 'only the local node is reachable in v1' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(text(page)).toContain('This node is not reachable from here');
    expect(text(page)).toContain('only the local node is reachable in v1');
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelector('table')).toBeNull();
  });

  it('opens a shell with a flat body naming the container, then goes to it', async () => {
    const page = await open();
    http.expectOne((request) => request.url === CONTAINERS_URL).flush([CONTAINER]);
    await settle();

    button(page, 'bash')?.click();
    const request = http.expectOne('/system/api/terminals');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      kind: 'EXEC',
      container: CONTAINER.id,
      shell: 'bash',
    });
    request.flush(
      {
        id: 't5',
        kind: 'EXEC',
        container: { id: CONTAINER.id, name: CONTAINER.name },
        shell: 'bash',
      },
      { status: 201, statusText: 'Created' },
    );
    await settle();

    // The node rides along so the terminal page's back link knows where the reader came from.
    expect(router.url).toBe('/terminals/t5?node=n1');
    http.expectOne('/system/api/terminals/t5').flush({ id: 't5', kind: 'EXEC', container: null });
    await settle();
  });

  it('asks for sh with the other button, and for nothing else', async () => {
    const page = await open();
    http.expectOne((request) => request.url === CONTAINERS_URL).flush([CONTAINER]);
    await settle();

    button(page, 'sh')?.click();
    const request = http.expectOne('/system/api/terminals');
    expect(request.request.body).toEqual({ kind: 'EXEC', container: CONTAINER.id, shell: 'sh' });
    request.flush({ id: 't6', kind: 'EXEC', container: null, shell: 'sh' });
    await settle();

    http.expectOne('/system/api/terminals/t6').flush({ id: 't6', kind: 'EXEC', container: null });
    await settle();
  });

  /** A container without that shell is the ordinary case, and it must be a sentence, not a crash. */
  it('says why a shell did not open, and stays on the table', async () => {
    const page = await open();
    http.expectOne((request) => request.url === CONTAINERS_URL).flush([CONTAINER]);
    await settle();

    button(page, 'bash')?.click();
    http
      .expectOne('/system/api/terminals')
      .flush({ message: 'container is not running' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(text(page)).toContain('Could not open bash in qits-platform-idp.1.abc');
    expect(text(page)).toContain('409 container is not running');
    expect(router.url).toBe('/swarm/nodes/n1/containers');
  });

  it('shows the tail of a log on demand, and closes it again', async () => {
    const page = await open();
    http.expectOne((request) => request.url === CONTAINERS_URL).flush([CONTAINER]);
    await settle();

    button(page, 'logs')?.click();
    const request = http.expectOne(
      (candidate) => candidate.url === `${CONTAINERS_URL}/${CONTAINER.id}/logs`,
    );
    expect(request.request.params.get('tail')).toBe('200');
    request.flush({ text: 'started on :8080', truncated: true });
    await settle();

    expect(text(page)).toContain('started on :8080');
    expect(text(page)).toContain('The service cut this log short');

    button(page, 'Close')?.click();
    await settle();
    expect(text(page)).not.toContain('started on :8080');
  });
});
