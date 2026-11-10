import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { ApiError } from '../../core/api-error';
import { PortfolioApiService } from '../../core/portfolio-api.service';
import {
  Education,
  Experience,
  Profile,
  Project,
  Skill,
  SocialLink,
} from '../../core/models';
import { errorCopy, formatDateRange, safeExternalUrl } from '../../core/utils';
import { AppIconComponent } from '../../shared/icons/app-icon.component';
import { ProjectCardComponent } from '../../shared/project-card/project-card.component';
import { AppStateComponent } from '../../shared/state/app-state.component';
import { SocialLinkComponent } from '../../shared/social-link/social-link.component';
import { RevealDirective } from '../../shared/reveal/reveal.directive';

type SectionState = 'loading' | 'error' | 'empty' | 'ready';

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

interface SkillGroup {
  category: string;
  items: Skill[];
}

/**
 * Career page, ported from career.js. Every section loads independently
 * (per-request error-wrapped streams, equivalent to Promise.allSettled)
 * and renders on its own subscription, so a single failing or slow
 * endpoint never blanks the page or holds back the other sections.
 */
@Component({
  selector: 'app-career',
  standalone: true,
  imports: [AppIconComponent, ProjectCardComponent, AppStateComponent, SocialLinkComponent, RevealDirective],
  templateUrl: './career.html',
})
export class Career implements OnInit, OnDestroy {
  private readonly api = inject(PortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  protected readonly aboutState = signal<SectionState>('loading');
  protected readonly aboutHeadline = signal('');
  protected readonly aboutText = signal('');
  protected readonly aboutLocation = signal('');
  protected readonly aboutEmptyMessage = signal('');
  protected readonly profileErrorMessage = signal('');

  protected readonly resumeState = signal<SectionState>('loading');
  protected readonly resumeUrl = signal<string | null>(null);
  /** Same-site files download directly; external links open in a new tab. */
  protected readonly resumeIsLocal = computed(() => this.resumeUrl()?.startsWith('/') ?? false);

  protected readonly skillsState = signal<SectionState>('loading');
  protected readonly skills = signal<Skill[]>([]);
  protected readonly skillsErrorMessage = signal('');

  protected readonly experienceState = signal<SectionState>('loading');
  protected readonly experience = signal<Experience[]>([]);
  protected readonly experienceErrorMessage = signal('');

  protected readonly educationState = signal<SectionState>('loading');
  protected readonly education = signal<Education[]>([]);
  protected readonly educationErrorMessage = signal('');

  protected readonly projectsState = signal<SectionState>('loading');
  protected readonly projects = signal<Project[]>([]);
  protected readonly projectsErrorMessage = signal('');

  protected readonly socialsState = signal<'idle' | 'empty' | 'ready'>('idle');
  protected readonly socials = signal<SocialLink[]>([]);

  protected readonly skillGroups = computed<SkillGroup[]>(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of this.skills()) {
      const category = (skill.category ?? '').trim() || 'Other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(skill);
    }
    return [...groups].map(([category, items]) => ({ category, items }));
  });

  protected readonly experienceItems = computed(() =>
    this.experience().map((entry) => ({
      // A null end date makes formatDateRange render "Present".
      date: formatDateRange(entry.startDate, entry.currentRole ? null : entry.endDate),
      role: entry.role ?? '',
      current: entry.currentRole,
      org: entry.organization ?? '',
      employmentType: entry.employmentType ?? '',
      description: entry.description ?? '',
    }))
  );

  // Education is recorded by year only, so show years rather than months.
  protected readonly educationItems = computed(() =>
    this.education().map((entry) => ({
      date: [entry.startDate, entry.endDate]
        .map((value) => String(value ?? '').slice(0, 4))
        .filter((year, index, years) => year && years.indexOf(year) === index)
        .join(' — '),
      institution: entry.institution ?? '',
      qualification: [entry.qualification, entry.fieldOfStudy]
        .filter(Boolean)
        .join(' · '),
      description: entry.description ?? '',
    }))
  );

  /** Backend text separates paragraphs with blank lines. */
  protected paragraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  ngOnInit(): void {
    document.body.classList.add('page-career');
    this.load();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('page-career');
  }

  private load(): void {
    // Each stream is error-wrapped (never fails) and each section applies
    // its own result, so sections render progressively on a cold first
    // visit. The API service caches these GETs, so navigating away and
    // back replays them synchronously: every section is 'ready' before the
    // page paints, with no loading state and no repeated request.
    const profile = this.settle(this.api.getProfile());
    const skills = this.settle(this.api.getSkills());
    const education = this.settle(this.api.getEducation());
    const experience = this.settle(this.api.getExperience());
    const projects = this.settle(this.api.getProjects({ type: 'CAREER' }));
    const socials = this.settle(this.api.getSocialLinks());

    profile.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applyProfile(result));
    skills.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applySkills(result));
    experience.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applyExperience(result));
    education.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applyEducation(result));
    projects.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applyProjects(result));
    socials.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.applySocials(result));

    // The same cached streams again (no extra requests): the fragment
    // targets only take their final positions once every section has
    // rendered, so scroll after all of them settle.
    forkJoin({ profile, skills, education, experience, projects, socials })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scrollToFragment());
  }

  /**
   * Links such as /career#resume target sections that only take their final
   * position once the data has rendered, so the router's immediate anchor
   * scroll lands too early. Scroll once more after that render.
   */
  private scrollToFragment(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) return;
    afterNextRender(
      () => document.getElementById(fragment)?.scrollIntoView({ block: 'start' }),
      { injector: this.injector }
    );
  }

  private settle<T>(source: Observable<T>): Observable<Settled<T>> {
    return source.pipe(
      map((value): Settled<T> => ({ ok: true, value })),
      catchError((error): Observable<Settled<T>> => of({ ok: false, error }))
    );
  }

  private messageFor(error: unknown): string {
    if (error instanceof ApiError && error.status === 503) {
      return 'The portfolio service is temporarily unavailable. Try again shortly.';
    }
    return error instanceof Error ? error.message : errorCopy();
  }

  private applyProfile(result: Settled<Profile | null>): void {
    if (!result.ok) {
      const message = this.messageFor(result.error);
      this.profileErrorMessage.set(message);
      this.aboutState.set('error');
      this.resumeState.set('error');
      return;
    }
    this.renderAbout(result.value);
    this.renderResume(result.value);
  }

  private renderAbout(profile: Profile | null): void {
    if (!profile) {
      this.aboutState.set('empty');
      this.aboutEmptyMessage.set(
        'Add a profile record in the backend to publish it here.'
      );
      return;
    }

    const headline = profile.headline ?? '';
    const about = profile.about ?? '';
    const location = profile.location ?? '';

    if (!headline && !about && !location) {
      this.aboutState.set('empty');
      this.aboutEmptyMessage.set('');
      return;
    }

    this.aboutHeadline.set(headline);
    this.aboutText.set(about);
    this.aboutLocation.set(location);
    this.aboutState.set('ready');
  }

  /**
   * Resume link: either a file served by this site (a root-relative path such
   * as /assets/resume/file.pdf) or a vetted external http(s) URL.
   */
  private resumeHref(value: unknown): string | null {
    if (typeof value === 'string' && /^\/(?!\/)[\w\-./]+$/.test(value.trim())) return value.trim();
    return safeExternalUrl(value);
  }

  private renderResume(profile: Profile | null): void {
    const resume = profile ? this.resumeHref(profile.resumeUrl) : null;
    if (resume) {
      this.resumeUrl.set(resume);
      this.resumeState.set('ready');
      return;
    }
    this.resumeState.set('empty');
  }

  private applySkills(result: Settled<Skill[]>): void {
    if (!result.ok) {
      this.skillsErrorMessage.set(this.messageFor(result.error));
      this.skillsState.set('error');
      return;
    }
    const skills = result.value ?? [];
    if (!skills.length) {
      this.skillsState.set('empty');
      return;
    }
    this.skills.set(skills);
    this.skillsState.set('ready');
  }

  private applyExperience(result: Settled<Experience[]>): void {
    if (!result.ok) {
      this.experienceErrorMessage.set(this.messageFor(result.error));
      this.experienceState.set('error');
      return;
    }
    const entries = result.value ?? [];
    if (!entries.length) {
      this.experienceState.set('empty');
      return;
    }
    this.experience.set(entries);
    this.experienceState.set('ready');
  }

  private applyEducation(result: Settled<Education[]>): void {
    if (!result.ok) {
      this.educationErrorMessage.set(this.messageFor(result.error));
      this.educationState.set('error');
      return;
    }
    const entries = result.value ?? [];
    if (!entries.length) {
      this.educationState.set('empty');
      return;
    }
    this.education.set(entries);
    this.educationState.set('ready');
  }

  private applyProjects(result: Settled<Project[]>): void {
    if (!result.ok) {
      this.projectsErrorMessage.set(this.messageFor(result.error));
      this.projectsState.set('error');
      return;
    }
    const projects = result.value ?? [];
    if (!projects.length) {
      this.projectsState.set('empty');
      return;
    }
    this.projects.set(projects);
    this.projectsState.set('ready');
  }

  private applySocials(result: Settled<SocialLink[]>): void {
    // On failure the region simply stays empty, matching the original.
    if (!result.ok) return;

    const careerLinks = (result.value ?? []).filter(
      (link) => !link.section || link.section.toUpperCase() === 'CAREER'
    );
    if (!careerLinks.length) {
      this.socialsState.set('empty');
      return;
    }
    this.socials.set(careerLinks);
    this.socialsState.set('ready');
  }
}
