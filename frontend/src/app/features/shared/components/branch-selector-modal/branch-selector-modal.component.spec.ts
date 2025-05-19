import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchSelectorModalComponent } from './branch-selector-modal.component';

describe('BranchSelectorModalComponent', () => {
  let component: BranchSelectorModalComponent;
  let fixture: ComponentFixture<BranchSelectorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchSelectorModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchSelectorModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
