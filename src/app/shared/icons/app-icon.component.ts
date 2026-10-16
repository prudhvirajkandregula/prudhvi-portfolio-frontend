import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { icon, iconForPlatform } from '../../core/icons';

/**
 * Renders one inline SVG from the shared icon set.
 * The markup is a hard-coded trusted constant, so it is explicitly marked safe.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<span class="app-icon" [innerHTML]="markup()"></span>`,
  styles: [':host { display: inline-flex; align-items: center; } .app-icon { display: inline-flex; }'],
})
export class AppIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** Explicit icon key, e.g. "github", "arrowRight". */
  readonly name = input<string>('');
  /** Alternatively resolve an icon from a platform label (e.g. "GitHub"). */
  readonly platform = input<string>('');

  protected readonly markup = computed<SafeHtml>(() => {
    const platform = this.platform();
    const raw = platform ? iconForPlatform(platform) : icon(this.name());
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });
}
