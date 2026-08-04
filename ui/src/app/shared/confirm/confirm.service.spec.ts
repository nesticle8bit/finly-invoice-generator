import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmService);
  });

  it('starts with no dialog open', () => {
    expect(service.pending()).toBeNull();
  });

  it('exposes the options while the dialog is open', () => {
    void service.ask({ title: 'Delete invoice', message: 'Are you sure?', danger: true });

    expect(service.pending()?.title).toBe('Delete invoice');
    expect(service.pending()?.danger).toBeTrue();
  });

  it('resolves true and closes when confirmed', async () => {
    const answer = service.ask({ title: 'T', message: 'M' });
    service.respond(true);

    await expectAsync(answer).toBeResolvedTo(true);
    expect(service.pending()).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const answer = service.ask({ title: 'T', message: 'M' });
    service.respond(false);

    await expectAsync(answer).toBeResolvedTo(false);
  });

  it('ignores a response when nothing is pending', () => {
    expect(() => service.respond(true)).not.toThrow();
  });
});
