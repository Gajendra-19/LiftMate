import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Carrier } from './carrier';

describe('Carrier', () => {
  let component: Carrier;
  let fixture: ComponentFixture<Carrier>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Carrier],
    }).compileComponents();

    fixture = TestBed.createComponent(Carrier);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
