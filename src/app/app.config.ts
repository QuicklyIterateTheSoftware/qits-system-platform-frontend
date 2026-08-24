import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQitsNavigation, provideQitsProjects, provideQitsScope } from '@qits/ui-components';

import { routes } from './app.routes';

/**
 * Six providers, in the order every sibling repeats.
 *
 * - `provideBrowserGlobalErrorListeners` funnels genuinely-global errors and unhandled rejections
 *   into Angular's `ErrorHandler`.
 * - `provideRouter` carries this app's state: every level of it is a path segment, so each screen
 *   is bookmarkable and the back button works with no code.
 * - `withFetch` is not a preference. The default XHR backend is invisible to OTLP fetch
 *   instrumentation, so choosing it would quietly forfeit client spans the moment this deployment
 *   grows a telemetry relay. Every call this app makes is a same-origin path behind the edge, and
 *   none of them is anonymous: the edge's session is what authenticates them, and it does so with
 *   cookies a same-origin request sends by default. The terminal socket rides the same session, for
 *   the same reason — a `WebSocket` cannot carry an Authorization header.
 * - `provideQitsNavigation` gives `QitsMainLayout` its left navigation, by asking the edge for
 *   `/main-navigation` once at startup. The tree is the edge's answer — derived from the deployments
 *   it actually routes — not a list compiled into @qits/ui-components; without this provider the
 *   chrome renders no links at all. It needs the `provideHttpClient` above.
 * - `provideQitsProjects` puts the project picker in the chrome's top-left slot, from one
 *   `GET /projects/api/projects`. Every resource on this platform belongs to a project, so which one
 *   is open is the outermost fact about a page rather than a filter inside one of them. It also
 *   installs the repositories of whatever project is in scope, which the sidebar draws.
 * - `provideQitsScope('system')` says how deep this application's own addresses go: not at all. Its
 *   pages are about the platform, so there is no `/<slug>/...` route here to rewrite — and that is
 *   why picking a project LEAVES for qits-projects rather than landing the reader on a 404 with the
 *   right URL. Without this the picker is not rendered at all, because a control that cannot say
 *   what is selected is worse than the brand text it replaced.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideQitsNavigation(),
    provideQitsProjects(),
    provideQitsScope('system'),
  ],
};
