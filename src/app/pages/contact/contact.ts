import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { ApiError } from '../../core/api-error';
import { PortfolioApiService } from '../../core/portfolio-api.service';
import { FieldError, SocialLink } from '../../core/models';
import { errorCopy } from '../../core/utils';
import { AppStateComponent } from '../../shared/state/app-state.component';
import { SocialLinkComponent } from '../../shared/social-link/social-link.component';
import { RevealDirective } from '../../shared/reveal/reveal.directive';

type FieldName = 'name' | 'email' | 'subject' | 'message';
type Errors = Record<FieldName, string>;
type AlertKind = 'success' | 'error';
interface Alert {
  kind: AlertKind;
  title: string;
  detail: string;
}

const NAME_MAX = 120;
const EMAIL_MAX = 254;
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 4000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contact page, ported from contact.js. Client-side validation mirrors the
 * backend constraints, the character counter is live, submissions are
 * de-duplicated, and success is shown only after the backend confirms.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [AppStateComponent, SocialLinkComponent, RevealDirective],
  templateUrl: './contact.html',
})
export class Contact implements OnInit {
  private readonly api = inject(PortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly formRef = viewChild<ElementRef<HTMLFormElement>>('contactForm');
  private readonly alertRef = viewChild<ElementRef<HTMLElement>>('alertBox');

  protected readonly maxLength = MESSAGE_MAX;

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly subject = signal('');
  protected readonly message = signal('');

  protected readonly errors = signal<Errors>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  protected readonly submitting = signal(false);
  protected readonly alert = signal<Alert | null>(null);

  protected readonly charCount = computed(() => this.message().length);
  protected readonly charOver = computed(() => this.message().length > MESSAGE_MAX);

  protected readonly socialsState = signal<'loading' | 'empty' | 'error' | 'ready'>(
    'loading'
  );
  protected readonly socials = signal<SocialLink[]>([]);
  protected readonly socialsErrorMessage = signal('');

  ngOnInit(): void {
    this.loadSocials();
  }

  /* ------------------------------------------------------------------ */
  /* Field input / blur handling                                         */
  /* ------------------------------------------------------------------ */

  protected onInput(field: FieldName, value: string): void {
    this.setField(field, value);
    this.validateField(field);
    this.hideAlert();
  }

  protected onBlur(field: FieldName): void {
    this.validateField(field);
    this.hideAlert();
  }

  private setField(field: FieldName, value: string): void {
    switch (field) {
      case 'name':
        this.name.set(value);
        break;
      case 'email':
        this.email.set(value);
        break;
      case 'subject':
        this.subject.set(value);
        break;
      case 'message':
        this.message.set(value);
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Validation (mirrors the backend's own constraints)                  */
  /* ------------------------------------------------------------------ */

  private validateName(): string {
    const value = this.name().trim();
    if (!value) return 'Name is required.';
    if (value.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;
    return '';
  }

  private validateEmail(): string {
    const value = this.email().trim();
    if (!value) return 'Email is required.';
    if (value.length > EMAIL_MAX) return `Email must be at most ${EMAIL_MAX} characters.`;
    if (!EMAIL_PATTERN.test(value))
      return 'Enter a valid email address (e.g. name@example.com).';
    return '';
  }

  private validateSubject(): string {
    const value = this.subject().trim();
    if (value.length > SUBJECT_MAX)
      return `Subject must be at most ${SUBJECT_MAX} characters.`;
    return '';
  }

  private validateMessage(): string {
    const value = this.message().trim();
    if (!value) return 'Message is required.';
    if (value.length > MESSAGE_MAX)
      return `Message must be at most ${MESSAGE_MAX} characters.`;
    return '';
  }

  private validateField(field: FieldName): boolean {
    const checks: Record<FieldName, () => string> = {
      name: () => this.validateName(),
      email: () => this.validateEmail(),
      subject: () => this.validateSubject(),
      message: () => this.validateMessage(),
    };
    const error = checks[field]();
    this.errors.update((errors) => ({ ...errors, [field]: error }));
    return !error;
  }

  private validateAll(): boolean {
    const fields: FieldName[] = ['name', 'email', 'subject', 'message'];
    return fields.map((field) => this.validateField(field)).every(Boolean);
  }

  /* ------------------------------------------------------------------ */
  /* Feedback                                                            */
  /* ------------------------------------------------------------------ */

  private showAlert(kind: AlertKind, title: string, detail = ''): void {
    this.alert.set({ kind, title, detail });
    setTimeout(() => this.alertRef()?.nativeElement.focus(), 0);
  }

  private hideAlert(): void {
    this.alert.set(null);
  }

  private focusFirstInvalid(): void {
    this.formRef()?.nativeElement
      .querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Submission                                                          */
  /* ------------------------------------------------------------------ */

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.hideAlert();

    if (this.submitting()) return;

    if (!this.validateAll()) {
      this.showAlert(
        'error',
        'Some fields need your attention.',
        'Review the highlighted fields above and try again.'
      );
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);

    const payload = {
      name: this.name().trim(),
      email: this.email().trim(),
      subject: this.subject().trim(),
      message: this.message().trim(),
    };

    this.api
      .submitContact(payload)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.hideAlert();
          this.resetForm();
          this.showAlert('success', response?.message ?? 'Message received.');
        },
        error: (err) => {
          this.hideAlert();
          if (err instanceof ApiError && err.status === 400 && err.fieldErrors) {
            const applied = this.applyServerFieldErrors(err.fieldErrors);
            this.showAlert(
              'error',
              'The server rejected the submission.',
              applied
                ? 'Correct the highlighted fields and send again.'
                : err.message || 'Please review the form and try again.'
            );
            this.focusFirstInvalid();
          } else {
            this.showAlert(
              'error',
              err instanceof Error ? err.message : errorCopy(),
              'Check that the API gateway and contact service are running, then try again.'
            );
          }
        },
      });
  }

  private applyServerFieldErrors(fieldErrors: FieldError[]): boolean {
    const allowed: FieldName[] = ['name', 'email', 'subject', 'message'];
    let applied = false;
    for (const { field, message } of fieldErrors) {
      if (allowed.includes(field as FieldName)) {
        this.errors.update((errors) => ({
          ...errors,
          [field]: message || 'Please correct this field.',
        }));
        applied = true;
      }
    }
    return applied;
  }

  private resetForm(): void {
    this.name.set('');
    this.email.set('');
    this.subject.set('');
    this.message.set('');
    this.errors.set({ name: '', email: '', subject: '', message: '' });
  }

  /* ------------------------------------------------------------------ */
  /* Social links                                                        */
  /* ------------------------------------------------------------------ */

  private loadSocials(): void {
    this.socialsState.set('loading');

    this.api
      .getSocialLinks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (links) => {
          if (!links.length) {
            this.socialsState.set('empty');
            return;
          }
          this.socials.set(links);
          this.socialsState.set('ready');
        },
        error: (err) => {
          this.socialsErrorMessage.set(
            err instanceof Error ? err.message : errorCopy()
          );
          this.socialsState.set('error');
        },
      });
  }
}
