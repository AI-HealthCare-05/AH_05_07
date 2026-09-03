# 상균7데이즈 (SK7)

입력 기반 위험군 선별 신호와 7일 관찰 기록을 분리하도록 설계한 웹 서비스.

## Contract

- 검증된 아티팩트가 준비된 뒤에만 공개하는 입력 기반 위험군 선별 신호
- 아침·저녁 혈압 관찰과 생활습관 챌린지를 별도 사실로 기록
- 진단·처방·치료 효과 판정 없음
- 합성 데모 데이터만 처리

## Repository map

- [Requirements](docs/requirements.md)
- [Architecture and ERD](docs/architecture.md)
- [Data contract](docs/data-contract.md)
- [API contract](docs/api-contract.md)
- [UX flow](docs/ux-flow.md)
- [Visual production contract](docs/visual-production-contract.md)
- [G1 visual direction](docs/visual-direction.md)
- [G2 prototype decision record](docs/g2-prototype.md)
- [Asset register](docs/asset-register.md)
- [Deployment SSOT](docs/deployment-ssot.md)
- [ADR-0001](docs/adr/0001-modular-monolith.md)

## Verification

```bash
uv sync --group app --frozen
uv run ruff check .
uv run ruff format . --check
uv run coverage run -m pytest app
uv run coverage report -m
```
