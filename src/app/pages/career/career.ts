import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
 * (forkJoin over per-request error-wrapped streams, equivalent to
 * Promise.allSettled) so a single failing endpoint never blanks the page.
 */
@Component({
  selector: 'app-career',
  standalone: true,
  imports: [AppIconComponent, ProjectCardComponent, AppStateComponent, SocialLinkComponent, RevealDirective],
  templateUrl: './career.html',
})
export class Career implements OnInit {
  private readonly api = inject(PortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly aboutState = signal<SectionState>('loading');
  protected readonly aboutHeadline = signal('');
  protected readonly aboutText = signal('');
  protected readonly aboutLocation = signal('');
  protected readonly aboutEmptyMessage = signal('');
  protected readonly profileErrorMessage = signal('');

  protected readonly resumeState = signal<SectionState>('loading');
  protected readonly resumeUrl = signal<string | null>(null);

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
      date: formatDateRange(
        entry.startDate,
        entry.currentRole || !entry.endDate ? 'Present' : entry.endDate
      ),
      role: entry.role ?? '',
      current: entry.currentRole,
      org: entry.organization ?? '',
      employmentType: entry.employmentType ?? '',
      description: entry.description ?? '',
    }))
  );

  protected readonly educationItems = computed(() =>
    this.education().map((entry) => ({
      date: formatDateRange(entry.startDate, entry.endDate),
      institution: entry.institution ?? '',
      qualification: [entry.qualification, entry.fieldOfStudy]
        .filter(Boolean)
        .join(' · '),
      description: entry.description ?? '',
    }))
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    forkJoin({
      profile: this.settle(this.api.getProfile()),
      skills: this.settle(this.api.getSkills()),
      education: this.settle(this.api.getEducation()),
      experience: this.settle(this.api.getExperience()),
      projects: this.settle(this.api.getProjects({ type: 'CAREER' })),
      socials: this.settle(this.api.getSocialLinks()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.applyProfile(result.profile);
        this.applySkills(result.skills);
        this.applyExperience(result.experience);
        this.applyEducation(result.education);
        this.applyProjects(result.projects);
        this.applySocials(result.socials);
      });
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

  private renderResume(profile: Profile | null): void {
    const resume = profile ? safeExternalUrl(profile.resumeUrl) : null;
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
