import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LayoutService } from '../../core/layout.service';

/**
 * Touch-size layouts that use the stacked (non-pinned) homepage, minus
 * reduced-motion users. Must match the mobile-motion block at the end of
 * home.css. Desktop widths (> 900px) are never included, so the desktop
 * story is untouched.
 */
const MOBILE_MOTION_QUERY =
  '(prefers-reduced-motion: no-preference) and (max-width: 620px), ' +
  '(prefers-reduced-motion: no-preference) and (max-width: 900px) and (max-height: 919px)';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Document offset ignoring transforms, so animated elements never feed back into their own progress. */
function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    top += node.offsetTop;
  }
  return top;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  private readonly layout = inject(LayoutService);
  private readonly storyRoot = viewChild<ElementRef<HTMLElement>>('storyRoot');
  private storyEl?: HTMLElement;
  private ticking = false;
  private readonly mobileMotion =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_MOTION_QUERY) : null;
  private mobileEls?: {
    hero: HTMLElement;
    identity: HTMLElement;
    heading: HTMLElement;
    creator: HTMLElement;
    developer: HTMLElement;
  };

  /**
   * Mobile counterpart of --story-progress. The stacked phone layout scrolls
   * normally, so each block gets its own scroll-linked progress and reuses
   * the desktop formulas in home.css. Like desktop, it is scrubbed by the
   * scroll position (reverses when scrolling up, never replays on a timer).
   */
  private updateMobileMotion(): void {
    const story = this.storyEl;
    const els = this.mobileEls;
    if (!story || !els) return;
    const vh = window.innerHeight || 1;
    const scrollY = window.scrollY;
    // 0 when the element's top reaches the bottom of the viewport, 1 once it
    // has risen 40% of the viewport (desktop reveals over a comparable range).
    const enter = (el: HTMLElement, span = 0.4) =>
      clamp01((vh - (layoutTop(el) - scrollY)) / (vh * span));

    const hero = clamp01((scrollY - (layoutTop(els.hero) - layoutTop(story))) / Math.max(1, els.hero.offsetHeight));
    const values: Record<string, number> = {
      '--m-hero': hero,
      '--m-portrait': enter(els.identity, 0.6),
      '--m-heading': enter(els.heading),
      '--m-creator': enter(els.creator),
      '--m-developer': enter(els.developer),
    };
    for (const [name, value] of Object.entries(values)) {
      story.style.setProperty(name, value.toFixed(4));
    }
  }

  private readonly onMobileMotionChange = () => this.updateProgress();

  private readonly updateProgress = () => {
    if (this.ticking) return;
    this.ticking = true;
    window.requestAnimationFrame(() => {
      this.ticking = false;
      if (!this.storyEl) return;
      const rect = this.storyEl.getBoundingClientRect();
      const travel = Math.max(1, this.storyEl.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      this.storyEl.style.setProperty('--story-progress', progress.toFixed(4));
      const portraitProgress = Math.min(1, progress * 5);
      this.storyEl.style.setProperty('--portrait-progress', portraitProgress.toFixed(4));
      if (this.mobileMotion?.matches) this.updateMobileMotion();
    });
  };

  ngOnInit(): void {
    this.layout.setHome(true);
    document.body.classList.add('page-home');
  }

  ngAfterViewInit(): void {
    this.storyEl = this.storyRoot()?.nativeElement;
    const pick = (selector: string) => this.storyEl?.querySelector<HTMLElement>(selector) ?? null;
    const hero = pick('.home-hero');
    const identity = pick('.home-identity');
    const heading = pick('.home-identity__heading');
    const creator = pick('.identity-card--creator');
    const developer = pick('.identity-card--developer');
    if (hero && identity && heading && creator && developer) {
      this.mobileEls = { hero, identity, heading, creator, developer };
    }
    // Set the mobile state synchronously, before the first paint, so content
    // already in view never flashes from visible to its animated state.
    if (this.mobileMotion?.matches) this.updateMobileMotion();
    this.mobileMotion?.addEventListener('change', this.onMobileMotionChange);

    this.updateProgress();
    window.addEventListener('scroll', this.updateProgress, { passive: true });
    window.addEventListener('resize', this.updateProgress, { passive: true });
  }

  ngOnDestroy(): void {
    this.layout.setHome(false);
    document.body.classList.remove('page-home');
    window.removeEventListener('scroll', this.updateProgress);
    window.removeEventListener('resize', this.updateProgress);
    this.mobileMotion?.removeEventListener('change', this.onMobileMotionChange);
  }

  protected onExploreWork(event: Event): void {
    event.preventDefault();
    const section = document.getElementById('identity');
    if (!section) return;

    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';

    const insideStory =
      !!this.storyEl && window.getComputedStyle(section).position === 'absolute';

    if (!insideStory) {
      section.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const story = this.storyEl!;
    const travel = Math.max(1, story.offsetHeight - window.innerHeight);
    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    window.scrollTo({ top: storyTop + travel * 0.65, behavior });
  }
}
