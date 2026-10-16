import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BRAND, FOOTER_LINKS } from './nav-config';

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
            <a class="brand" routerLink="/">
              <span class="brand__mark" aria-hidden="true">{{ brand.mark }}</span>
              <span class="brand__name">{{ brand.name }}</span>
            </a>
            <p>A creative + career portfolio built with plain HTML, CSS and JavaScript.</p>
          </div>

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

        <div class="site-footer__bottom">
          <p>© {{ year }} {{ brand.name }}. All rights reserved.</p>
          <p>Designed as a real, API-driven portfolio.</p>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected readonly brand = BRAND;
  protected readonly footerLinks = FOOTER_LINKS;
  protected readonly year = new Date().getFullYear();
}
