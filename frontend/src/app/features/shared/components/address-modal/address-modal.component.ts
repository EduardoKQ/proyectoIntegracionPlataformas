import { Component, EventEmitter, Output, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
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
  activeMode: ModalSelectionType = 'delivery';

  private fb = inject(FormBuilder);

  constructor() {
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
    if (this.activeMode === 'pickup' && this.preSelectedBranchCode) {
      this.pickupForm.get('selectedBranchCode')?.setValue(this.preSelectedBranchCode);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialMode']) {
      this.activeMode = this.initialMode;
    }
    if (changes['preSelectedBranchCode'] && this.activeMode === 'pickup') {
        this.pickupForm.get('selectedBranchCode')?.setValue(this.preSelectedBranchCode || '');
    }
     if (changes['availableBranches'] && this.availableBranches.length === 0 && this.activeMode === 'pickup') {
      console.warn("Modal en modo pickup pero no hay sucursales disponibles.")
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.activeMode === 'delivery') {
      if (this.addressForm.valid) {
        const formData = this.addressForm.value;
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
        const selectedBranch = this.availableBranches.find(b => b.branch_code === selectedCode);
        if (selectedBranch) {
          this.pickupBranchSelected.emit(selectedBranch);
          this.onClose();
        } else {
          console.error('Sucursal seleccionada no encontrada en la lista de disponibles');
        }
      } else {
        this.pickupForm.markAllAsTouched();
      }
    }
  }

  switchToMode(mode: ModalSelectionType): void {
    this.activeMode = mode;
    if (mode === 'pickup' && this.preSelectedBranchCode) {
        this.pickupForm.get('selectedBranchCode')?.setValue(this.preSelectedBranchCode);
    } else if (mode === 'pickup') {
    }
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
