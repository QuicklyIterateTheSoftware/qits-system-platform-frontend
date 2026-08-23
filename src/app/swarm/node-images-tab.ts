import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { ImageSummaryDto } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, formatBytes, formatInstant, plural, shortId } from '../ui/format';
import { NodeResourceTab } from './node-resource-tab';

/**
 * Every image on this node's disk.
 *
 * The list is what `docker image ls` shows and nothing more: this page does not pull, tag or
 * remove. Its question is "is the image the deployer wanted actually here", which the repository,
 * the tag and the size answer between them.
 */
@Component({
  selector: 'app-node-images-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Async, Empty],
  styleUrls: ['../ui/page.css', './node-tab.css'],
  templateUrl: './node-images-tab.html',
})
export class NodeImagesTab extends NodeResourceTab<ImageSummaryDto> {
  protected readonly none = NONE;
  protected readonly short = shortId;
  protected readonly bytes = formatBytes;
  protected readonly instant = formatInstant;

  protected readonly caption = computed(() => plural(this.rows().length, 'image'));

  protected read(nodeId: string): Promise<readonly ImageSummaryDto[]> {
    return this.api.images(nodeId);
  }
}
