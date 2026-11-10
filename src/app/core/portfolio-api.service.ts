import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParameterCodec,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiError } from './api-error';
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
 * Persistent stale-while-revalidate cache for read-only portfolio content.
 * A copy of every GET response is kept in localStorage, so a page refresh
 * replays it synchronously at bootstrap (the page renders fully on its
 * first frame) while a fresh request revalidates in the background.
 * Entries older than the TTL are dropped: after that, a refresh fetches
 * (and shows its loading state) exactly once, then re-fills the storage.
 */
const CACHE_STORAGE_KEY = 'portfolio-api-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredEntry {
  fetchedAt: number;
  rows: unknown[];
}

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
 * - The contact form posts to the Supabase Edge Function "contact", which
 *   stores messages server-side; no privileged key is ever used here.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly http = inject(HttpClient);

  /**
   * Portfolio content is read-only, so every GET is cached per table+query
   * for the app's lifetime: repeat subscriptions (and navigation between
   * pages) replay the stored response synchronously and concurrent callers
   * share one in-flight request. A failed request is evicted so the next
   * visit retries instead of replaying the error forever.
   */
  private readonly cache = new Map<string, ReplaySubject<unknown[]>>();

  /** Entries read from localStorage at construction, keyed like `cache`. */
  private readonly hydrated = new Map<string, unknown[]>();

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Record<string, StoredEntry>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(stored)) {
        if (!entry || typeof entry.fetchedAt !== 'number' || !Array.isArray(entry.rows)) continue;
        if (now - entry.fetchedAt > CACHE_TTL_MS) continue;
        this.hydrated.set(key, entry.rows);
      }
    } catch {
      // Storage unavailable or corrupt: start cold; the network still works.
    }
  }

  private persistToStorage(key: string, rows: unknown[]): void {
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as Record<string, StoredEntry>) : {};
      stored[key] = { fetchedAt: Date.now(), rows };
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage full or unavailable: the in-memory cache still works.
    }
  }

  private readonly restBase = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/rest/v1`;
  private readonly contactUrl = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/functions/v1/contact`;
  private readonly restHeaders = new HttpHeaders({
    apikey: SUPABASE_CONFIG.publishableKey,
    Accept: 'application/json',
  });

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
  /* Contact (write, Supabase Edge Function "contact")                   */
  /* ------------------------------------------------------------------ */

  /**
   * The Edge Function validates, de-duplicates, rate-limits and stores the
   * message server-side; the browser sends only the public publishable key.
   */
  submitContact(payload: ContactRequest): Observable<ContactResponse> {
    return this.http
      .post<ContactResponse>(this.contactUrl, payload, {
        headers: new HttpHeaders({
          apikey: SUPABASE_CONFIG.publishableKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      })
      .pipe(catchError((err) => this.fail(err)));
  }

  /* ------------------------------------------------------------------ */
  /* Supabase Data API plumbing                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Warms the read cache in the background (called once by the app shell
   * after first paint) so that navigating to Career, Creative or Contact
   * later renders synchronously from cache instead of showing loading
   * states. Errors are observed and dropped: they evict the cache entry,
   * and each page keeps its own error handling for genuine failures.
   */
  prefetchPortfolioData(): void {
    this.getProfile().subscribe({ error: () => undefined });
    this.getSkills().subscribe({ error: () => undefined });
    this.getEducation().subscribe({ error: () => undefined });
    this.getExperience().subscribe({ error: () => undefined });
    this.getProjects({ type: 'CAREER' }).subscribe({ error: () => undefined });
    this.getProjects({ type: 'CREATIVE' }).subscribe({ error: () => undefined });
    this.getSocialLinks().subscribe({ error: () => undefined });
  }

  /** GET /rest/v1/{table} with PostgREST query parameters; always an array. */
  private select<T>(table: string, query: Record<string, string>): Observable<T[]> {
    let params = new HttpParams({ encoder: STRICT_CODEC });
    for (const [key, value] of Object.entries(query)) params = params.set(key, value);

    const key = `${table}?${params.toString()}`;
    const existing = this.cache.get(key);
    if (existing) return existing.asObservable() as Observable<T[]>;

    // Stale-while-revalidate: a stored response from a previous visit
    // replays synchronously (so a refreshed page renders without loading
    // states), then the fresh request updates subscribers, the cache and
    // the persistent copy in the background. Late subscribers always get
    // the buffered value immediately; the stream completes when the
    // request settles, which is what forkJoin-style consumers await.
    const stream = new ReplaySubject<T[]>(1);
    const hydrated = this.hydrated.get(key) as T[] | undefined;
    this.hydrated.delete(key);
    if (hydrated) stream.next(hydrated);

    this.http
      .get<T[]>(`${this.restBase}/${table}`, { params, headers: this.restHeaders })
      .pipe(
        map((data) => (Array.isArray(data) ? data : [])),
        catchError((err) => this.failData(err))
      )
      .subscribe({
        next: (rows) => {
          stream.next(rows);
          this.persistToStorage(key, rows);
          stream.complete();
        },
        error: (err) => {
          // A genuine failure with nothing to show surfaces exactly as
          // before; when hydrated content is already on screen it is kept
          // (only the background revalidation failed). Either way the
          // entry is evicted, so the next load retries.
          this.cache.delete(key);
          if (hydrated) stream.complete();
          else stream.error(err);
        },
      });

    this.cache.set(key, stream as ReplaySubject<unknown[]>);
    return stream.asObservable();
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

  /**
   * Map a contact-form HttpErrorResponse into the ApiError shape the page
   * expects. Only the function's own visitor-facing messages (validation and
   * rate limiting) are shown; anything else gets a generic message.
   */
  private fail(err: HttpErrorResponse): Observable<never> {
    if (err instanceof ApiError) return throwError(() => err);

    if (err.status === 0) {
      return throwError(
        () => new ApiError('Network error: your message could not be sent.')
      );
    }

    const body = (err.error && typeof err.error === 'object' ? err.error : {}) as {
      message?: string;
      fieldErrors?: FieldError[];
    };
    const ownMessage = err.status === 400 || err.status === 429;

    return throwError(
      () =>
        new ApiError(
          (ownMessage && body.message) || "Sorry, your message couldn't be sent right now.",
          {
            status: err.status,
            fieldErrors:
              ownMessage && Array.isArray(body.fieldErrors)
                ? body.fieldErrors
                : null,
            body: err.error,
          }
        )
    );
  }
}
