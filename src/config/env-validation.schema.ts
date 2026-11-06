import Joi from 'joi';

/** What the API needs: its port and the queue. */
export const apiEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('production'),
  PORT: Joi.number().port().default(3000),
  QUEUE_HOST: Joi.string().hostname().required(),
  QUEUE_PORT: Joi.number().port().default(6379),
  QUEUE_PASSWORD: Joi.string().required(),
});

/** What the worker needs: the same, plus the Kafka topic it publishes to and its client certificate. */
export const workerEnvValidationSchema = apiEnvValidationSchema.keys({
  KAFKA_BOOTSTRAP_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('producer-a-worker'),
  KAFKA_TOPIC: Joi.string().required(),
  KAFKA_CA_FILE: Joi.string().required(),
  KAFKA_CERT_FILE: Joi.string().required(),
  KAFKA_KEY_FILE: Joi.string().required(),
});
