import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:8100';

export interface ShippingCalculationResponse {
  distance_text: string;
  distance_value: number;
  duration_text: string;
  duration_value: number;
  cost: number;
  origin_address_maps: string;
  destination_address_maps: string;
  origin_branch_code: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/api/maps/calculate-shipping/`;

  constructor() { }

  calculateShipping(destinationAddress: string, branchCode: string): Observable<ShippingCalculationResponse> {
    const payload = {
      destinationAddress: destinationAddress,
      branchCode: branchCode
    };
    console.log("Enviando a backend para cálculo:", payload);
    return this.http.post<ShippingCalculationResponse>(this.apiUrl, payload);
  }
}
