import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  HostListener,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { LayoutService } from '../../core/layout.service';
import { AppIconComponent } from '../icons/app-icon.component';
import { BRAND, HOME_BRAND, HOME_LINKS, NavLink, PRIMARY_LINKS } from './nav-config';

/**
 * Site header, ported from navigation.js renderHeader() + the mobile menu
 * toggle. Nav links, brand and the desktop Contact CTA switch between the
 * landing-page variant and the interior variant.
 *
 * The mobile menu panel is rendered by <app-mobile-menu>, outside this header,
 * because `.site-header` uses backdrop-filter (which would otherwise trap the
 * fixed-position panel).
 */
@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AppIconComponent],
  styles: [':host { display: contents; }'],
  template: `
    <header class="site-header" id="site-header">
      <div class="container site-header__inner">
        <a class="brand" routerLink="/" [attr.aria-label]="brand().name + ' — home'">
          <span class="brand__mark" aria-hidden="true">{{ brand().mark }}</span>
          <span class="brand__name">{{ brand().name }}</span>
        </a>

        <nav class="site-nav" aria-label="Primary">
          <ul class="nav-list">
            @for (link of links(); track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  [class]="linkClass(link)"
                  routerLinkActive
                  [routerLinkActiveOptions]="{ exact: true }"
                  [ariaCurrentWhenActive]="'page'"
                  >{{ link.label }}</a
                >
              </li>
            }
          </ul>
        </nav>

        @if (!layout.isHome()) {
          <a class="btn btn--primary nav-cta" routerLink="/contact">Contact</a>
        }

        <button
          #toggleBtn
          type="button"
          class="nav-toggle"
          [attr.aria-expanded]="layout.menuOpen()"
          aria-controls="mobile-menu"
          [attr.aria-label]="layout.menuOpen() ? 'Close menu' : 'Open menu'"
          (click)="layout.toggleMenu()"
        >
          <app-icon [name]="layout.menuOpen() ? 'close' : 'menu'" />
        </button>
      </div>
    </header>
  `,
})
export class SiteHeaderComponent {
  protected readonly layout = inject(LayoutService);

  protected readonly brand = computed(() => (this.layout.isHome() ? HOME_BRAND : BRAND));
  protected readonly links = computed<NavLink[]>(() =>
    this.layout.isHome() ? HOME_LINKS : PRIMARY_LINKS
  );

  private readonly toggleRef = viewChild<ElementRef<HTMLButtonElement>>('toggleBtn');
  private prevOpen = false;

  constructor() {
    effect(() => {
      const open = this.layout.menuOpen();
      document.body.classList.toggle('menu-open', open);

      if (open !== this.prevOpen) {
        if (!open) {
          setTimeout(() => this.toggleRef()?.nativeElement.focus(), 0);
        }
        this.prevOpen = open;
      }
    });
  }

  protected linkClass(link: NavLink): string {
    return link.tone ? `is-${link.tone}` : '';
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.layout.menuOpen()) this.layout.closeMenu();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth >= 860 && this.layout.menuOpen()) this.layout.closeMenu();
  }
}
