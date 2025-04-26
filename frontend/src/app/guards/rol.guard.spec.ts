import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { rolesGuard } from './rol.guard';

describe('rolGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => rolesGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
