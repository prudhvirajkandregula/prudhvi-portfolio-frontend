import { AfterViewInit, Directive, ElementRef, inject, OnDestroy } from '@angular/core';

/**
 * Reveal-on-scroll, ported from utils.js initReveals().
 *
 * Usage: add `class="... reveal" appReveal` to an element. When it scrolls into
 * view it receives `.is-visible`. Respects prefers-reduced-motion and degrades
 * gracefully when IntersectionObserver is unavailable.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
