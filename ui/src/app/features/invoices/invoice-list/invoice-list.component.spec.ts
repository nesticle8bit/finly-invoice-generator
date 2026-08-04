import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { InvoiceListComponent } from './invoice-list.component';

const SORT_KEY = 'inv_sort';

describe('InvoiceListComponent sort persistence', () => {
  let controller: HttpTestingController;

  function createComponent(): InvoiceListComponent {
    const fixture = TestBed.createComponent(InvoiceListComponent);
    fixture.detectChanges();
    // The screen fires its initial requests on init; flush them so verify() passes.
    controller.match(() => true).forEach((req) => req.flush({ data: [], total: 0, page: 1, limit: 20 }));
    return fixture.componentInstance;
  }

  beforeEach(() => {
    localStorage.removeItem(SORT_KEY);

    TestBed.configureTestingModule({
      imports: [InvoiceListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    localStorage.removeItem(SORT_KEY);
  });

  it('defaults to newest first when nothing is stored', () => {
    const component = createComponent();

    expect(component.sortColumn()).toBe('date');
    expect(component.sortAsc()).toBeFalse();
  });

  it('stores the column and direction when a header is clicked', () => {
    const component = createComponent();

    component.sortBy('total');
    controller.match(() => true).forEach((req) => req.flush({ data: [], total: 0, page: 1, limit: 20 }));

    expect(JSON.parse(localStorage.getItem(SORT_KEY)!)).toEqual({ column: 'total', asc: false });
  });

  it('restores the stored order on the next visit', () => {
    localStorage.setItem(SORT_KEY, JSON.stringify({ column: 'client_name', asc: true }));

    const component = createComponent();

    expect(component.sortColumn()).toBe('client_name');
    expect(component.sortAsc()).toBeTrue();
  });

  it('sends the restored order to the API', () => {
    localStorage.setItem(SORT_KEY, JSON.stringify({ column: 'status', asc: true }));

    const fixture = TestBed.createComponent(InvoiceListComponent);
    fixture.detectChanges();

    const listRequest = controller.match((req) => req.url.endsWith('/invoices'))[0];
    expect(listRequest.request.params.get('sort')).toBe('status');
    expect(listRequest.request.params.get('order')).toBe('asc');

    controller.match(() => true).forEach((req) => req.flush({ data: [], total: 0, page: 1, limit: 20 }));
  });

  it('ignores a stored column that no longer exists', () => {
    localStorage.setItem(SORT_KEY, JSON.stringify({ column: 'dropped_column', asc: true }));

    const component = createComponent();

    expect(component.sortColumn()).toBe('date');
  });

  it('ignores corrupt storage instead of throwing', () => {
    localStorage.setItem(SORT_KEY, 'not-json');

    expect(() => createComponent()).not.toThrow();
  });
});
