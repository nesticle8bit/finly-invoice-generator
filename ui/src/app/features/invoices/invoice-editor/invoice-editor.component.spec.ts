import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { InvoiceEditorComponent } from './invoice-editor.component';

describe('InvoiceEditorComponent totals', () => {
  let controller: HttpTestingController;

  function createComponent(): InvoiceEditorComponent {
    const fixture = TestBed.createComponent(InvoiceEditorComponent);
    fixture.detectChanges();
    // Clients, profile and the next invoice number are fetched on init.
    controller.match(() => true).forEach((req) => req.flush(req.request.url.endsWith('next-number') ? { number: '0001' } : []));
    return fixture.componentInstance;
  }

  function setItems(component: InvoiceEditorComponent, rows: { hours: number; rate: number }[]): void {
    component.itemsArray.clear();
    rows.forEach((row, i) => component.itemsArray.push(component.createItemGroup(`Task ${i}`, row.hours, row.rate)));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvoiceEditorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // A catch-all route: saving navigates to the preview, and an
        // unroutable URL would log a router error over the assertions.
        provideRouter([{ path: '**', children: [] }]),
      ],
    });

    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('rounds each line to cents', () => {
    const component = createComponent();
    setItems(component, [{ hours: 1.335, rate: 25 }]);

    expect(component.getItemAmount(0)).toBe(33.38);
  });

  it('totals the rounded lines, not the raw products', () => {
    const component = createComponent();
    setItems(component, [
      { hours: 1.335, rate: 25 },
      { hours: 2.665, rate: 25 },
    ]);

    // Summing the products first would show 100.00 while the rows read 33.38
    // and 66.63.
    expect(component.getTotal()).toBe(100.01);
  });

  it('does not accumulate float noise across many rows', () => {
    const component = createComponent();
    setItems(component, Array.from({ length: 10 }, () => ({ hours: 0.1, rate: 3 })));

    expect(component.getTotal()).toBe(3);
  });

  it('sends rounded amounts and a null due date when the field is empty', () => {
    const component = createComponent();
    component.form.patchValue({ invoice_number: '0001', date: '2026-01-01', due_date: '' });
    setItems(component, [{ hours: 1.335, rate: 25 }]);

    component.onSubmit();

    const post = controller.expectOne((req) => req.method === 'POST' && req.url.endsWith('/invoices'));
    expect(post.request.body.due_date).toBeNull();
    expect(post.request.body.items[0].amount).toBe(33.38);

    post.flush({ id: 1 });
  });

  it('keeps a due date that was filled in', () => {
    const component = createComponent();
    component.form.patchValue({ invoice_number: '0002', date: '2026-01-01', due_date: '2026-02-01' });
    setItems(component, [{ hours: 1, rate: 25 }]);

    component.onSubmit();

    const post = controller.expectOne((req) => req.method === 'POST' && req.url.endsWith('/invoices'));
    expect(post.request.body.due_date).toBe('2026-02-01');

    post.flush({ id: 2 });
  });
});
