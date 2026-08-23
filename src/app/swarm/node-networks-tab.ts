import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { NetworkSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatInstant, plural, shortId } from '../ui/format';
import { NodeResourceTab } from './node-resource-tab';

/**
 * Every network this node knows about.
 *
 * The scope column is the one that answers a real question: a `swarm`-scoped overlay exists on
 * every node, a `local` bridge exists only here, and confusing the two is how an operator concludes
 * a service cannot reach a database that is in fact fine.
 */
@Component({
  selector: 'app-node-networks-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty],
  styleUrls: ['../ui/page.css', './node-tab.css'],
  templateUrl: './node-networks-tab.html',
})
export class NodeNetworksTab extends NodeResourceTab<NetworkSummaryDto> {
  protected readonly none = NONE;
  protected readonly short = shortId;
  protected readonly instant = formatInstant;

  protected readonly caption = computed(() => plural(this.rows().length, 'network'));

  protected read(nodeId: string): Promise<readonly NetworkSummaryDto[]> {
    return this.api.networks(nodeId);
  }
}
