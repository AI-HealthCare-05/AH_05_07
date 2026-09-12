# 상균7데이즈 (SK7)

> **개발·문서 원본:** `AI-HealthCare-05/AH_05_07`.
> `emotigom/ah-05-07-pages`에서 읽고 있다면 이 문서는 동기화된 사본입니다.
> 수정은 원본에서만 합니다. 개발 절차는 [AGENTS.md](AGENTS.md)의 위험 기반 정책,
> 시작 맥락은 [짧은 인계](docs/project-handoff.md#fast-start),
> 운영 판단은 [배포 SSOT](docs/deployment-ssot.md)를 사용합니다.
> main 병합·미러 동기화·운영 배포·scene 활성화는 각각 별개입니다.

입력 기반 위험군 선별 신호와 7일 관찰 기록을 분리하도록 설계한 웹 서비스.

# 미리보기

주 배포 주소: https://hyeol.app/

진단용 fallback: https://ah-05-07-pages.ahnsangkyoon.workers.dev/

이메일로 매직링크를 보내고, 최소 며칠간 접속이 유지됩니다.

테크스택 : vite, google cloud run, cloudflare R2/CDN, supabase, 서브도메인사용 - gomdory.com/gkrry.com

## Contract

- 검증된 아티팩트가 준비된 뒤에만 공개하는 입력 기반 위험군 선별 신호
- 아침·저녁 혈압 관찰과 생활습관 챌린지를 별도 사실로 기록
- 진단·처방·치료 효과 판정 없음
- 합성 데모 데이터만 처리

## Repository map

업무별 참고 목록입니다. 시작할 때 전부 읽지 않습니다. 최신 작업은 짧은 인계와 해당 Issue/PR에서 확인합니다.

- [Requirements](docs/requirements.md)
- [Model V2 product boundary — non-numeric output; lifecycle context inside](docs/model-v2-product-contract.md)
- [Architecture and ERD](docs/architecture.md)
- [Data contract](docs/data-contract.md)
- [API contract](docs/api-contract.md)
- [UX flow](docs/ux-flow.md)
- [Visual production contract](docs/visual-production-contract.md)
- [G1 visual direction](docs/visual-direction.md)
- [G2 prototype decision record](docs/g2-prototype.md)
- [Asset register](docs/asset-register.md)
- [Canva derivative staging](docs/canva-derivative-staging.md)
- [R2 visual v1 runtime boundary](docs/r2-visual-v1-runtime.md)
- [Deployment SSOT](docs/deployment-ssot.md)
- [Project handoff and restart guide](docs/project-handoff.md)
- [Historical work-state ledger](docs/work-state.md)
- [Historical work queue](docs/work-queue.md)
- [Deployed RLS ownership verification plan](docs/deployed-rls-verification-plan.md)
- [Cloudflare Worker rollback evidence plan](docs/cloudflare-rollback-plan.md)
- [ADR-0001](docs/adr/0001-modular-monolith.md)

## Verification

개발 중에는 변경한 경계의 가장 가까운 검사만 반복하고, 최종 PR에서 필수
`lint`와 `test`를 통과시킵니다. 아래는 Python 전체 검증이 필요한 변경의 명령입니다.

```bash
uv sync --group app --frozen
uv run ruff check .
uv run ruff format . --check
uv run coverage run -m pytest app
uv run coverage report -m
```
