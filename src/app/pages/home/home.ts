import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LayoutService } from '../../core/layout.service';
import { RevealDirective } from '../../shared/reveal/reveal.directive';

const PORTRAIT_SRC = '/assets/images/portrait.svg';
const GAZE_MAX = 9; // max pupil travel in SVG user units

/**
 * Home page — replicates the vanilla landing page and the original eye-follow
 * animation (gaze follows pointer; Creator/Developer cards override focus).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  private readonly layout = inject(LayoutService);

  private readonly identitySection = viewChild<ElementRef<HTMLElement>>('identitySection');
  private readonly creatorCard = viewChild<ElementRef<HTMLElement>>('creatorCard');
  private readonly developerCard = viewChild<ElementRef<HTMLElement>>('developerCard');
  private readonly portraitSlot = viewChild<ElementRef<HTMLElement>>('portraitSlot');

  private sectionEl?: HTMLElement;
  private creatorEl?: HTMLElement;
  private developerEl?: HTMLElement;
  private slotEl?: HTMLElement;
  private svg?: SVGSVGElement;
  private irises: SVGElement[] = [];
  private hintEl?: HTMLElement;

  private focus: 'left' | 'right' | 'center' = 'center';
  private pointerX: number | null = null;

  private readonly onSectionPointerMove = (event: PointerEvent) => {
    this.pointerX = event.clientX;
    if (this.focus === 'center') this.renderGaze();
  };

  private readonly onSectionPointerLeave = () => {
    this.pointerX = null;
    if (this.focus === 'center') this.renderGaze();
  };

  private creatorEnter?: () => void;
  private creatorLeave?: () => void;
  private creatorFocusIn?: () => void;
  private creatorFocusOut?: () => void;

  private developerEnter?: () => void;
  private developerLeave?: () => void;
  private developerFocusIn?: () => void;
  private developerFocusOut?: () => void;

  ngOnInit(): void {
    this.layout.setHome(true);
    document.body.classList.add('page-home');
  }

  ngAfterViewInit(): void {
    this.paintIdentityPortrait();
  }

  ngOnDestroy(): void {
    this.layout.setHome(false);
    document.body.classList.remove('page-home');
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    if (this.sectionEl) {
      this.sectionEl.removeEventListener('pointermove', this.onSectionPointerMove);
      this.sectionEl.removeEventListener('pointerleave', this.onSectionPointerLeave);
    }

    if (this.creatorEl) {
      if (this.creatorEnter) this.creatorEl.removeEventListener('mouseenter', this.creatorEnter);
      if (this.creatorLeave) this.creatorEl.removeEventListener('mouseleave', this.creatorLeave);
      if (this.creatorFocusIn) this.creatorEl.removeEventListener('focusin', this.creatorFocusIn);
      if (this.creatorFocusOut) this.creatorEl.removeEventListener('focusout', this.creatorFocusOut);
    }

    if (this.developerEl) {
      if (this.developerEnter) this.developerEl.removeEventListener('mouseenter', this.developerEnter);
      if (this.developerLeave) this.developerEl.removeEventListener('mouseleave', this.developerLeave);
      if (this.developerFocusIn) this.developerEl.removeEventListener('focusin', this.developerFocusIn);
      if (this.developerFocusOut) this.developerEl.removeEventListener('focusout', this.developerFocusOut);
    }

    if (this.hintEl?.parentElement) {
      this.hintEl.parentElement.removeChild(this.hintEl);
    }
  }

  private async paintIdentityPortrait(): Promise<void> {
    this.slotEl = this.portraitSlot()?.nativeElement;
    if (!this.slotEl) return;

    let markup: string;
    try {
      const res = await fetch(PORTRAIT_SRC);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      markup = await res.text();
    } catch {
      const fallback = this.portraitFallback('Illustrated portrait could not be loaded');
      this.slotEl.replaceWith(fallback);
      this.slotEl = undefined;
      return;
    }

    this.slotEl.innerHTML = markup;
    const svg = this.slotEl.querySelector('svg');
    if (!svg) {
      const fallback = this.portraitFallback('Illustrated portrait could not be loaded');
      this.slotEl.replaceWith(fallback);
      this.slotEl = undefined;
      return;
    }

    this.svg = svg as SVGSVGElement;

    const finePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const supported = finePointer && !reducedMotion;
    this.svg.dataset['gaze'] = supported ? 'dynamic' : 'static';
    if (!supported) return;

    this.irises = Array.from(this.svg.querySelectorAll('.portrait-iris'));
    if (!this.irises.length) return;

    this.sectionEl = this.identitySection()?.nativeElement;
    this.creatorEl = this.creatorCard()?.nativeElement;
    this.developerEl = this.developerCard()?.nativeElement;

    if (this.sectionEl) {
      this.sectionEl.addEventListener('pointermove', this.onSectionPointerMove);
      this.sectionEl.addEventListener('pointerleave', this.onSectionPointerLeave);
    }

    this.bindCard('creator', 'left');
    this.bindCard('developer', 'right');

    const hintHost = (this.slotEl.closest('.identity-portrait') ||
      this.slotEl.parentElement) as HTMLElement | null;
    if (hintHost) {
      const hint = document.createElement('p');
      hint.className = 'portrait-hint';
      hint.textContent = 'The eyes follow your cursor';
      this.hintEl = hint;
      hintHost.appendChild(hint);
    }
  }

  private bindCard(kind: 'creator' | 'developer', when: 'left' | 'right'): void {
    const card = kind === 'creator' ? this.creatorEl : this.developerEl;
    if (!card) return;

    const enter = () => {
      this.focus = when;
      this.pointerX = null;
      this.renderGaze();
    };
    const leave = () => {
      if (this.focus === when) {
        this.focus = 'center';
        this.renderGaze();
      }
    };

    if (kind === 'creator') {
      this.creatorEnter = enter;
      this.creatorLeave = leave;
      this.creatorFocusIn = enter;
      this.creatorFocusOut = leave;
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      card.addEventListener('focusin', enter);
      card.addEventListener('focusout', leave);
    } else {
      this.developerEnter = enter;
      this.developerLeave = leave;
      this.developerFocusIn = enter;
      this.developerFocusOut = leave;
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      card.addEventListener('focusin', enter);
      card.addEventListener('focusout', leave);
    }
  }

  private renderGaze(): void {
    if (!this.svg) return;
    let x = 0;
    if (this.focus === 'left') x = -GAZE_MAX;
    else if (this.focus === 'right') x = GAZE_MAX;
    else if (this.pointerX != null) {
      const rect = this.svg.getBoundingClientRect();
      if (rect.width > 0) {
        const raw =
          ((this.pointerX - rect.left - rect.width / 2) / (rect.width / 2)) * GAZE_MAX;
        x = Math.max(-GAZE_MAX, Math.min(GAZE_MAX, raw));
      }
    }
    for (const iris of this.irises) {
      iris.style.transform = `translateX(${x.toFixed(2)}px)`;
    }
  }

  private portraitFallback(label: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'portrait-fallback';
    div.setAttribute('role', 'img');
    div.setAttribute('aria-label', label);
    div.textContent = 'PR';
    return div;
  }
}
