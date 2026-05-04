# E2E smoke tests

Install once:

```bash
npm install
npm run test:e2e:install
```

Run against `dist/` when present, otherwise the repository root:

```bash
npm run test:e2e
```

Run against the repository root explicitly:

```bash
E2E_STATIC_DIR=. npm run test:e2e
```

Run against an already-started local server:

```bash
E2E_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```
