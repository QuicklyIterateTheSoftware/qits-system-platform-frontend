# qits-platform-spa-system

The system console: what the machine the platform runs on is doing.

It is an Angular 21 application and it ships no container image. `qits-platform-system` carries this
repository as a git submodule at `service/src/main/webui` — Quinoa's ui-dir — and builds it into the
service image, which serves it at `/system/`. Everything on screen is read live from the docker
daemon that service holds; nothing here is stored.

## Screens

- **Overview** — a live `glances` terminal for the host, above a line of host facts (hostname, OS,
  CPUs, memory, docker version, swarm state and node count). The glances session is shared: this
  page finds or creates it and only detaches when you leave. `Stop glances` is the one way to end it.
- **Swarm** — nodes, services (with their tasks), configs (with their data) and secrets (metadata
  only, because swarm does not expose the values).
- **A node** — its containers, images, volumes and networks, as child tabs. Every container row
  offers `bash` and `sh`, which open a terminal into it, and `logs`, which shows the last 200 lines.
  Only the node this service runs on is reachable in v1; another node answers `NODE_REMOTE` and the
  tab says so.
- **A terminal** — a full-height xterm.js attached to `WS /system/api/terminals/<id>`. It replays
  the scrollback on every attach, reconnects on a dirty close, and stops for good on a clean one.

## Development

```
npm ci
npm run lint && npm test && npm run build
npm start          # ng serve; proxy.conf.json sends /system/api and /system/q to localhost:8080
```

`npm start` needs something answering at `http://localhost:8080` — the platform edge with
qits-platform-system deployed behind it, or the service's own dev mode.

## Registries

`.npmrc` routes installs at the platform's own registries and carries no credential; a developer's
`~/.npmrc` holds the workstation one. CI overrides both through the environment. The comments in
`.npmrc` and in `.config/qits/ci-post-receive.yml` are where that arrangement is explained.
