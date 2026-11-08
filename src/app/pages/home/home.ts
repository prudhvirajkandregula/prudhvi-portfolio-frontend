import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LayoutService } from '../../core/layout.service';

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
    });
  };

  ngOnInit(): void {
    this.layout.setHome(true);
    document.body.classList.add('page-home');
  }

  ngAfterViewInit(): void {
    this.storyEl = this.storyRoot()?.nativeElement;
    this.updateProgress();
    window.addEventListener('scroll', this.updateProgress, { passive: true });
    window.addEventListener('resize', this.updateProgress, { passive: true });
  }

  ngOnDestroy(): void {
    this.layout.setHome(false);
    document.body.classList.remove('page-home');
    window.removeEventListener('scroll', this.updateProgress);
    window.removeEventListener('resize', this.updateProgress);
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
