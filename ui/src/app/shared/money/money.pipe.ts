import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';

/**
 * Formats an amount in the currency that actually applies, instead of the
 * hardcoded "€" that used to be baked into every template.
 *
 * Resolution order: explicit argument (usually the client's currency) →
 * the profile default → EUR.
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private currencyPipe = inject(CurrencyPipe);
  private profileService = inject(ProfileService);

  transform(value: number | string | null | undefined, currency?: string | null): string {
    const amount = Number(value ?? 0);
    const code = (currency || this.profileService.currency() || 'EUR').toUpperCase();
    return this.currencyPipe.transform(amount, code, 'symbol', '1.0-2') ?? '';
  }
}
