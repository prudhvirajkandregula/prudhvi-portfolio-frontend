import { Injectable, signal } from '@angular/core';

/**
 * Tracks chrome-level UI state that several components share:
 *  - isHome: whether the current route is the landing page (drives brand,
 *    nav links and the body.page-home theme).
 *  - menuOpen: the accessible mobile menu open/closed state.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isHome = signal(false);
  readonly menuOpen = signal(false);

  setHome(value: boolean): void {
    this.isHome.set(value);
  }

  openMenu(): void {
    this.menuOpen.set(true);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
