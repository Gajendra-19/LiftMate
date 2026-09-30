import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideToastr({
      maxOpened: 3,
      autoDismiss: true,
      preventDuplicates: true,
      timeOut: 3500,
      closeButton: true,
      progressBar: true,
      positionClass: 'toast-top-right',
      tapToDismiss: true,
    }),
  ],
};
