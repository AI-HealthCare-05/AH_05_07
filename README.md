# 상균7데이즈 (SK7)

혈압 위험군 선별 신호와 7일 관찰 기록을 분리하는 Talos 웹 서비스.

## Contract

- 공개 데이터로 학습한 고혈압 위험군 분류 모델
- 아침·저녁 혈압 기록, 입력 품질, 생활습관 챌린지의 분리된 추이
- 진단·처방·치료 효과 판정 없음
- 합성 또는 비식별 데모 데이터만 처리

## Repository map

- [Requirements](docs/requirements.md)
- [Architecture and ERD](docs/architecture.md)
- [Data contract](docs/data-contract.md)
- [API contract](docs/api-contract.md)
- [UX flow](docs/ux-flow.md)
- [ADR-0001](docs/adr/0001-modular-monolith.md)

## Verification

```bash
uv sync --group app --frozen
uv run ruff check .
uv run ruff format . --check
uv run coverage run -m pytest app
uv run coverage report -m
```
