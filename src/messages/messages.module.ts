import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PublishingModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
