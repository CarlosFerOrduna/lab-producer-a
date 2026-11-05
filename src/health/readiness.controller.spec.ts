import { ServiceUnavailableException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ReadinessController } from './readiness.controller';

describe('ReadinessController', () => {
  let set: jest.Mock;
  let controller: ReadinessController;

  beforeEach(() => {
    set = jest.fn();
    controller = new ReadinessController({ set } as unknown as Redis);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is ready when the queue accepts a write', async () => {
    set.mockResolvedValue('OK');

    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
    expect(set).toHaveBeenCalledWith('health:producer-a:ready', expect.any(String), 'PX', 10_000);
  });

  it('is not ready when the queue rejects writes, as a full noeviction Valkey does', async () => {
    set.mockRejectedValue(new Error("OOM command not allowed when used memory > 'maxmemory'."));

    await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
  });

  it('is not ready when the queue does not answer in time', async () => {
    jest.useFakeTimers();
    set.mockReturnValue(new Promise(() => undefined));

    const readiness = controller.ready();
    await jest.advanceTimersByTimeAsync(1000);

    await expect(readiness).rejects.toThrow(ServiceUnavailableException);
  });
});
