import Joi from 'joi';

/** What the API needs: its port and the queue. */
export const apiEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('production'),
  PORT: Joi.number().port().default(3000),
  QUEUE_HOST: Joi.string().hostname().required(),
  QUEUE_PORT: Joi.number().port().default(6379),
  QUEUE_PASSWORD: Joi.string().required(),
});

/** What the worker needs: the same, plus where to publish the events. */
export const workerEnvValidationSchema = apiEnvValidationSchema.keys({
  PROCESSOR_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
});
