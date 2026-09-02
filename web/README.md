# BP7 web

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL` before starting. Add the local or deployed web origin to both Supabase Auth redirect URLs and the API `API_CORS_ORIGINS` setting.
