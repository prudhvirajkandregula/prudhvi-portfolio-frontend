import { AfterViewInit, Component, HostListener, signal } from '@angular/core';

import { AppIconComponent } from '../icons/app-icon.component';

/**
 * Back-to-top control, ported from navigation.js setupBackToTop().
 * It is appended once by the app shell and scrolls the window to the top.
 */
@Component({
  selector: 'app-back-to-top',
  standalone: true,
  imports: [AppIconComponent],
  styles: [':host { display: contents; }'],
  template: `
    <button
      type="button"
      class="back-to-top"
      [class.is-visible]="visible()"
      aria-label="Back to top"
      (click)="toTop()"
    >
      <app-icon name="arrowUp" />
      <span class="sr-only">Back to top</span>
    </button>
  `,
})
export class BackToTopComponent implements AfterViewInit {
  protected readonly visible = signal(false);

  ngAfterViewInit(): void {
    this.onScroll();
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.visible.set(window.scrollY > 600);
  }

  protected toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
