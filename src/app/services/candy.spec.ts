import { TestBed } from '@angular/core/testing';
import { CandyService } from './candy';

describe('Candy', () => {
  let service: CandyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CandyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
