import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('production'),
  PORT: Joi.number().port().default(3000),
  PROCESSOR_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
});
