import { TestBed } from '@angular/core/testing';
import { Sala } from './sala';

describe('Sala', () => {
  let service: Sala;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sala);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
