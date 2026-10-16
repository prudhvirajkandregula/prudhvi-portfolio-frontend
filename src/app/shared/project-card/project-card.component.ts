import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Project } from '../../core/models';
import { safeUrl } from '../../core/utils';
import { AppIconComponent } from '../icons/app-icon.component';

/**
 * Shared project card, ported from utils.js projectCard(). Markup and class
 * names are identical to the vanilla frontend so the same CSS applies.
 *
 * The backend seeds placeholder (example.com) thumbnails, so — exactly like the
 * vanilla code — the monogram placeholder is rendered alongside the image; a
 * broken image is dropped and the placeholder remains.
 */
@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, AppIconComponent],
  template: `
    <article class="project-card" [class.project-card--featured]="featured()">
      <div
        class="project-card__media"
        [class.is-creative]="tone() === 'creative'"
        [class.is-career]="tone() === 'career'"
      >
        @if (imgSrc() && !imgFailed()) {
          <img
            [src]="imgSrc()"
            [alt]="'Thumbnail for ' + title()"
            loading="lazy"
            decoding="async"
            (error)="imgFailed.set(true)"
          />
        }
        <div
          class="media-placeholder"
          [class.is-career]="tone() === 'career'"
          role="img"
          [attr.aria-label]="placeholderLabel()"
        >
          {{ monogram() }}
        </div>
      </div>

      <div class="project-card__body">
        <h3 class="project-card__title">
          <a [routerLink]="['/projects', project().slug]">{{ title() }}</a>
        </h3>
        <p class="project-card__desc">{{ description() }}</p>
        <div class="project-card__meta">
          <a
            class="tag project-card__badge"
            [class.tag--creative]="tone() === 'creative'"
            [class.tag--career]="tone() === 'career'"
            [routerLink]="['/projects', project().slug]"
            >{{ badgeText() }}</a
          >
          <a class="link-arrow project-card__link" [routerLink]="['/projects', project().slug]">
            View project
            <app-icon name="arrowRight" />
          </a>
        </div>
      </div>
    </article>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<Project>();
  readonly featured = input(false);

  protected readonly imgFailed = signal(false);

  protected readonly tone = computed(() =>
    this.project().type === 'CAREER' ? 'career' : 'creative'
  );
  protected readonly title = computed(() => String(this.project().title ?? 'Untitled project'));
  protected readonly imgSrc = computed(() => safeUrl(this.project().thumbnailUrl));
  protected readonly monogram = computed(() => {
    const label = this.title();
    return label ? label.slice(0, 1).toUpperCase() : 'P';
  });
  protected readonly placeholderLabel = computed(
    () => `${this.title() || 'Project'} placeholder (thumbnail unavailable)`
  );
  protected readonly badgeText = computed(
    () => this.project().category || (this.tone() === 'career' ? 'Project' : 'Creative')
  );
  protected readonly description = computed(
    () =>
      this.project().shortDescription ||
      this.project().fullDescription ||
      'No description yet.'
  );
}
