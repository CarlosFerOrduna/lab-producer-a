import { Module } from '@nestjs/common';
import { EventQueueModule } from '../queue/event-queue.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [EventQueueModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
