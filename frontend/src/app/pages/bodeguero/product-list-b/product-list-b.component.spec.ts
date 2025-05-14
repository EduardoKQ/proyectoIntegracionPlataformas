import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductListComponentB } from './product-list-b.component';

describe('ProductListBComponent', () => {
  let component: ProductListComponentB;
  let fixture: ComponentFixture<ProductListComponentB>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListComponentB]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListComponentB);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
