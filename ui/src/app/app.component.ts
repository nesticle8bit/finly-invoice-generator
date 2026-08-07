import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm/confirm-dialog.component';
import { ToastContainerComponent } from './shared/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ConfirmDialogComponent, ToastContainerComponent],
  template: `
    <router-outlet />

    <app-confirm-dialog />
    <app-toast-container />
  `,
})
export class AppComponent {}
