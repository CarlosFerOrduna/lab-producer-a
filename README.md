# lab-producer-a

One of the two producer services of the lab: a NestJS service that publishes events to Kafka for [lab-processor](https://github.com/CarlosFerOrduna/lab-processor) to consume.

## Role in the lab

Runs in its own `producer-a` namespace of the k3s cluster. [lab-producer-b](https://github.com/CarlosFerOrduna/lab-producer-b) runs in its own namespace too, and both feed the single processor in the `platform` namespace. Unlike lab-producer-b, it has no database of its own. ArgoCD deploys it from [lab-gitops](https://github.com/CarlosFerOrduna/lab-gitops) (`producer-a/`).

## Status

Today:

- `GET /health` returns `200 {"status":"ok"}`.
- `POST /messages` gives the message its own id, queues a `message.created` event in its own Valkey with BullMQ, and answers once the event is safely queued (see [API](#api)).
- A separate worker process takes the events from the queue and publishes them to the Kafka topic `producer-a.messages`, with its own client certificate (mTLS), through an `EventPublisher` interface (see [Kafka publishing](#kafka-publishing)). Retries, with backoff, belong to the queue (see [Queue](#queue)).
- `GET /health` for liveness and `GET /health/ready` for readiness: the API is ready only if the queue accepts writes.
- Environment configuration validated at startup with Joi.
- Multi-stage `Dockerfile` that runs as the unprivileged `node` user, on a base image pinned by digest.
- A `compose.yaml` with the queue's Valkey and the API. The worker runs only in the cluster, next to Kafka.
- npm scripts that CI will call:

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run lint`         | ESLint, without `--fix`, so violations fail the build.    |
| `npm test`             | Jest unit tests (`*.spec.ts` next to the code they test). |
| `npm run build`        | Compiles to `dist/`.                                      |
| `npm start`            | Runs the API (`dist/main`).                               |
| `npm run start:worker` | Runs the worker (`dist/worker`).                          |
| `npm run start:dev`    | Watch mode for local work.                                |
| `npm run format`       | Prettier over `src/`.                                     |

NestJS 12 ships as ES modules only, so `npm test` runs Jest with `--experimental-vm-modules`.

Planned:

- Publish straight from the API to Kafka and retire the queue, so events of one message keep their order (see [Kafka publishing](#kafka-publishing)).
- Call the processor through the platform gateway, never directly.
- One Redis for cache and a separate Redis for BullMQ queues.
- No database of its own: persistent data belongs to the processor.
- Graceful shutdown: stop accepting work, flush pending messages, then exit.

## Run locally

Requires Node 26 (see `.nvmrc`) and Docker. Compose runs no Kafka, so it runs no worker either: events wait in the local queue.

Create a local `.env` with the Valkey password for compose. It is ignored by git and never committed:

```bash
printf 'VALKEY_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
chmod 600 .env
```

Everything in Docker Compose, with the API on port 3001:

```bash
docker compose up --build
```

- `valkey-queue`: Valkey 9.1 with the configuration in `valkey/queue.conf` (AOF, `noeviction`, 128 MB). It runs as its own user (999), and reads the password from a separate config file that compose builds from `.env` (`include`), never from the command line.
- `producer-a`: the API. The worker is the same image running `node dist/worker.js`, in the cluster only.

## API

| Method and path     | What it does                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /messages`    | Body `{ "text": "..." }` (up to 500 characters). Gives the message an id, queues a `message.created` event about it and answers `202 { "eventId": "...", "messageId": "..." }`, or `503` if the queue does not take it. |
| `GET /health`       | `200` while the process is up. Never checks the queue.                                                                                                                                                                  |
| `GET /health/ready` | `200` if the queue accepts a write within 1 s, `503` otherwise (Valkey down, or full: with `noeviction` it still answers `PING` but rejects writes).                                                                    |

```bash
curl -X POST localhost:3001/messages -H 'content-type: application/json' -d '{"text":"hello"}'
```

`202` means the event is in the queue, not that the processor has it: if Kafka is down, the event waits in the queue.

The event carries the message's id in its payload: `{ "messageId": "...", "text": "..." }`. The event's own `id` identifies the event; `messageId` identifies the message, and is the event's Kafka key.

## Queue

- BullMQ queue `events` on Valkey. The job id is the event id, so the same event queued twice is stored once, and the processor stores each id once.
- The worker publishes with a single attempt, bounded by 5 s. On failure, BullMQ retries with a backoff that doubles from 1 s up to 60 s, for 1440 attempts (about a day).
- A record Kafka refuses (see [Kafka publishing](#kafka-publishing)) means a bad event: the worker throws `UnrecoverableError` and the job fails at once, without retries.
- With `noeviction`, Valkey never frees memory on its own, so finished jobs are trimmed: the last 1000 completed, and failed ones for 7 days.
- On `SIGTERM` the worker calls `worker.close()`: it finishes the jobs in progress before exiting, so a rollout never cuts an event halfway.
- The queue is stored with AOF (`appendfsync everysec`): events survive a Valkey restart, and at most the last second of writes is lost if the machine stops abruptly.

## Kafka publishing

The worker (`node dist/worker.js`, in the cluster the `producer-a-worker` Deployment) publishes each event to the topic `producer-a.messages` as the Kafka user `producer-a`, with its own client certificate (mTLS). Its ACL allows writing only to topics under `producer-a.`. It serves only `GET /health`, for its liveness probe.

- **Key**: the message's id (`payload.messageId`), so every event about one message goes to the same partition. An event queued before messages had an id is keyed by its own `id`.
- **Value**: the whole event as JSON, with its `id`: the processor stores each `id` once.
- **TLS**: only the CA, the certificate and its key. Node checks the broker's certificate chain and host name, so the brokers are reached by host name, never by IP.

**Delivery is at-least-once.** The producer is idempotent (`acks: all`), so the broker drops the duplicates of the client's own internal retries. It cannot drop BullMQ's: when a send outlasts its 5 s timeout but reaches Kafka later, BullMQ's retry publishes the event again. The processor absorbs those duplicates, since it stores each event `id` once.

**Order per key is not guaranteed yet.** With BullMQ in between, a failed event is retried after later events, so an event can reach Kafka after a newer event about the same message. Publishing straight from the API, without the queue, is planned.

| What happens                                                     | The worker                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kafka takes the event                                            | Completes the job.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Kafka refuses the record (`MESSAGE_TOO_LARGE`, `INVALID_RECORD`) | Fails the job at once, without retries: sending it again gets the same answer.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Kafka is down, or does not answer within 5 s                     | Fails the attempt; BullMQ retries it with backoff. The event waits in the queue meanwhile.                                                                                                                                                                                                                                                                                                                                                                                         |
| It cannot reach Kafka when it starts                             | Keeps serving `/health` and takes no job from the queue. A certificate error (`ERR_TLS_*` but a handshake timeout, `*CERT*`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `*UNKNOWN_CA`) fails at once, since retrying cannot fix it. Anything else is retried every 2 s for at most 120 s. Either way it then logs the root cause (`Could not start publishing: … <- Error[ERR_TLS_CERT_ALTNAME_INVALID]: …`) and exits with 1, and Kubernetes' CrashLoopBackOff decides when to try again. |

The worker takes jobs from the queue only after Kafka answers: before that, a job would only fail and wait for its backoff. The Kafka client gives up a send on its own within about 10 s (2 s to connect, 3 s per request, 2 retries), so sends never pile up in the client while BullMQ retries: by default, an idempotent producer retries forever.

The image carries no optional dependencies (`npm prune --omit=optional`): `@platformatic/kafka` computes CRC32C in WASM instead of the prebuilt native binary of `@node-rs/crc32`, so the image has no native code.

## Configuration

The service reads only real environment variables. `.env` files are ignored by the service: compose uses `.env` only to fill in `compose.yaml`.

| Variable         | Used by        | Default      | Validation                                                           |
| ---------------- | -------------- | ------------ | -------------------------------------------------------------------- |
| `NODE_ENV`       | API and worker | `production` | One of `development`, `test`, `production`.                          |
| `PORT`           | API and worker | `3000`       | A valid TCP port number. The worker serves only `GET /health` on it. |
| `QUEUE_HOST`     | API and worker | required     | Host name of the queue's Valkey.                                     |
| `QUEUE_PORT`     | API and worker | `6379`       | A valid TCP port number.                                             |
| `QUEUE_PASSWORD` | API and worker | required     | The queue's Valkey password. In the cluster it comes from a Secret.  |

The worker also needs these (the API ignores them):

| Variable                  | Default             | Validation                                                                 |
| ------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `KAFKA_BOOTSTRAP_BROKERS` | required            | Comma-separated `host:port` list. A host name, never an IP: TLS checks it. |
| `KAFKA_CLIENT_ID`         | `producer-a-worker` | The client id the brokers log.                                             |
| `KAFKA_TOPIC`             | required            | The topic it publishes to.                                                 |
| `KAFKA_CA_FILE`           | required            | The CA that verifies the brokers (the lab's root).                         |
| `KAFKA_CERT_FILE`         | required            | The worker's client certificate (`CN=producer-a`).                         |
| `KAFKA_KEY_FILE`          | required            | Its private key.                                                           |

An invalid value stops the process at startup with a validation error. The image carries no environment-specific values: the same image runs in dev, stage and prod, and each environment's values come from its overlay in [lab-gitops](https://github.com/CarlosFerOrduna/lab-gitops).

## Branch model

| Branch        | Purpose                  |
| ------------- | ------------------------ |
| `development` | Deploys to dev.          |
| `stage`       | Deploys to stage.        |
| `main`        | Deploys to prod.         |
| `fer`         | Personal working branch. |

- `development`, `stage` and `main` are fixed branches: they are never deleted or force-pushed.
- Work happens on the personal branch and is merged locally into `development`, then `development` into `stage`. There are no pull requests.
- Only the production owner updates `main`.

## Pipeline

Today, `.github/workflows/image.yml` publishes the image on every push to `development`, and on demand with **Run workflow** (`workflow_dispatch`). It calls the reusable [`container-image.yml`](https://github.com/CarlosFerOrduna/lab-ci-workflows) of lab-ci-workflows, so the three services publish the same way:

- The tag is the tree hash of the commit (`git rev-parse HEAD^{tree}`): `ghcr.io/carlosferorduna/lab-producer-a:<tree hash>`.
- If that tag already exists, nothing is built: the same content is never published twice.
- It authenticates with the workflow's own `GITHUB_TOKEN` (`packages: write`), never with a personal token.
- The `org.opencontainers.image.source` label links the package to this repository.

Planned:

1. On push to `development`: run the npm scripts (`lint`, `test`), then build an image tagged with the tree hash (`git rev-parse HEAD^{tree}`). The image is deployed to dev only if the tests pass.
2. On push to `stage` or `main`: reuse the image whose tag matches the tree hash. The job fails if that image does not exist and never rebuilds it.
3. CI updates the image tag in the matching [lab-gitops](https://github.com/CarlosFerOrduna/lab-gitops) overlay. Dev and stage sync automatically. Prod waits for a manual ArgoCD sync.

Tagging by tree hash means a merge that leaves the files unchanged maps to the same image, so stage and prod run exactly what was tested in dev.

## Lab repositories

| Repository                                                              | Role                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [lab-infra](https://github.com/CarlosFerOrduna/lab-infra)               | Builds the infrastructure: Hyper-V VMs today, Ansible and k3s next. Holds the repository settings checklist. |
| [lab-gitops](https://github.com/CarlosFerOrduna/lab-gitops)             | Desired state of the clusters. ArgoCD applies whatever is in this repo.                                      |
| [lab-ci-workflows](https://github.com/CarlosFerOrduna/lab-ci-workflows) | Reusable GitHub Actions workflows shared by every lab repo.                                                  |
| [lab-processor](https://github.com/CarlosFerOrduna/lab-processor)       | Shared processor service, namespace `platform`.                                                              |
| [lab-producer-a](https://github.com/CarlosFerOrduna/lab-producer-a)     | Producer service, namespace `producer-a`.                                                                    |
| [lab-producer-b](https://github.com/CarlosFerOrduna/lab-producer-b)     | Producer service, namespace `producer-b`.                                                                    |
