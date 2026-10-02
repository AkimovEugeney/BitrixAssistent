import { Injectable } from '@nestjs/common';
import { BitrixService } from './bitrix.service';

@Injectable()
export class BitrixClientProvider {
  constructor(private readonly defaultClient: BitrixService) {}

  getClient(_userId: string): BitrixService {
    return this.defaultClient;
  }
}
