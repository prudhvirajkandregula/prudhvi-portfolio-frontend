import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiError } from './api-error';
import { CONFIG } from './config';
import {
  ContactRequest,
  ContactResponse,
  Education,
  Experience,
  FieldError,
  Profile,
  Project,
  ProjectType,
  Skill,
  SocialLink,
} from './models';

/**
 * The single service that talks to the backend — the Angular equivalent of
 * frontend/js/api.js. Pages depend on this service and never build URLs or
 * call HttpClient themselves.
 *
 * All requests are root-relative ("/api/..."); the dev proxy forwards them to
 * the API Gateway (see proxy.conf.json).
 */
@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return `${CONFIG.getBaseUrl()}${path}`;
  }

  /* ------------------------------------------------------------------ */
  /* Portfolio (read-only)                                               */
  /* ------------------------------------------------------------------ */

  getProfile(): Observable<Profile | null> {
    return this.http.get<Profile>(this.url('/api/portfolio/profile')).pipe(
      map((data) => this.asObject<Profile>(data)),
      catchError((err) => this.fail(err))
    );
  }

  getProjects(options: { type?: ProjectType; category?: string } = {}): Observable<Project[]> {
    let params = new HttpParams();
    if (options.type) params = params.set('type', options.type);
    if (options.category) params = params.set('category', options.category);

    return this.http.get<Project[]>(this.url('/api/portfolio/projects'), { params }).pipe(
      map((data) => (Array.isArray(data) ? data : [])),
      catchError((err) => this.fail(err))
    );
  }

  getProjectBySlug(slug: string): Observable<Project | null> {
    if (!slug) return of(null);
    return this.http
      .get<Project>(this.url(`/api/portfolio/projects/${encodeURIComponent(slug)}`))
      .pipe(
        map((data) => this.asObject<Project>(data)),
        catchError((err) => this.fail(err))
      );
  }

  getSkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(this.url('/api/portfolio/skills')).pipe(
      map((data) => {
        const skills = Array.isArray(data) ? data : [];
        return [...skills].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      }),
      catchError((err) => this.fail(err))
    );
  }

  getEducation(): Observable<Education[]> {
    return this.http.get<Education[]>(this.url('/api/portfolio/education')).pipe(
      map((data) => (Array.isArray(data) ? data : [])),
      catchError((err) => this.fail(err))
    );
  }

  getExperience(): Observable<Experience[]> {
    return this.http.get<Experience[]>(this.url('/api/portfolio/experience')).pipe(
      map((data) => (Array.isArray(data) ? data : [])),
      catchError((err) => this.fail(err))
    );
  }

  getSocialLinks(): Observable<SocialLink[]> {
    return this.http.get<SocialLink[]>(this.url('/api/portfolio/social-links')).pipe(
      map((data) => (Array.isArray(data) ? data : [])),
      catchError((err) => this.fail(err))
    );
  }

  /* ------------------------------------------------------------------ */
  /* Contact (write)                                                     */
  /* ------------------------------------------------------------------ */

  submitContact(payload: ContactRequest): Observable<ContactResponse> {
    return this.http
      .post<ContactResponse>(this.url('/api/contact'), payload)
      .pipe(catchError((err) => this.fail(err)));
  }

  /* ------------------------------------------------------------------ */
  /* Normalisation                                                       */
  /* ------------------------------------------------------------------ */

  private asObject<T>(data: unknown): T | null {
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as T) : null;
  }

  /** Map an HttpErrorResponse into the same ApiError shape the pages expect. */
  private fail(err: HttpErrorResponse): Observable<never> {
    if (err instanceof ApiError) return throwError(() => err);

    if (err.status === 0) {
      return throwError(
        () =>
          new ApiError(
            'Network error: the API gateway could not be reached. Is it running?'
          )
      );
    }

    const body = (err.error && typeof err.error === 'object' ? err.error : {}) as {
      message?: string;
      fieldErrors?: FieldError[];
    };

    return throwError(
      () =>
        new ApiError(body.message || `Request failed (HTTP ${err.status}).`, {
          status: err.status,
          fieldErrors: Array.isArray(body.fieldErrors) ? body.fieldErrors : null,
          body: err.error,
        })
    );
  }
}
