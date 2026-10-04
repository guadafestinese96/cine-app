import { TestBed } from '@angular/core/testing';
import { Cupones } from './cupones';

describe('Cupones', () => {
  let service: Cupones;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Cupones);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
