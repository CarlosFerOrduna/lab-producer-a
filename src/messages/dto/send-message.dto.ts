import Joi from 'joi';

export class SendMessageDto {
  text: string;
}

export const sendMessageSchema = Joi.object<SendMessageDto>({
  text: Joi.string().max(500).required(),
});
