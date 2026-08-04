import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Builds an unsigned JWT whose `exp` is offset from now — enough for client-side checks. */
function tokenExpiringIn(seconds: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + seconds };
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('stores the token and user after a successful login', () => {
    service.login('a@b.c', 'secret').subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/auth/login'));
    expect(req.request.method).toBe('POST');
    req.flush({ token: tokenExpiringIn(3600), user: { id: 1, name: 'A', email: 'a@b.c' } });

    expect(service.getToken()).toBeTruthy();
    expect(service.currentUser()?.email).toBe('a@b.c');
  });

  it('treats an expired token as unauthenticated and clears it', () => {
    localStorage.setItem('inv_token', tokenExpiringIn(-60));

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeNull();
  });

  it('accepts a token that is still valid', () => {
    localStorage.setItem('inv_token', tokenExpiringIn(3600));
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('accepts a malformed token rather than locking the user out client-side', () => {
    // The server is the authority; an unparseable payload must not be treated as expired.
    localStorage.setItem('inv_token', 'not-a-jwt');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('logout clears the session and navigates to login', () => {
    localStorage.setItem('inv_token', tokenExpiringIn(3600));

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
