# Contributing to k8lens

**Version: 0.1.0** · [GitHub](https://github.com/CodeScapes-dev/k8lens-app)

Thanks for your interest in contributing. This guide covers how to get set up, the branch/PR workflow, and a few conventions to follow.

## Prerequisites

- Node.js 24+
- pnpm (`npm i -g pnpm`)
- A running Kubernetes cluster (local via kind/minikube, or a remote kubeconfig)
- Docker (optional, for building the image locally)

## Local setup

```bash
git clone https://github.com/CodeScapes-dev/k8lens-app.git
cd k8lens-app
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`. It picks up your local kubeconfig automatically.

## Branch workflow

- `main` — stable, production-ready
- `development` — integration branch; all PRs target this branch

```
feature/your-thing → development → main
```

Never open a PR directly to `main`.

## Opening a pull request

1. Branch off `development`:
   ```bash
   git checkout development
   git checkout -b fix/your-thing
   ```
2. Make your changes and commit with a conventional commit message (see below).
3. Push and open a PR against `development`.
4. Link any related issues in the PR description using `Closes #N`.
5. PRs are squash-merged — keep individual commits clean but don't stress over them.

## Commit message format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: short description

Optional longer body explaining the why.
```

Common types: `feat`, `fix`, `refactor`, `chore`, `docs`.

## Reporting issues

Open an issue and include:

- What you expected to happen
- What actually happened
- Kubernetes provider (GKE, AKS, EKS, local, etc.) and version
- Browser console errors if relevant

## Code style

- Lint with `pnpm lint` before pushing.
- No unused imports or variables — the linter will catch these.
- Keep components small; extract shared UI into `components/`, shared logic into `hooks/` or `lib/`.
- Default to no comments unless the intent is non-obvious.

## Telemetry

Telemetry is disabled by default. To test telemetry locally, set the required env vars in `.env.local`:

```
TELEMETRY_DISABLED=false
TELEMETRY_HMAC_SECRET=any-local-secret
TELEMETRY_ENDPOINT=http://localhost:PORT/your-collector
```

## Docker build

```bash
docker build -t k8lens-app .
docker run -p 3000:3000 -v ~/.kube:/root/.kube k8lens-app
```
