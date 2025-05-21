import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
            this.selectedBranchSubject.next(null);
          }
        }),
        catchError(err => {
          localStorage.removeItem(this.storageKey);
          this.selectedBranchSubject.next(null);
          return of(null);
        })
      ).subscribe({
        next: branchOrNull => {
            if (!branchOrNull && storedBranchCode) {
            } else if (branchOrNull) {
            }
        },
        error: () => {  }
    });
    } else {
      this.selectedBranchSubject.next(null);
    }
  }

  public setSelectedBranch(branch: Branch | null): void {
    if (branch && branch.branch_code) {
      localStorage.setItem(this.storageKey, branch.branch_code);
      this.selectedBranchSubject.next(branch);
    } else {
      const currentBranchCodeInStorage = localStorage.getItem(this.storageKey);
      localStorage.removeItem(this.storageKey);
      this.selectedBranchSubject.next(null);
    }
  }

  public clearSelectedBranch(): void {
    this.setSelectedBranch(null);
  }

  public getSelectedBranchValue(): Branch | null {
    return this.selectedBranchSubject.value;
  }
}
