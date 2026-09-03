# 상균7데이즈 (SK7) web

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL` before starting. Add the local or deployed web origin to both Supabase Auth redirect URLs and the API `API_CORS_ORIGINS` setting.

## G3 visual evidence fixtures

The signed-in signature page has four deterministic synthetic `VPF-1` fixtures
for capture only. Select one at build time; there is no in-product fixture
switcher or query parameter.

```bash
VITE_SK7_EVIDENCE_FIXTURE=VP-04 npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-07a npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-10 npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-11a npm run build
```

Use only the resulting local evidence build for the matching sanitized capture.
Do not deploy a build that contains `VITE_SK7_EVIDENCE_FIXTURE`. The fixture
uses `ko-KR`, `Asia/Seoul`, synthetic dates, and masked blood-pressure values.

For local review, these cross-platform commands select a dedicated Vite mode.
Each review screen shows its fixture label; this label is absent from the
normal product.

```bash
npm run dev:evidence:vp-04
npm run dev:evidence:vp-07a
npm run dev:evidence:vp-10
npm run dev:evidence:vp-11a
```
