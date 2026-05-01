import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextStore } from './interfaces/request-context.interface';

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.asyncLocalStorage.run(store, callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.asyncLocalStorage.getStore();
  }

  setUserId(userId: string) {
    const store = this.getStore();
    if (store) {
      store.userId = userId;
    }
  }
}
