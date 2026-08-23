import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * A URL under `/system/` that this app does not recognise.
 *
 * It renders a small page and stops there. It deliberately does **not** copy spa-home's behaviour of
 * handing the URL back to the gateway: that is right only because spa-home is mounted at the root,
 * where an unknown first segment is another micro frontend. Here the segment is already ours, so
 * there is nobody to hand it to.
 *
 * `/system/api` and `/system/q` never reach this page — the service claims both ahead of the SPA,
 * through `quarkus.quinoa.ignored-path-prefixes`, so a mistyped machine path is a 404 from Quarkus
 * rather than this component.
 */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>No such page here</h1>
    <p>
      This is the system console. It shows the machine this platform runs on — the host, the swarm,
      and the containers on this node — and nothing else.
    </p>
    <p><a routerLink="/">Back to the overview</a></p>
  `,
  styles: `
    h1 {
      font-size: 1.25rem;
      margin: 0 0 0.5rem;
    }
  `,
})
export class NotFound {}
