import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { setTimeout as sleep } from 'node:timers/promises';
import { EVENT_QUEUE } from '../queue/constants/event-queue.constant';

const QUEUE_WRITE_TIMEOUT_MS = 1000;
const READINESS_KEY = 'health:producer-a:ready';

@Controller('health')
export class ReadinessController {
  constructor(@Inject(EVENT_QUEUE.probeClientToken) private readonly queueClient: Redis) {}

  /** The API can take traffic: the queue accepts writes within the timeout. For a readiness probe. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok' }> {
    const isQueueWritable = await this.canWriteToQueue();
    if (!isQueueWritable) {
      throw new ServiceUnavailableException('The queue does not accept writes');
    }

    return { status: 'ok' };
  }

  private async canWriteToQueue(): Promise<boolean> {
    const timeout = new AbortController();
    try {
      const outcome = await Promise.race([
        this.writeProbe().then(() => 'written' as const),
        sleep(QUEUE_WRITE_TIMEOUT_MS, 'timed-out' as const, { signal: timeout.signal }),
      ]);
      return outcome === 'written';
    } catch {
      return false;
    } finally {
      timeout.abort();
    }
  }

  // Una escritura y no un PING: con noeviction, Valkey lleno responde PING pero rechaza escrituras.
  private async writeProbe(): Promise<void> {
    await this.queueClient.set(READINESS_KEY, Date.now().toString(), 'PX', 10_000);
  }
}
