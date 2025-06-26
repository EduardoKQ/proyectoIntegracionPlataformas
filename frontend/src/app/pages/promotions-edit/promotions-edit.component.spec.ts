import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromotionsEditComponent } from './promotions-edit.component';

describe('PromotionsEditComponent', () => {
  let component: PromotionsEditComponent;
  let fixture: ComponentFixture<PromotionsEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromotionsEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromotionsEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
