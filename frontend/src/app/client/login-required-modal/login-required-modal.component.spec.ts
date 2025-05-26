import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginRequiredModalComponent } from './login-required-modal.component';

describe('LoginRequiredModalComponent', () => {
  let component: LoginRequiredModalComponent;
  let fixture: ComponentFixture<LoginRequiredModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginRequiredModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginRequiredModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
