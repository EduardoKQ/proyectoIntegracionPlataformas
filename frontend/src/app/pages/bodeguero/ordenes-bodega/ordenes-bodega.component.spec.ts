import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdenesBodegaComponent } from './ordenes-bodega.component';

describe('OrdenesBodegaComponent', () => {
  let component: OrdenesBodegaComponent;
  let fixture: ComponentFixture<OrdenesBodegaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenesBodegaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdenesBodegaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
