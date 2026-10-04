import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyComponent } from './candy';

describe('Candy', () => {
  let component: CandyComponent;
  let fixture: ComponentFixture<CandyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
