import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductEditComponentB } from './product-edit-b.component';

describe('ProductEditBComponent', () => {
  let component: ProductEditComponentB;
  let fixture: ComponentFixture<ProductEditComponentB>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductEditComponentB]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductEditComponentB);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
