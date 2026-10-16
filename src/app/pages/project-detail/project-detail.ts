import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiError } from '../../core/api-error';
import { PortfolioApiService } from '../../core/portfolio-api.service';
import { Project } from '../../core/models';
import {
  errorCopy,
  formatMonthYear,
  safeExternalUrl,
  toVideoEmbedUrl,
} from '../../core/utils';
import { AppIconComponent } from '../../shared/icons/app-icon.component';
import { AppStateComponent } from '../../shared/state/app-state.component';

type State = 'loading' | 'ready' | 'notfound' | 'loaderror';

/**
 * Project detail, ported from project.js. Loads a single project by the
 * :slug route parameter, renders its metadata, embeds video when possible,
 * and degrades to "not found" / "could not load" states.
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, AppIconComponent, AppStateComponent],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {
  private readonly api = inject(PortfolioApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  protected readonly state = signal<State>('loading');
  protected readonly project = signal<Project | null>(null);
  protected readonly slug = signal('');
  protected readonly loadingMessage = signal('');
  protected readonly loadErrorMessage = signal('');
  protected readonly mediaFailed = signal(false);

  protected readonly isCareer = computed(() => this.project()?.type === 'CAREER');
  protected readonly titleText = computed(
    () => this.project()?.title || 'Untitled project'
  );
  protected readonly eyebrowText = computed(() => {
    const project = this.project();
    if (!project) return '';
    return (
      project.category || (this.isCareer() ? 'Career project' : 'Creative project')
    );
  });
  protected readonly mediaSrc = computed(() =>
    safeExternalUrl(this.project()?.thumbnailUrl)
  );
  protected readonly monogram = computed(() => {
    const label = this.titleText();
    return label ? label.slice(0, 1).toUpperCase() : 'P';
  });
  protected readonly placeholderLabel = computed(
    () => `${this.titleText() || 'Project'} placeholder (thumbnail unavailable)`
  );
  protected readonly embedUrl = computed(() =>
    toVideoEmbedUrl(this.project()?.videoUrl)
  );
  protected readonly directVideoUrl = computed(() => {
    if (this.embedUrl()) return null;
    return safeExternalUrl(this.project()?.videoUrl);
  });
  protected readonly externalUrl = computed(() =>
    safeExternalUrl(this.project()?.externalUrl)
  );
  protected readonly updatedMonth = computed(() =>
    formatMonthYear(this.project()?.updatedAt)
  );
  protected readonly categoryText = computed(() => this.project()?.category || '—');
  protected readonly typeText = computed(() => (this.isCareer() ? 'Career' : 'Creative'));

  protected readonly returnPath = computed(() => (this.isCareer() ? '/career' : '/creative'));
  protected readonly returnLabel = computed(() =>
    this.isCareer() ? 'Back to career projects' : 'Back to creative projects'
  );

  protected readonly notFoundCode = computed(() =>
    this.slug().trim() ? '404' : 'No slug'
  );
  protected readonly notFoundTitle = computed(() =>
    this.slug().trim() ? 'Project not found' : 'No project was requested'
  );
  protected readonly notFoundMessage = computed(() =>
    this.slug().trim()
      ? `No project with the slug “${this.slug()}” could be found in the backend. It may have been unpublished or renamed.`
      : 'Open a project card to reach this page with a ?slug= parameter — the slug couldn’t be read from the URL.'
  );

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.load(slug);
    });
  }

  protected retry(): void {
    this.load(this.slug());
  }

  private load(slug: string): void {
    this.slug.set(slug);
    this.mediaFailed.set(false);

    if (!slug.trim()) {
      this.state.set('notfound');
      return;
    }

    this.state.set('loading');
    this.loadingMessage.set(`Fetching “${slug}” from the backend.`);

    this.api
      .getProjectBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          if (!project) {
            this.state.set('notfound');
            return;
          }
          this.project.set(project);
          if (project.title) this.title.setTitle(`${project.title} — Prudhvi`);
          this.state.set('ready');
        },
        error: (err) => {
          if (err instanceof ApiError && err.status === 404) {
            this.state.set('notfound');
            return;
          }
          this.loadErrorMessage.set(
            this.slug()
              ? `The backend couldn’t be reached while loading “${this.slug()}”. Check that the API gateway is running, then try again.`
              : errorCopy()
          );
          this.state.set('loaderror');
        },
      });
  }
}
