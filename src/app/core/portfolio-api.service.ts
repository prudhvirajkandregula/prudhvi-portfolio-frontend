import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParameterCodec,
  HttpParams,
} from '@angular/common/http';
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
import { SUPABASE_CONFIG } from './supabase.config';

/**
 * PostgREST "select" lists. Column aliases (alias:column) return the same
 * camelCase JSON the Spring Boot DTOs produced, so models.ts and every page
 * stay unchanged. Internal ids are never selected.
 */
const PROFILE_COLUMNS = 'name,headline,about:about_text,location,resumeUrl:resume_url';
const PROJECT_COLUMNS = [
  'title',
  'slug',
  'shortDescription:short_description',
  'fullDescription:full_description',
  'type:project_type',
  'category',
  'thumbnailUrl:thumbnail_url',
  'externalUrl:external_url',
  'videoUrl:video_url',
  'featured',
  'displayOrder:display_order',
  'createdAt:created_at',
  'updatedAt:updated_at',
].join(',');
const SKILL_COLUMNS = 'name,category,proficiency:proficiency_label,displayOrder:display_order';
const EDUCATION_COLUMNS =
  'institution,qualification,fieldOfStudy:field_of_study,startDate:start_date,endDate:end_date,description';
const EXPERIENCE_COLUMNS =
  'organization,role,employmentType:employment_type,startDate:start_date,endDate:end_date,currentRole:is_current,description';
const SOCIAL_LINK_COLUMNS =
  'platform,label:display_label,url,section,displayOrder:display_order';

/** Same ordering as the former portfolio-service repositories. */
const PROJECT_ORDER = 'featured.desc,display_order.asc,id.asc';

/**
 * Angular's default query encoder leaves characters such as "+" unencoded
 * (servers decode "+" as a space). PostgREST filter values must arrive
 * exactly as written, so encode every key and value strictly.
 */
class StrictParamCodec implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
  encodeValue(value: string): string {
    return encodeURIComponent(value);
  }
  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }
  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}
const STRICT_CODEC = new StrictParamCodec();

/**
 * Case-insensitive EXACT match for a category (the old API used
 * category = ignoring case). PostgREST's "imatch" is a case-insensitive regex,
 * so the value is anchored and its ASCII punctuation escaped to be literal.
 */
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/g;
function exactCaseInsensitive(value: string): string {
  const literal = value.replace(ASCII_PUNCTUATION, '\\$&');
  return 'imatch.^' + literal + '$';
}

/**
 * The single service that talks to the backend. Pages depend on this service
 * and never build URLs or call HttpClient themselves.
 *
 * - Portfolio content (read-only) comes from the Supabase Data API, using only
 *   the public publishable key; Row Level Security limits it to reads.
 * - The contact form still posts to "/api/contact" (unchanged until Phase 7).
 */
@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly http = inject(HttpClient);

  private readonly restBase = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/rest/v1`;
  private readonly restHeaders = new HttpHeaders({
    apikey: SUPABASE_CONFIG.publishableKey,
    Accept: 'application/json',
  });

  private url(path: string): string {
    return `${CONFIG.getBaseUrl()}${path}`;
  }

  /* ------------------------------------------------------------------ */
  /* Portfolio (read-only, Supabase Data API)                            */
  /* ------------------------------------------------------------------ */

  getProfile(): Observable<Profile | null> {
    return this.select<Profile>('profile', {
      select: PROFILE_COLUMNS,
      order: 'id.asc',
      limit: '1',
    }).pipe(
      map((rows) => {
        if (!rows.length) {
          // Same outcome as the former GET /api/portfolio/profile (404).
          throw new ApiError('Profile information has not been configured yet.', { status: 404 });
        }
        return this.asObject<Profile>(rows[0]);
      })
    );
  }

  getProjects(options: { type?: ProjectType; category?: string } = {}): Observable<Project[]> {
    const query: Record<string, string> = { select: PROJECT_COLUMNS, order: PROJECT_ORDER };
    if (options.type) query['project_type'] = `eq.${options.type}`;
    const category = options.category?.trim();
    if (category) query['category'] = exactCaseInsensitive(category);
    return this.select<Project>('projects', query);
  }

  getProjectBySlug(slug: string): Observable<Project | null> {
    if (!slug) return of(null);
    return this.select<Project>('projects', {
      select: PROJECT_COLUMNS,
      slug: `eq.${slug}`,
      limit: '1',
    }).pipe(
      map((rows) => {
        if (!rows.length) {
          // The project page shows its "not found" state for status 404.
          throw new ApiError(`No project found with slug '${slug}'.`, { status: 404 });
        }
        return this.asObject<Project>(rows[0]);
      })
    );
  }

  getSkills(): Observable<Skill[]> {
    return this.select<Skill>('skills', {
      select: SKILL_COLUMNS,
      order: 'display_order.asc,id.asc',
    }).pipe(
      map((skills) =>
        [...skills].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      )
    );
  }

  getEducation(): Observable<Education[]> {
    return this.select<Education>('education', {
      select: EDUCATION_COLUMNS,
      order: 'start_date.desc,id.asc',
    });
  }

  getExperience(): Observable<Experience[]> {
    return this.select<Experience>('experience', {
      select: EXPERIENCE_COLUMNS,
      order: 'start_date.desc,id.asc',
    });
  }

  getSocialLinks(): Observable<SocialLink[]> {
    return this.select<SocialLink>('social_links', {
      select: SOCIAL_LINK_COLUMNS,
      order: 'display_order.asc,id.asc',
    });
  }

  /* ------------------------------------------------------------------ */
  /* Contact (write) — unchanged; moves to Supabase in Phase 7           */
  /* ------------------------------------------------------------------ */

  submitContact(payload: ContactRequest): Observable<ContactResponse> {
    return this.http
      .post<ContactResponse>(this.url('/api/contact'), payload)
      .pipe(catchError((err) => this.fail(err)));
  }

  /* ------------------------------------------------------------------ */
  /* Supabase Data API plumbing                                          */
  /* ------------------------------------------------------------------ */

  /** GET /rest/v1/{table} with PostgREST query parameters; always an array. */
  private select<T>(table: string, query: Record<string, string>): Observable<T[]> {
    let params = new HttpParams({ encoder: STRICT_CODEC });
    for (const [key, value] of Object.entries(query)) params = params.set(key, value);

    return this.http
      .get<T[]>(`${this.restBase}/${table}`, { params, headers: this.restHeaders })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        catchError((err) => this.failData(err))
      );
  }

  /**
   * Errors from the Data API become ApiError with a visitor-friendly message.
   * The raw PostgREST message (table names, SQL codes) is never shown; the
   * HTTP status is kept so pages can keep their existing 404 / 503 handling.
   */
  private failData(err: HttpErrorResponse): Observable<never> {
    if (err instanceof ApiError) return throwError(() => err);

    if (err.status === 0) {
      return throwError(
        () =>
          new ApiError(
            'Network error: the portfolio content could not be reached. Check your connection and try again.'
          )
      );
    }

    return throwError(
      () =>
        new ApiError(`Portfolio content could not be loaded (HTTP ${err.status}).`, {
          status: err.status,
          body: err.error,
        })
    );
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
