import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch, BranchService } from '../../../../services/branch.service';
import { SelectedBranchService } from '../../../../services/selected-branch.service';

@Component({
  selector: 'app-branch-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-selector-modal.component.html',
  styleUrls: ['./branch-selector-modal.component.scss']
})
export class BranchSelectorModalComponent implements OnInit {
  private branchService = inject(BranchService);
  private selectedBranchService = inject(SelectedBranchService);

  @Output() branchSelected = new EventEmitter<Branch>();
  @Output() modalClosed = new EventEmitter<void>();

  availableBranches: Branch[] = [];
  isLoadingBranches = true;
  locallySelectedBranchCode: string | null = null;

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.isLoadingBranches = true;
    this.branchService.getBranches().subscribe({
      next: (branches) => {
        this.availableBranches = branches;
        this.isLoadingBranches = false;
      },
      error: (err) => {
        console.error('Error al cargar sucursales en el modal:', err);
        this.isLoadingBranches = false;
      }
    });
  }

  confirmSelection(): void {
    if (this.locallySelectedBranchCode) {
      const selectedBranchObject = this.availableBranches.find(
        b => b.branch_code === this.locallySelectedBranchCode
      );
      if (selectedBranchObject) {
        this.selectedBranchService.setSelectedBranch(selectedBranchObject);
        this.branchSelected.emit(selectedBranchObject);
      }
    }
  }

  onClose(): void {
    this.modalClosed.emit();
  }
}
