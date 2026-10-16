import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { icon } from '../../core/icons';

export type StateKind = 'loading' | 'error' | 'empty';

/**
 * Loading / empty / error state block, ported from utils.js renderState().
 * The icon markup is a hard-coded trusted constant.
 */
@Component({
  selector: 'app-state',
  standalone: true,
  template: `
    <div class="state" [class]="'state--' + kind()">
      <span class="state__icon" aria-hidden="true" [innerHTML]="iconMarkup()"></span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class AppStateComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly kind = input<StateKind>('loading');
  readonly title = input<string>('');
  readonly message = input<string>('');

  private readonly loadingIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"/></svg>';

  protected readonly iconMarkup = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      this.kind() === 'loading' ? this.loadingIcon : icon('arrowRight')
    )
  );
}
