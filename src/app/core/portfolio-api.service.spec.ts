import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from './api-error';
import { PortfolioApiService } from './portfolio-api.service';
import { SUPABASE_CONFIG } from './supabase.config';

const REST = `${SUPABASE_CONFIG.url}/rest/v1`;

describe('PortfolioApiService (Supabase Data API)', () => {
  let service: PortfolioApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PortfolioApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectGet(table: string) {
    const req = http.expectOne((r) => r.url === `${REST}/${table}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('apikey')).toBe(SUPABASE_CONFIG.publishableKey);
    expect(req.request.headers.has('Authorization')).toBe(false);
    return req;
  }

  it('uses only a publishable key', () => {
    expect(SUPABASE_CONFIG.publishableKey.startsWith('sb_publishable_')).toBe(true);
    expect(SUPABASE_CONFIG.url).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  });

  it('loads the profile with camelCase aliases', () => {
    let result: unknown;
    service.getProfile().subscribe((p) => (result = p));
    const req = expectGet('profile');
    expect(req.request.params.get('select')).toBe(
      'name,headline,about:about_text,location,resumeUrl:resume_url'
    );
    expect(req.request.params.get('limit')).toBe('1');
    req.flush([{ name: 'N', headline: 'H', about: 'A', location: 'L', resumeUrl: '/r.pdf' }]);
    expect(result).toEqual({ name: 'N', headline: 'H', about: 'A', location: 'L', resumeUrl: '/r.pdf' });
  });

  it('reports a missing profile as a 404 ApiError (as the old API did)', () => {
    let error: unknown;
    service.getProfile().subscribe({ error: (e) => (error = e) });
    expectGet('profile').flush([]);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('filters projects by type and exact, case-insensitive, literal category', () => {
    service.getProjects({ type: 'CREATIVE', category: ' Video Editing+ (4K) ' }).subscribe();
    const req = expectGet('projects');
    expect(req.request.params.get('project_type')).toBe('eq.CREATIVE');
    expect(req.request.params.get('category')).toBe('imatch.^Video Editing\\+ \\(4K\\)$');
    expect(req.request.params.get('order')).toBe('featured.desc,display_order.asc,id.asc');
    expect(req.request.urlWithParams).toContain('%2B'); // "+" is encoded, not sent as a space
    req.flush([]);
  });

  it('omits the category filter when blank', () => {
    service.getProjects({ type: 'CAREER', category: '   ' }).subscribe();
    const req = expectGet('projects');
    expect(req.request.params.has('category')).toBe(false);
    req.flush([]);
  });

  it('returns 404 ApiError for an unknown slug', () => {
    let error: unknown;
    service.getProjectBySlug('missing').subscribe({ error: (e) => (error = e) });
    const req = expectGet('projects');
    expect(req.request.params.get('slug')).toBe('eq.missing');
    req.flush([]);
    expect((error as ApiError).status).toBe(404);
  });

  it('orders education and experience newest first, social links and skills by display order', () => {
    service.getEducation().subscribe();
    expect(expectGet('education').request.params.get('order')).toBe('start_date.desc,id.asc');
    service.getExperience().subscribe();
    const exp = http.expectOne((r) => r.url === `${REST}/experience`);
    expect(exp.request.params.get('select')).toContain('currentRole:is_current');
    exp.flush([]);
    http.match((r) => r.url === `${REST}/education`).forEach((r) => r.flush([]));
    service.getSocialLinks().subscribe();
    const links = expectGet('social_links');
    expect(links.request.params.get('select')).toContain('label:display_label');
    links.flush([]);
    service.getSkills().subscribe();
    const skills = expectGet('skills');
    expect(skills.request.params.get('select')).toContain('proficiency:proficiency_label');
    skills.flush([]);
  });

  it('hides raw database errors and keeps the HTTP status', () => {
    let error: unknown;
    service.getSkills().subscribe({ error: (e) => (error = e) });
    expectGet('skills').flush(
      { code: '42501', message: 'permission denied for table skills' },
      { status: 401, statusText: 'Unauthorized' }
    );
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).not.toContain('permission denied');
  });

  it('leaves the contact form on its existing endpoint (Phase 7)', () => {
    service.submitContact({ name: 'a', email: 'a@b.co', subject: '', message: 'm' }).subscribe();
    const req = http.expectOne('/api/contact');
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'received', message: 'ok' });
  });
});
