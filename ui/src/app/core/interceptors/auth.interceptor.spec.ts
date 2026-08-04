import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'url', { value: '/invoices', writable: false });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('attaches the bearer token when one is stored', () => {
    localStorage.setItem('inv_token', 'stored-token');

    http.get('/api/invoices').subscribe();

    const req = controller.expectOne('/api/invoices');
    expect(req.request.headers.get('Authorization')).toBe('Bearer stored-token');
    req.flush({});
  });

  it('sends no Authorization header when logged out', () => {
    http.get('/api/invoices').subscribe();

    const req = controller.expectOne('/api/invoices');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('clears the session and redirects on a 401 from a protected endpoint', () => {
    localStorage.setItem('inv_token', 'expired-token');

    http.get('/api/invoices').subscribe({ error: () => undefined });

    controller.expectOne('/api/invoices').flush({ error: 'nope' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/invoices' } });
  });

  it('leaves the session alone when login itself returns 401', () => {
    localStorage.setItem('inv_token', 'some-token');

    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });

    controller
      .expectOne('/api/auth/login')
      .flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.getToken()).toBe('some-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves the session alone when a public share link returns 401', () => {
    localStorage.setItem('inv_token', 'some-token');

    http.post('/api/public/share/abc', {}).subscribe({ error: () => undefined });

    controller
      .expectOne('/api/public/share/abc')
      .flush({ error: 'Incorrect password' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.getToken()).toBe('some-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
