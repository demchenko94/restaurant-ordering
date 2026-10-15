import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type ApiErrorView } from '../errors/api-error-view';
import {
  errorInterceptor,
  requestIdInterceptor,
  retryInterceptor,
  timeoutInterceptor,
} from './interceptors';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            requestIdInterceptor,
            errorInterceptor,
            retryInterceptor,
            timeoutInterceptor,
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    jest.useRealTimers();
  });

  it('adds a request id header', () => {
    void firstValueFrom(http.get('/api/x'));
    const req = controller.expectOne('/api/x');
    expect(req.request.headers.get('X-Request-Id')).toMatch(/[0-9a-f-]{36}/);
    req.flush({});
  });

  it('retries a failed GET and succeeds on a later attempt', async () => {
    const result = firstValueFrom(http.get('/api/menu'));
    controller.expectOne('/api/menu').error(new ProgressEvent('error'), { status: 0 });
    await jest.advanceTimersByTimeAsync(500);
    controller.expectOne('/api/menu').flush({ ok: true });
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('gives up after the retry budget and reports a normalized error', async () => {
    const result = firstValueFrom(http.get('/api/menu')).catch((e: ApiErrorView) => e);
    for (let attempt = 0; attempt < 3; attempt++) {
      controller.expectOne('/api/menu').error(new ProgressEvent('error'), { status: 0 });
      await jest.advanceTimersByTimeAsync(2000);
    }
    expect(await result).toMatchObject({ code: 'NETWORK', retryable: true });
  });

  it('does not retry client errors', async () => {
    const result = firstValueFrom(http.get('/api/x')).catch((e: ApiErrorView) => e);
    controller
      .expectOne('/api/x')
      .flush(
        { error: { code: 'NOT_FOUND', message: 'nope', requestId: 'r' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(await result).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('never retries writes automatically', async () => {
    const result = firstValueFrom(http.post('/api/orders', {})).catch((e: ApiErrorView) => e);
    controller.expectOne('/api/orders').error(new ProgressEvent('error'), { status: 0 });
    await jest.advanceTimersByTimeAsync(5000);
    controller.expectNone('/api/orders');
    expect(await result).toMatchObject({ code: 'NETWORK' });
  });

  it('turns a silent server into a TIMEOUT error', async () => {
    const result = firstValueFrom(http.post('/api/items', {})).catch((e: ApiErrorView) => e);
    controller.expectOne('/api/items');
    await jest.advanceTimersByTimeAsync(10_001);
    expect(await result).toMatchObject({ code: 'TIMEOUT', retryable: true });
  });
});
