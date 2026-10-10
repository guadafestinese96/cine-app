import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

export const sessionGuard: CanActivateFn = (route, state) => {
  let sessionId = sessionStorage.getItem('cine_session_id');

  if (!sessionId) {
    sessionId = 'sess-' + crypto.randomUUID();
    sessionStorage.setItem('cine_session_id', sessionId);
  }

  return true;
};