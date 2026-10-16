import { Component, computed, input } from '@angular/core';

import { SocialLink } from '../../core/models';
import { safeExternalUrl } from '../../core/utils';
import { AppIconComponent } from '../icons/app-icon.component';

/**
 * A single social link, ported from the shared markup used by career.js and
 * contact.js. Unsafe/same-host URLs fall back to "#", and only safe external
 * links open in a new tab.
 */
@Component({
  selector: 'app-social-link',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <a
      class="social-link"
      [href]="href()"
      [attr.target]="href() === '#' ? '_self' : '_blank'"
      [attr.rel]="href() === '#' ? null : 'noopener noreferrer'"
      [attr.aria-label]="(link().platform || '') + ' — opens in a new tab'"
    >
      <app-icon [platform]="link().platform" />{{ ' ' }}{{ label() }}
    </a>
  `,
})
export class SocialLinkComponent {
  readonly link = input.required<SocialLink>();

  protected readonly href = computed(() => safeExternalUrl(this.link().url) ?? '#');
  protected readonly label = computed(
    () => this.link().label || this.link().platform || ''
  );
}
