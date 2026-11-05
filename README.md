# lab-producer-a

One of the two producer services of the lab: a NestJS service that will publish events to Kafka for [lab-processor](https://github.com/CarlosFerOrduna/lab-processor) to consume.

## Role in the lab

Runs in its own `producer-a` namespace of the k3s cluster. [lab-producer-b](https://github.com/CarlosFerOrduna/lab-producer-b) runs in its own namespace too, and both feed the single processor in the `platform` namespace. Unlike lab-producer-b, it has no database of its own. ArgoCD deploys it from [lab-gitops](https://github.com/CarlosFerOrduna/lab-gitops) (`producer-a/`).

## Status

Today:

- `GET /health` returns `200 {"status":"ok"}`.
- `POST /messages` queues a `message.created` event in its own Valkey with BullMQ, and answers once the event is safely queued (see [API](#api)).
- A separate worker process takes the events from the queue and publishes them to the processor over HTTP, through an `EventPublisher` interface; the Kafka stage replaces only that implementation. Retries, with backoff, belong to the queue (see [Queue](#queue)).
- `GET /health` for liveness and `GET /health/ready` for readiness: the API is ready only if the queue accepts writes.
- Environment configuration validated at startup with Joi.
- Multi-stage `Dockerfile` that runs as the unprivileged `node` user, on a base image pinned by digest.
- A `compose.yaml` with the queue's Valkey, the API and the worker, which publishes to the processor of [lab-processor](https://github.com/CarlosFerOrduna/lab-processor)'s compose.
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

- Publish events to Kafka topics under `producer-a.*`, replacing the HTTP publisher in the worker.
- Call the processor through the platform gateway, never directly.
- One Redis for cache and a separate Redis for BullMQ queues.
- No database of its own: persistent data belongs to the processor.
- Graceful shutdown: stop accepting work, flush pending messages, then exit.

## Run locally

Requires Node 26 (see `.nvmrc`) and Docker. Events go to the processor of [lab-processor](https://github.com/CarlosFerOrduna/lab-processor)'s compose, on port 3000.

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
- `producer-a`: the API. `producer-a-worker`: the same image running `node dist/worker.js`.
- The worker reaches the processor through the host (`host.docker.internal`).

## API

| Method and path     | What it does                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /messages`    | Body `{ "text": "..." }` (up to 500 characters). Queues a `message.created` event and answers `202 { "eventId": "..." }`, or `503` if the queue does not take it. |
| `GET /health`       | `200` while the process is up. Never checks the queue.                                                                                                            |
| `GET /health/ready` | `200` if the queue accepts a write within 1 s, `503` otherwise (Valkey down, or full: with `noeviction` it still answers `PING` but rejects writes).              |

```bash
curl -X POST localhost:3001/messages -H 'content-type: application/json' -d '{"text":"hello"}'
curl 'localhost:3000/events?source=producer-a'   # on the processor, once the worker publishes it
```

`202` means the event is in the queue, not that the processor has it: if the processor is down, the event waits in the queue.

## Queue

- BullMQ queue `events` on Valkey. The job id is the event id, so the same event queued twice is stored once, and the processor stores each id once.
- The worker publishes with a single HTTP attempt. On failure, BullMQ retries with a backoff that doubles from 1 s up to 60 s, for 1440 attempts (about a day).
- A `4xx` from the processor means a malformed event: the worker throws `UnrecoverableError` and the job fails at once, without retries.
- With `noeviction`, Valkey never frees memory on its own, so finished jobs are trimmed: the last 1000 completed, and failed ones for 7 days.
- On `SIGTERM` the worker calls `worker.close()`: it finishes the jobs in progress before exiting, so a rollout never cuts an event halfway.
- The queue is stored with AOF (`appendfsync everysec`): events survive a Valkey restart, and at most the last second of writes is lost if the machine stops abruptly.

## Configuration

The service reads only real environment variables. `.env` files are ignored by the service: compose uses `.env` only to fill in `compose.yaml`.

| Variable         | Used by        | Default      | Validation                                                           |
| ---------------- | -------------- | ------------ | -------------------------------------------------------------------- |
| `NODE_ENV`       | API and worker | `production` | One of `development`, `test`, `production`.                          |
| `PORT`           | API and worker | `3000`       | A valid TCP port number. The worker serves only `GET /health` on it. |
| `QUEUE_HOST`     | API and worker | required     | Host name of the queue's Valkey.                                     |
| `QUEUE_PORT`     | API and worker | `6379`       | A valid TCP port number.                                             |
| `QUEUE_PASSWORD` | API and worker | required     | The queue's Valkey password. In the cluster it comes from a Secret.  |
| `PROCESSOR_URL`  | worker         | required     | `http` or `https` URL of the processor.                              |

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
