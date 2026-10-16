import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { SiteHeaderComponent } from './shared/chrome/site-header.component';
import { MobileMenuComponent } from './shared/chrome/mobile-menu.component';
import { SiteFooterComponent } from './shared/chrome/site-footer.component';
import { BackToTopComponent } from './shared/chrome/back-to-top.component';

/**
 * Application shell: the persistent chrome (header, mobile menu, footer,
 * back-to-top) rendered once around the routed page. Per-route document title
 * and theme-color come from route `data` (mirroring each original page head).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SiteHeaderComponent,
    MobileMenuComponent,
    SiteFooterComponent,
    BackToTopComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        let route = this.router.routerState.root;
        while (route.firstChild) route = route.firstChild;
        const data = route.snapshot.data;

        if (typeof data['title'] === 'string') this.title.setTitle(data['title']);
        if (typeof data['themeColor'] === 'string') {
          this.meta.updateTag({ name: 'theme-color', content: data['themeColor'] });
        }
      });
  }
}
