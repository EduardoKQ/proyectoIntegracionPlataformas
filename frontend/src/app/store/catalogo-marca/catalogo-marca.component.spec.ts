import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CatalogoMarcaComponent } from './catalogo-marca.component';

describe('CatalogoMarcaComponent', () => {
  let component: CatalogoMarcaComponent;
  let fixture: ComponentFixture<CatalogoMarcaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogoMarcaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CatalogoMarcaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
