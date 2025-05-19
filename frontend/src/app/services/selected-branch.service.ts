import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Branch, BranchService } from './branch.service';

@Injectable({
  providedIn: 'root'
})
export class SelectedBranchService {
  private branchService = inject(BranchService);

  private selectedBranchSubject = new BehaviorSubject<Branch | null>(null);
  public selectedBranch$: Observable<Branch | null> = this.selectedBranchSubject.asObservable();

  private readonly storageKey = 'SucursalSeleccionada';

  constructor() {
    this.loadSelectedBranchFromStorage();
  }

  private loadSelectedBranchFromStorage(): void {
    const storedBranchCode = localStorage.getItem(this.storageKey);
    if (storedBranchCode) {
      this.branchService.getBranchByCode(storedBranchCode).pipe(
        tap(branch => {
          if (branch) {
            this.selectedBranchSubject.next(branch);
          } else {
            localStorage.removeItem(this.storageKey);
          }
        }),
        catchError(err => {
          console.error('Error al cargar sucursal desde localStorage y API:', err);
          localStorage.removeItem(this.storageKey);
          this.selectedBranchSubject.next(null);
          return of(null);
        })
      ).subscribe();
    } else {
      this.selectedBranchSubject.next(null);
    }
  }

  setSelectedBranch(branch: Branch | null): void {
    if (branch) {
      localStorage.setItem(this.storageKey, branch.branch_code);
      this.selectedBranchSubject.next(branch);
    } else {
      localStorage.removeItem(this.storageKey);
      this.selectedBranchSubject.next(null);
    }
  }

  clearSelectedBranch(): void {
    this.setSelectedBranch(null);
  }

  getSelectedBranchValue(): Branch | null {
    return this.selectedBranchSubject.value;
  }
}
