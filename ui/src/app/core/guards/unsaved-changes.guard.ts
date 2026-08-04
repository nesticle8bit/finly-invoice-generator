import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../shared/confirm/confirm.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Autosave only runs every 30s, so leaving the editor could silently drop work.
 * `beforeunload` does not fire on in-app navigation — this covers that case.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component.hasUnsavedChanges()) return true;

  const confirmService = inject(ConfirmService);
  return confirmService.ask({
    title: 'Discard unsaved changes?',
    message: 'This invoice has changes that have not been saved yet. Leaving now discards them.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    danger: true,
  });
};
