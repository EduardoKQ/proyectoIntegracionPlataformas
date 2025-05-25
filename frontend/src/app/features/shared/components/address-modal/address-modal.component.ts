import { Component, EventEmitter, Output, Input, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef, ViewChild, NgZone, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../../services/branch.service';
import { GoogleMapsModule, MapGeocoder, MapGeocoderResponse } from '@angular/google-maps';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';

interface Comuna { name: string; code: string; }
interface Provincia { name: string; comunas: Comuna[]; }
export interface Region { region: string; region_number: string; provincias: Provincia[]; }

export interface DeliveryAddress {
  street: string;
  number: string;
  commune?: string;
  city?: string;
  region?: string;
  fullAddress?: string;
  coordinates?: google.maps.LatLngLiteral;
  apartment?: string;
  instructions?: string;
}
export type ModalSelectionType = 'delivery' | 'pickup';

@Component({
  selector: 'app-address-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule, HttpClientModule],
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

  @ViewChild('mapRef', { static: false }) mapRef!: google.maps.Map;
  @ViewChild('autocompleteInput') autocompleteInput!: ElementRef;

  addressForm: FormGroup;
  pickupForm: FormGroup;
  activeMode: ModalSelectionType;

  private addressChange$ = new Subject<void>();

  mapOptions: google.maps.MapOptions | undefined;
  mapCenter: google.maps.LatLngLiteral = { lat: -33.45694, lng: -70.64827 };
  mapZoom = 12;
  markerPosition: google.maps.LatLngLiteral | undefined = this.mapCenter;
  markerOptions: google.maps.MarkerOptions = { draggable: true };

  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private http = inject(HttpClient);
  private geocoder = inject(MapGeocoder);

  private autocomplete: google.maps.places.Autocomplete | undefined;

  constructor() {
    this.activeMode = this.initialMode;

    this.addressForm = this.fb.group({
      fullAddress: ['', Validators.required],
      street: [''],
      number: [''],
      comuna: [''],
      provincia: [''],
      region: [''],
      apartment: [''],
      instructions: ['']
    });

    this.pickupForm = this.fb.group({
      selectedBranchCode: ['', Validators.required]
    });

    this.addressForm.get('fullAddress')?.valueChanges.pipe(
      debounceTime(1000),
      distinctUntilChanged(),
      switchMap(addressText => {
        if (addressText && addressText.length > 3) {
          return this.geocoder.geocode({ address: `${addressText}, Chile` }).pipe(
            map((response: MapGeocoderResponse) => {
              if (response.status === 'OK' && response.results.length > 0) {
                const location = response.results[0].geometry.location;
                return { latitude: location.lat(), longitude: location.lng(), addressComponents: response.results[0].address_components };
              }
              console.warn("Geocodificación manual falló o no encontró resultados para:", addressText);
              return null;
            }),
            catchError(err => {
              console.error("Error en geocodificación manual:", err);
              return of(null);
            })
          );
        }
        return of(null);
      })
    ).subscribe(result => {
      this.ngZone.run(() => {
        if (result && result.latitude && result.longitude) {
          this.mapCenter = { lat: result.latitude, lng: result.longitude };
          this.markerPosition = { lat: result.latitude, lng: result.longitude };
          this.mapZoom = 17;
          this.updateFormFieldsFromGeocoding(result.addressComponents);
        } else {
          this.markerPosition = this.mapCenter;
          this.mapZoom = 12;
          this.addressForm.patchValue({ street: '', number: '', comuna: '', provincia: '', region: '' }, { emitEvent: false });
        }
        this.cdr.detectChanges();
      });
    });
  }

  ngOnInit(): void {
    this.activeMode = this.initialMode;
    if (this.activeMode === 'pickup') {
      this.setDefaultPickupSelection();
    }
    this.mapOptions = {
      center: this.mapCenter,
      zoom: this.mapZoom,
      mapTypeId: 'roadmap',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapId: 'DEMO_MAP_ID'
    };

    this.ngZone.runOutsideAngular(() => {
      if (this.autocompleteInput && google.maps.places) {
        this.autocomplete = new google.maps.places.Autocomplete(
          this.autocompleteInput.nativeElement,
          {
            componentRestrictions: { country: 'cl' },
            types: ['address'],
            fields: ['address_components', 'geometry', 'formatted_address']
          }
        );

        this.autocomplete.addListener('place_changed', () => {
          this.ngZone.run(() => {
            const place = this.autocomplete?.getPlace();
            if (place?.geometry?.location) {
              this.mapCenter = place.geometry.location.toJSON();
              this.markerPosition = place.geometry.location.toJSON();
              this.mapZoom = 18;

              this.addressForm.patchValue({ fullAddress: place.formatted_address || '' }, { emitEvent: false });
              this.updateFormFieldsFromGeocoding(place.address_components || []);

            } else {
              console.warn("No se encontraron detalles para el lugar seleccionado.");
              this.markerPosition = undefined;
              this.mapZoom = 12;
              this.addressForm.patchValue({ fullAddress: '' }, { emitEvent: false });
            }
            this.cdr.detectChanges();
          });
        });
      }
    });
  }

  geocodeFallback(address: string, zoom: number): void {
    this.geocoder.geocode({ address: address }).subscribe(({ results }) => {
      if (results.length > 0) {
        this.mapCenter = results[0].geometry.location.toJSON();
        this.mapZoom = zoom;
        this.markerPosition = undefined;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    let modeChangedToPickup = false;
    if (changes['initialMode']) {
      const newMode = changes['initialMode'].currentValue;
      if (this.activeMode !== newMode) {
        this.switchToMode(newMode);
        if (newMode === 'pickup') modeChangedToPickup = true;
      }
    }
    if (this.activeMode === 'pickup' && (modeChangedToPickup || changes['availableBranches'] || changes['preSelectedBranchCode'])) {
      this.setDefaultPickupSelection();
    }
  }

  switchToMode(mode: ModalSelectionType): void {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    if (mode === 'pickup') {
      this.setDefaultPickupSelection();
    }
  }

  private setDefaultPickupSelection(): void {
    if (!this.pickupForm) return;
    const selectedBranchControl = this.pickupForm.get('selectedBranchCode');
    if (!selectedBranchControl) return;
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

  onClose(): void { this.closeModal.emit(); }
  stopPropagation(event: Event): void { event.stopPropagation(); }

  onMarkerDragEnd(event: google.maps.MapMouseEvent): void {
    if (event.latLng) {
      this.markerPosition = event.latLng.toJSON();
      this.mapCenter = this.markerPosition;
      this.geocoder.geocode({ location: this.markerPosition }).subscribe(({ results }) => {
        if (results && results.length > 0) {
          this.updateFormFieldsFromGeocoding(results[0].address_components || []);
          this.addressForm.patchValue({ fullAddress: results[0].formatted_address || '' }, { emitEvent: false });
          this.mapZoom = 18;
        } else {
          console.warn('No se encontraron resultados de geocodificación inversa al arrastrar el marcador.');
          this.addressForm.patchValue({ fullAddress: '' }, { emitEvent: false });
          this.mapZoom = 12;
        }
        this.cdr.detectChanges();
      });
    }
  }

  private updateFormFieldsFromGeocoding(addressComponents: google.maps.GeocoderAddressComponent[]): void {
    let streetNumber: string = '';
    let route: string = '';
    let locality: string = '';
    let administrativeAreaLevel2: string = '';
    let administrativeAreaLevel1: string = '';

    addressComponents.forEach(component => {
      if (component.types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (component.types.includes('route')) {
        route = component.long_name;
      } else if (component.types.includes('locality')) {
        locality = component.long_name;
      } else if (component.types.includes('administrative_area_level_2')) {
        administrativeAreaLevel2 = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        administrativeAreaLevel1 = component.long_name;
      }
    });

    this.addressForm.patchValue({
      street: route,
      number: streetNumber,
      comuna: locality,
      provincia: administrativeAreaLevel2,
      region: administrativeAreaLevel1
    }, { emitEvent: false });

    if (route && streetNumber) {
      this.mapZoom = 18;
    } else if (locality) {
      this.mapZoom = 14;
    } else {
      this.mapZoom = 12;
    }
  }

  onSubmit(): void {
    if (this.activeMode === 'delivery') {
      if (this.addressForm.valid) {
        const formData = this.addressForm.getRawValue();
        const address: DeliveryAddress = {
          street: formData.street,
          number: formData.number || '',
          commune: formData.comuna,
          city: formData.provincia,
          region: formData.region,
          fullAddress: formData.fullAddress,
          coordinates: this.markerPosition,
          apartment: formData.apartment,
          instructions: formData.instructions
        };
        this.addressSubmitted.emit(address);
        this.onClose();
      } else {
        this.addressForm.markAllAsTouched();
        console.warn("Formulario de dirección inválido:", this.addressForm.errors);
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
}
