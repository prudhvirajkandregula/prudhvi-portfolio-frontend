import { Component, computed, effect, ElementRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { LayoutService } from '../../core/layout.service';
import { HOME_LINKS, NavLink, PRIMARY_LINKS } from './nav-config';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  styles: [':host { display: contents; }'],
  template: `
    <div
      class="mobile-menu"
      id="mobile-menu"
      [class.is-open]="layout.menuOpen()"
      [attr.aria-hidden]="!layout.menuOpen()"
    >
      <ul class="nav-list">
        @for (link of links(); track link.path) {
          <li>
            <a
              [routerLink]="link.path"
              [class]="linkClass(link)"
              routerLinkActive
              [routerLinkActiveOptions]="{ exact: true }"
              [ariaCurrentWhenActive]="'page'"
              (click)="layout.closeMenu()"
            >
              {{ link.label }}
            </a>
          </li>
        }
      </ul>

      @if (!layout.isHome()) {
        <a
          class="btn btn--primary nav-cta"
          routerLink="/contact"
          (click)="layout.closeMenu()"
        >
          Start a conversation
        </a>
      }
    </div>
  `,
})
export class MobileMenuComponent {
  protected readonly layout = inject(LayoutService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly links = computed<NavLink[]>(() =>
    this.layout.isHome()
      ? HOME_LINKS
      : [...PRIMARY_LINKS, { path: '/contact', label: 'Contact' }]
  );

  private prevOpen = false;

  constructor() {
    effect(() => {
      const open = this.layout.menuOpen();

      if (open && !this.prevOpen) {
        setTimeout(() => {
          this.host.nativeElement
            .querySelector<HTMLElement>('a')
            ?.focus();
        }, 0);
      }

      this.prevOpen = open;
    });
  }

  protected linkClass(link: NavLink): string {
    return link.tone ? `is-${link.tone}` : '';
  }
}
