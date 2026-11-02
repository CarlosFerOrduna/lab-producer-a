import { Body, Controller, HttpCode, HttpStatus, Post, ServiceUnavailableException } from '@nestjs/common';
import { JoiValidationPipe } from '../common/pipes/joi-validation.pipe';
import { EventPublishError } from '../publishing/event-publish.error';
import { SendMessageDto, sendMessageSchema } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@Body(new JoiValidationPipe(sendMessageSchema)) message: SendMessageDto): Promise<{ eventId: string }> {
    try {
      const eventId = await this.messagesService.send(message);
      return { eventId };
    } catch (error) {
      if (error instanceof EventPublishError) {
        throw new ServiceUnavailableException('The event could not be published', { cause: error });
      }
      throw error;
    }
  }
}
