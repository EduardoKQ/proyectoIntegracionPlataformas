import {Component,EventEmitter,Output,Input,OnInit,OnChanges,SimpleChanges,inject,ChangeDetectorRef} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../../services/branch.service';

export interface DeliveryAddress {
  street: string;
  number: string;
  apartment?: string;
  instructions?: string;
}

export type ModalSelectionType = 'delivery' | 'pickup';

@Component({
  selector: 'app-address-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-modal.component.html',
  styleUrls: ['./address-modal.component.scss']
})
export class AddressModalComponent implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Input() initialMode: ModalSelectionType = 'delivery';
  @Input() availableBranches: Branch[] = [];
  @Input() preSelectedBranchCode?: string | null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() addressSubmitted = new EventEmitter<DeliveryAddress>();
  @Output() pickupBranchSelected = new EventEmitter<Branch>();

  addressForm: FormGroup;
  pickupForm: FormGroup;
  activeMode: ModalSelectionType;

  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.activeMode = this.initialMode;

    this.addressForm = this.fb.group({
      street: ['', Validators.required],
      number: ['', Validators.required],
      isStreetWithoutNumber: [false],
      apartment: [''],
      instructions: ['']
    });

    this.pickupForm = this.fb.group({
      selectedBranchCode: ['', Validators.required]
    });

    this.addressForm.get('isStreetWithoutNumber')?.valueChanges.subscribe(isStreetWithoutNumber => {
      const numberControl = this.addressForm.get('number');
      if (isStreetWithoutNumber) {
        numberControl?.clearValidators();
        numberControl?.setValue('');
        numberControl?.disable();
      } else {
        numberControl?.setValidators(Validators.required);
        numberControl?.enable();
      }
      numberControl?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.activeMode = this.initialMode;
    if (this.activeMode === 'pickup') {
      this.setDefaultPickupSelection();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    let modeChangedToPickup = false;
    if (changes['initialMode']) {
      const newMode = changes['initialMode'].currentValue;
      if (this.activeMode !== newMode) {
        this.activeMode = newMode;
        if (this.activeMode === 'pickup') {
          modeChangedToPickup = true;
        }
      }
    }

    if (this.activeMode === 'pickup' && (modeChangedToPickup || changes['availableBranches'] || changes['preSelectedBranchCode'])) {
      this.setDefaultPickupSelection();
    }
  }

  private setDefaultPickupSelection(): void {
    if (!this.pickupForm) {
        return;
    }
    const selectedBranchControl = this.pickupForm.get('selectedBranchCode');
    if (!selectedBranchControl) {
        return;
    }

    let newBranchCodeToSelect: string | null = null;

    if (this.preSelectedBranchCode && this.availableBranches.some(b => b.branch_code === this.preSelectedBranchCode)) {
      newBranchCodeToSelect = this.preSelectedBranchCode;
    } else if (this.availableBranches && this.availableBranches.length > 0) {
      newBranchCodeToSelect = this.availableBranches[0].branch_code;
    } else {
      newBranchCodeToSelect = null;
    }

    selectedBranchControl.setValue(newBranchCodeToSelect);
    this.cdr.detectChanges();
  }

  switchToMode(mode: ModalSelectionType): void {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    if (mode === 'pickup') {
      this.setDefaultPickupSelection();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.activeMode === 'delivery') {
      if (this.addressForm.valid) {
        const formData = this.addressForm.getRawValue();
        const address: DeliveryAddress = {
          street: formData.street,
          number: formData.isStreetWithoutNumber ? 'S/N' : formData.number,
          apartment: formData.apartment,
          instructions: formData.instructions
        };
        this.addressSubmitted.emit(address);
        this.onClose();
      } else {
        this.addressForm.markAllAsTouched();
      }
    } else if (this.activeMode === 'pickup') {
      if (this.pickupForm.valid) {
        const selectedCode = this.pickupForm.get('selectedBranchCode')?.value;
        if (!selectedCode) {
            this.pickupForm.markAllAsTouched();
            return;
        }
        const selectedBranch = this.availableBranches.find(b => b.branch_code === selectedCode);
        if (selectedBranch) {
          this.pickupBranchSelected.emit(selectedBranch);
          this.onClose();
        }
      } else {
        this.pickupForm.markAllAsTouched();
      }
    }
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
