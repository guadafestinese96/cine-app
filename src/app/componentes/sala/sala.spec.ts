import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SalaComponent } from './sala';

describe('Sala', () => {
  let component: SalaComponent;
  let fixture: ComponentFixture<SalaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SalaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
