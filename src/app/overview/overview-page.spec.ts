import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import { routes } from '../app.routes';
import { WEB_SOCKET_FACTORY } from '../api/web-socket';
import { FakeSockets } from '../testing/fake-socket';
import { settle as settleFixture } from '../testing/settle';

const OVERVIEW = {
  host: {
    hostname: 'wohlben',
    os: 'Fedora Linux 42',
    kernelVersion: '6.6.87.2',
    architecture: 'x86_64',
    cpus: 8,
    memoryBytes: 16_000_000_000,
    dockerVersion: '28.5.2',
  },
  usage: {
    imagesBytes: 40_000_000_000,
    containersBytes: 1_000_000_000,
    volumesBytes: 20_000_000_000,
    buildCacheBytes: 7_000_000_000,
  },
  swarm: { state: 'active', nodeId: 'n1', managers: 1, nodes: 1 },
};

/**
 * The front door, and the one rule on it that costs somebody else's screen if it breaks.
 *
 * **Leaving detaches; it does not delete.** `POST /terminals {kind:"GLANCES"}` is find-or-create, so
 * the session this page attaches to may be one another operator is already watching. The service
 * ends it a few seconds after the LAST viewer detaches, which is why this page never sends a DELETE
 * on the way out. The spec asserts the *absence* of that DELETE, which is the only way an absence
 * gets defended.
 */
describe('OverviewPage', () => {
  let http: HttpTestingController;
  let sockets: FakeSockets;
  let harness: RouterTestingHarness;

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
  });

  afterEach(() => http.verify());

  async function open(): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create('/');
    return harness.routeNativeElement as HTMLElement;
  }

  const settle = () => settleFixture(harness.fixture);

  function text(element: HTMLElement): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('says it is working before either answer arrives', async () => {
    const page = await open();
    expect(text(page)).toContain('Reading the host');
    expect(text(page)).toContain('Starting glances');

    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await harness.fixture.whenStable();
  });

  it('draws the host facts the terminal cannot tell you', async () => {
    const page = await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await settle();

    const line = text(page);
    expect(line).toContain('wohlben');
    expect(line).toContain('Fedora Linux 42');
    expect(line).toContain('16.0 GB');
    expect(line).toContain('28.5.2');
    expect(line).toContain('active · 1 node');
  });

  it('attaches to the session the service handed back', async () => {
    await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't7', kind: 'GLANCES', container: null });
    await settle();

    expect(sockets.latest?.url).toBe(`ws://${location.host}/system/api/terminals/t7`);
  });

  /** No matchMedia in jsdom, so the view paints the raw frames instead of an emulator. */
  it('paints what the PTY sends', async () => {
    const page = await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await settle();

    sockets.latest?.connect();
    sockets.latest?.deliver('CPU  12.5%');
    await harness.fixture.whenStable();

    expect(page.querySelector('pre')?.textContent).toContain('CPU  12.5%');
  });

  it('says what failed when the host cannot be read, and still starts glances', async () => {
    const page = await open();
    http
      .expectOne('/system/api/overview')
      .flush(
        { message: 'docker is unreachable' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await settle();

    expect(text(page)).toContain('Could not read the host — 503 docker is unreachable');
    expect(sockets.opened).toHaveLength(1);
  });

  it('reports a glances session that could not be started', async () => {
    const page = await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http
      .expectOne('/system/api/terminals')
      .flush({ message: 'too many sessions' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(text(page)).toContain('Could not start glances — 409 too many sessions');
    expect(sockets.opened).toHaveLength(0);
  });

  /** The shared session's whole point: this page is a viewer, not its owner. */
  it('detaches on the way out and leaves the deleting to the service', async () => {
    await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await settle();

    harness.fixture.destroy();

    expect(sockets.latest?.closedByClient).toBe(true);
    http.verify();
  });

  it('ends the session at once when somebody presses Stop glances', async () => {
    const page = await open();
    http.expectOne('/system/api/overview').flush(OVERVIEW);
    http.expectOne('/system/api/terminals').flush({ id: 't1', kind: 'GLANCES', container: null });
    await settle();

    const stop = Array.from(page.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Stop glances'),
    );
    stop?.click();
    const request = http.expectOne('/system/api/terminals/t1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(text(page)).toContain('Start glances');
  });
});
