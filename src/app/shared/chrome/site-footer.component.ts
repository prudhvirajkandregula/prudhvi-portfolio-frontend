import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FOOTER_LINKS, HOME_BRAND } from './nav-config';

/**
 * Site footer, ported from navigation.js renderFooter().
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  styles: [':host { display: contents; }'],
  template: `
    <footer class="site-footer" id="site-footer">
      <div class="container">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <a class="brand" routerLink="/" [attr.aria-label]="brand.name + ' — home'">
              <span class="brand__mark" aria-hidden="true">{{ brand.mark }}</span>
              <span class="brand__name">{{ brand.name }}</span>
            </a>
          </div>

          <div class="site-footer__links">
            <div>
              <h3>Explore</h3>
              <nav aria-label="Footer">
                @for (link of footerLinks; track link.path) {
                  <a [routerLink]="link.path">{{ link.label }}</a>
                }
              </nav>
            </div>

            <div>
              <h3>Get in touch</h3>
              <nav aria-label="Contact links">
                <a routerLink="/contact">Contact form</a>
                <a routerLink="/career">Career &amp; resume</a>
              </nav>
            </div>
          </div>
        </div>

        <div class="site-footer__bottom">
          <p>© {{ year }} {{ brand.name }}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  /** Same PR wordmark as the navbar; the name is visually hidden. */
  protected readonly brand = HOME_BRAND;
  protected readonly footerLinks = FOOTER_LINKS;
  protected readonly year = new Date().getFullYear();
}
