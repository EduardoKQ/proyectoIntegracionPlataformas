import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdenesPagoComponent } from './ordenes-pago.component';

describe('OrdenesPagoComponent', () => {
  let component: OrdenesPagoComponent;
  let fixture: ComponentFixture<OrdenesPagoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenesPagoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdenesPagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
