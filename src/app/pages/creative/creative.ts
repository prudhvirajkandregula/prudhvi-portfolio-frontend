import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { PortfolioApiService } from '../../core/portfolio-api.service';
import { Project } from '../../core/models';
import { errorCopy } from '../../core/utils';
import { ProjectCardComponent } from '../../shared/project-card/project-card.component';
import { AppStateComponent } from '../../shared/state/app-state.component';
import { RevealDirective } from '../../shared/reveal/reveal.directive';

type Status = 'loading' | 'error' | 'empty' | 'ready';

/**
 * Creative gallery, ported from creative.js. The category filters are derived
 * from the loaded data and each selection re-queries the backend through
 * GET /api/portfolio/projects?type=CREATIVE&category=...
 */
@Component({
  selector: 'app-creative',
  standalone: true,
  imports: [ProjectCardComponent, AppStateComponent, RevealDirective],
  templateUrl: './creative.html',
})
export class Creative implements OnInit {
  private readonly api = inject(PortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<Status>('loading');
  protected readonly projects = signal<Project[]>([]);
  protected readonly categories = signal<string[]>([]);
  protected readonly activeCategory = signal('All');
  protected readonly countText = signal('');
  protected readonly errorMessage = signal('');
  protected readonly loadingMessage = signal('');
  protected readonly emptyMessage = signal('');
  protected readonly filtersFailed = signal(false);

  private pending = false;

  ngOnInit(): void {
    this.loadInitial();
  }

  protected selectCategory(category: string): void {
    if (this.pending || category === this.activeCategory()) return;
    this.activeCategory.set(category);
    this.loadProjects();
  }

  /** First load: fetch every creative project, then derive the filters. */
  private loadInitial(): void {
    this.status.set('loading');
    this.loadingMessage.set('');

    this.api
      .getProjects({ type: 'CREATIVE' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.buildFilters(all);
          this.renderGallery(all);
        },
        error: (err) => {
          this.categories.set([]);
          this.filtersFailed.set(true);
          this.status.set('error');
          this.errorMessage.set(err instanceof Error ? err.message : errorCopy());
        },
      });
  }

  /** Selecting a category re-queries the backend (never filters client-side). */
  private loadProjects(): void {
    if (this.pending) return;
    this.pending = true;

    const category = this.activeCategory() === 'All' ? '' : this.activeCategory();
    this.status.set('loading');
    this.loadingMessage.set(
      category
        ? `Fetching projects in “${category}”.`
        : 'Fetching all creative projects.'
    );

    this.api
      .getProjects({ type: 'CREATIVE', category })
      .pipe(
        finalize(() => (this.pending = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (projects) => this.renderGallery(projects),
        error: (err) => {
          this.status.set('error');
          this.errorMessage.set(err instanceof Error ? err.message : errorCopy());
        },
      });
  }

  private buildFilters(projects: Project[]): void {
    const categories = [
      ...new Set(
        projects
          .map((project) => project.category)
          .filter(
            (category): category is string =>
              typeof category === 'string' && category.trim().length > 0
          )
      ),
    ];
    this.categories.set(categories);
    this.filtersFailed.set(false);
  }

  private renderGallery(projects: Project[]): void {
    this.projects.set(projects);
    this.updateCount(projects.length);

    if (!projects.length) {
      this.emptyMessage.set(
        this.activeCategory() === 'All'
          ? 'Publish creative projects in the backend to fill this gallery.'
          : `Nothing has been tagged “${this.activeCategory()}” so far.`
      );
      this.status.set('empty');
      return;
    }

    this.status.set('ready');
  }

  private updateCount(count: number): void {
    const noun = count === 1 ? 'project' : 'projects';
    this.countText.set(
      this.activeCategory() === 'All'
        ? `${count} ${noun} total`
        : `${count} ${noun} in “${this.activeCategory()}”`
    );
  }
}
