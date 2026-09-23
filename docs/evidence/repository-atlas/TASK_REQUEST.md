# SK7 Repository Archaeology & Evidence System v1

고추론 장시간 자율모드로 작업한다.

이 작업의 가장 중요한 조건은 **현재 Codex session이 끝까지 유지된다고 가정하지 않는 것**이다.

context compaction, token exhaustion, terminal interruption, Codex 재시작이 언제든 일어날 수 있다.

따라서 이 작업의 성공 조건은:

> 한 번의 session에서 끝내는 것이 아니라, 어떤 순간에 session이 종료되어도 다음 fresh Codex session이 repository에 저장된 상태만 읽고 정확하게 이어서 최종 완료할 수 있도록 만드는 것이다.

대화 context나 현재 모델의 기억에 의존하지 않는다.

---

# 0. Repository and authority

Canonical repository:

```text
AI-HealthCare-05/AH_05_07
```

기본 로컬 canonical repo가 존재한다면:

```text
/Users/gom/Projects/AH_05_07
```

을 기준으로 확인한다.

그러나 과거에 알려진 SHA를 authoritative baseline으로 사용하지 않는다.

작업 시작 시 반드시:

```bash
git fetch origin main
git rev-parse origin/main
git status
git worktree list
git branch --all
```

을 확인한다.

**실제 최신 `origin/main`이 항상 authoritative하다.**

현재 다른 worktree / branch / uncommitted work가 병렬 작업 중일 수 있다.

절대로 다른 작업을:

* reset
* clean
* stash
* checkout 변경
* delete
* overwrite

하지 않는다.

---

# 1. Mission

현재 SK7 repository에는 오랜 개발 과정에서 다음과 같은 evidence가 축적되어 있다.

* architecture decisions
* product decisions
* acceptance criteria
* CI/e2e evidence
* Model V2 evidence
* asset / companion evidence
* deployment / operational evidence
* journey evidence
* security/auth/account evidence
* historical implementation records
* release/tag/milestone references
* SHA / PR / issue references
* superseded documents
* frozen contracts
* temporary research decisions

이들이 여러 문서와 Git history에 분산되어 있다.

이번 작업의 목표는 이것을 단순히 문서 하나로 요약하는 것이 아니다.

**Repository 자체에서 재생성·검증 가능한 Evidence System을 구축한다.**

최종 결과는 최소한 다음 질문에 답할 수 있어야 한다.

1. 어떤 중요한 제품/기술 결정이 존재하는가?
2. 각 결정의 근거 evidence는 어디에 있는가?
3. 어떤 commit / PR / issue / document와 연결되는가?
4. 현재도 유효한가, historical인가, superseded인가?
5. 어떤 frozen boundary를 보호하는가?
6. evidence가 누락되거나 끊긴 곳은 어디인가?
7. repository의 문서가 존재하지 않는 SHA/파일/경로를 참조하고 있지는 않은가?
8. 새로운 개발자가 repository만 받아도 중요한 프로젝트 역사를 추적할 수 있는가?
9. 이 결과를 이후 자동 검증할 수 있는가?

---

# 2. 핵심 원칙

## 2.1 Evidence before narrative

먼저 evidence를 수집하고 구조화한다.

처음부터 장문의 프로젝트 역사를 쓰지 않는다.

순서는:

```text
inventory
→ extraction
→ normalization
→ relationship mapping
→ validation
→ gap analysis
→ final synthesis
```

이다.

---

## 2.2 No production behavior changes

이번 작업은 repository evidence / documentation / tooling lane이다.

다음을 변경하지 않는다.

* production UI behavior
* Transcend runtime
* Companion runtime behavior
* 3D rendering/runtime
* scene lifecycle
* API behavior
* DB schema/semantics
* Auth behavior
* RLS
* Model V2 behavior
* deployment topology
* Cloud resources
* Supabase resources
* Cloudflare resources
* R2 objects
* production environment

특히 Transcend W0~W8 작업과 직접 경쟁하지 않는다.

Transcend 관련 파일은 **evidence source로 읽을 수 있지만 제품 구현을 수정하지 않는다.**

---

# 3. Isolation

최신 `origin/main`에서 전용 worktree와 branch를 만든다.

권장 이름:

```text
branch:
audit/repository-evidence-system-v1

worktree:
../AH_05_07-evidence-system-v1
```

이미 같은 이름이 사용 중이면 충돌시키지 말고 의미가 유지되는 새 이름을 선택한다.

worktree 생성 후 모든 작업은 그 안에서만 수행한다.

push하지 않는다.

PR을 만들지 않는다.

merge하지 않는다.

deploy하지 않는다.

별도 human instruction 전까지 **local commits만 허용**한다.

---

# 4. Persistent control plane

가장 먼저 다음 전용 디렉터리를 만든다.

```text
docs/evidence/repository-atlas/
```

최소 파일:

```text
docs/evidence/repository-atlas/
  README.md
  WORKPLAN.md
  STATE.json
  QUEUE.json
  RESUME.md
  SOURCES.json
  evidence-index.json
  gaps.json
  reports/
  inventories/
```

필요하면 추가 하위 디렉터리를 만들어도 된다.

그러나 불필요하게 복잡한 framework를 만들지 않는다.

---

# 5. WORKPLAN.md

`WORKPLAN.md`에 다음을 명시한다.

* mission
* non-goals
* immutable boundaries
* scope
* evidence taxonomy
* atomic-task strategy
* verification strategy
* completion criteria
* resume protocol

이 문서는 이후 Codex session의 최상위 작업 계약이다.

---

# 6. STATE.json

항상 실제 상태와 일치하게 유지한다.

최소 구조:

```json
{
  "schema_version": 1,
  "status": "active",
  "base_sha": "",
  "branch": "",
  "worktree": "",
  "started_at": "",
  "last_checkpoint_at": "",
  "last_verified_task": null,
  "active_task": null,
  "next_task": null,
  "completed_tasks": [],
  "blocked_tasks": [],
  "last_commit": null,
  "verification_commands": [],
  "important_findings": [],
  "known_unknowns": [],
  "resume_instructions": []
}
```

필요한 필드는 추가할 수 있다.

모델의 대화 기억보다 이 파일이 authoritative하다.

---

# 7. QUEUE.json

전체 작업을 atomic task queue로 관리한다.

각 task는 최소 다음 필드를 가진다.

```json
{
  "id": "EA-001",
  "title": "",
  "objective": "",
  "inputs": [],
  "allowed_outputs": [],
  "dependencies": [],
  "verification": [],
  "status": "pending",
  "notes": []
}
```

상태:

```text
pending
active
verified
blocked
```

만 사용한다.

동시에 `active` task는 하나만 존재하게 한다.

---

# 8. Task size

한 task는 가능하면 **fresh Codex session 하나보다 훨씬 작은 단위**로 설계한다.

좋은 예:

```text
docs/architecture inventory 생성
docs/evidence inventory 생성
Model V2 evidence reference 추출
asset evidence reference 추출
PR number references 검사
SHA references 검사
internal markdown links 검사
frozen-boundary documents 분류
superseded-document 후보 판별
```

나쁜 예:

```text
repository 전체를 조사해서 최종 보고서를 작성한다
```

한 task가 지나치게 커지면 시작하기 전에 다시 쪼갠다.

---

# 9. Evidence taxonomy

초기 taxonomy를 다음처럼 사용하되 실제 repository를 보고 수정할 수 있다.

```text
architecture
product
journey
visual
companion
assets
model
data
api
auth
database
security
privacy
account
testing
ci
deployment
operations
research
release
policy
governance
historical
```

각 evidence record에는 가능한 경우 다음을 기록한다.

```text
id
title
category
status
source_type
source_path
source_sha
related_pr
related_issue
related_commit
date
authority
protects
supersedes
superseded_by
summary
verification
notes
```

`status` 후보:

```text
current
historical
superseded
temporary
research-only
uncertain
```

근거 없이 상태를 추정하지 않는다.

---

# 10. Phase A — Repository inventory

우선 repository 구조를 inventory한다.

최소 대상:

```text
README
AGENTS.md
docs/**
.github/**
scripts/**
tools/**
tests/**
web/e2e/**
infra/**
ops/**
supabase/**
```

단 binary asset 내용 자체를 전부 읽으려고 하지 않는다.

결과는:

```text
inventories/repository-files.*
inventories/evidence-files.*
inventories/policy-files.*
```

등으로 저장한다.

가능하면 사람이 읽는 Markdown과 machine-readable JSON을 함께 둔다.

---

# 11. Phase B — Reference extraction

repository 문서에서 다음 reference를 자동 추출하는 lightweight scanner를 만든다.

* commit SHA
* PR number
* issue number
* repository-relative file path
* Markdown internal link
* GitHub URL
* release/tag reference
* workflow reference
* evidence path

언어는 repository에 가장 자연스러운 Python 또는 Node 중 하나를 선택한다.

새로운 heavy dependency는 추가하지 않는다.

가능하면 standard library 또는 기존 dependency를 사용한다.

도구는 예를 들어 다음과 같이 실행 가능하게 만든다.

```bash
python scripts/... --check
```

또는 repository conventions에 더 적합한 동등한 명령을 사용한다.

---

# 12. Phase C — Reference validation

추출된 reference를 검증한다.

예:

* referenced local path가 실제 존재하는가
* Markdown link target이 존재하는가
* SHA 형식이 유효한가
* local git history에서 SHA를 resolve할 수 있는가
* PR / Issue reference 형식이 일관적인가
* 같은 evidence가 서로 모순된 authority를 주장하는가

GitHub network access가 필요한 검증과 local-only 검증은 분리한다.

네트워크가 없어도 core audit가 실행 가능해야 한다.

---

# 13. Phase D — Evidence normalization

중요 문서를 evidence record로 정규화한다.

모든 파일을 억지로 evidence record로 만들 필요는 없다.

중요한 decision/evidence 중심으로 한다.

특히 다음 계열을 우선 조사한다.

* architecture
* frozen contracts
* Model V2
* journey
* companion
* assets
* deployment
* auth/account
* testing/CI
* current Transcend authority

단 Transcend의 설계 내용을 변경하거나 새로운 Transcend 결정을 내리지 않는다.

이번 lane은 **현재 존재하는 evidence를 기록하는 역할**만 한다.

---

# 14. Phase E — Authority graph

가능하면 evidence 간 관계를 machine-readable하게 만든다.

예:

```text
decision
  ↓ supported_by
evidence
  ↓ implemented_by
commit / PR
  ↓ verified_by
test / CI / report
```

또는:

```text
document A
  ↓ superseded_by
document B
```

거대한 graph database나 새 infrastructure는 만들지 않는다.

JSON 또는 간단한 Markdown/JSON combination이면 충분하다.

---

# 15. Phase F — Gap analysis

다음 종류의 gap을 찾는다.

```text
broken reference
missing evidence
ambiguous authority
duplicate authority
stale SHA
superseded but unmarked
historical document appearing current
decision without verification
verification without decision linkage
orphan evidence
```

각 gap에는 가능하면:

```text
severity
confidence
source
reason
recommended follow-up
```

를 기록한다.

단 severity를 과장하지 않는다.

실제 production defect와 documentation gap을 구분한다.

이번 작업에서 product defect를 직접 고치지 않는다.

---

# 16. Phase G — Generated Evidence Atlas

최종적으로 사람이 읽을 수 있는 Atlas를 만든다.

최소:

```text
reports/EVIDENCE_ATLAS.md
reports/EVIDENCE_GAPS.md
reports/PROJECT_AUTHORITY_MAP.md
```

`EVIDENCE_ATLAS.md`는 프로젝트 역사를 장황하게 서술하는 것이 아니라:

```text
영역
현재 authority
핵심 evidence
verification
historical predecessor
known gap
```

을 빠르게 찾을 수 있어야 한다.

---

# 17. Phase H — Reproducible audit command

최종 결과는 한 번 작성하고 끝나는 문서가 아니어야 한다.

repository 상태에서 재실행할 수 있는 audit command를 제공한다.

목표 예:

```bash
python scripts/check_repository_evidence.py
```

결과:

```text
PASS ...
PASS ...
WARN ...
ERROR ...
```

정도를 출력한다.

기존 CI에 자동 연결하지 않는다.

이번 작업에서는 새로운 required CI gate를 만들지 않는다.

CI integration은 별도 human decision으로 남긴다.

---

# 18. Token-exhaustion-safe execution protocol

이 부분은 절대 생략하지 않는다.

각 atomic task에 대해 다음 순서를 지킨다.

```text
1. QUEUE에서 task 하나를 active로 변경
2. STATE 갱신
3. 작업 수행
4. 결과를 즉시 disk에 저장
5. verification 수행
6. self-review
7. task를 verified 또는 blocked로 변경
8. STATE 갱신
9. 독립적으로 유효한 slice면 local commit
10. 다음 task 지정
```

완료된 여러 task를 거대한 마지막 commit까지 기다리지 않는다.

**작은 checkpoint commit을 적극적으로 사용한다.**

---

# 19. Context/token이 부족해질 때

남은 token/context가 안전하지 않다고 판단하면:

**새 task를 절대 시작하지 않는다.**

즉시 checkpoint mode로 전환한다.

반드시 다음을 수행한다.

```text
1. 현재까지의 실제 결과를 disk에 저장
2. 미완료 부분을 완료된 것처럼 표시하지 않음
3. active task의 정확한 중단 위치 기록
4. STATE.json 갱신
5. QUEUE.json 갱신
6. RESUME.md 갱신
7. 가능한 verification 실행
8. 안전한 변경만 local commit
9. working tree 상태 기록
```

중요 정보는 대화창에만 남기지 않는다.

---

# 20. RESUME.md

fresh Codex session이 이것만 읽어도 복구 가능하게 유지한다.

최소 포함:

```text
current branch
base SHA
last verified task
active task
exact unfinished point
next task
files currently relevant
verification commands
known problems
do-not-touch boundaries
```

---

# 21. Fresh-session bootstrap

새 Codex session에서는 과거 대화 context를 전혀 신뢰하지 않는다.

항상:

```bash
git status
git branch --show-current
git log --oneline -10
git rev-parse HEAD
```

을 먼저 확인한다.

그 후 다음 순서로 읽는다.

```text
1. repository AGENTS.md
2. docs/evidence/repository-atlas/WORKPLAN.md
3. STATE.json
4. QUEUE.json
5. RESUME.md
6. active task 관련 산출물
```

repository 상태와 STATE가 일치하는지 확인한다.

불일치하면 작업을 진행하기 전에 어느 쪽이 실제 상태인지 git/file evidence로 판별하고 STATE를 복구한다.

이미 verified된 task를 처음부터 반복하지 않는다.

`active_task`가 있으면 그것부터 복구한다.

없으면 `next_task`를 수행한다.

---

# 22. Commit discipline

각 commit은 독립적으로 이해 가능해야 한다.

예:

```text
audit: establish repository evidence control plane
audit: inventory architecture and evidence documents
tooling: add repository evidence reference scanner
audit: validate internal evidence references
docs: map current project authority evidence
docs: record repository evidence gaps
```

한 commit에 unrelated 변경을 섞지 않는다.

---

# 23. Main advancement during long run

장시간 작업 중 `origin/main`이 앞으로 진행될 가능성이 높다.

Transcend 및 다른 병렬 작업이 계속 진행되고 있기 때문이다.

따라서:

* 매 task마다 무조건 rebase하지 않는다.
* 최초 base SHA를 STATE에 보존한다.
* 작업 중인 evidence를 안정적으로 완성한다.
* final validation 단계에서 `git fetch origin main` 후 divergence를 확인한다.

main advancement가 이 작업 결과에 영향을 미치는 경우:

1. 변경 범위를 조사한다.
2. evidence inventory에 필요한 새 자료만 증분 반영한다.
3. 다른 lane의 구현을 수정하지 않는다.
4. 무리한 rebase로 작업을 깨뜨리지 않는다.
5. 최종 integration 판단은 human에게 맡긴다.

---

# 24. Protected boundaries

다음은 절대 변경하지 않는다.

* Model V2 frozen contract
* Model artifacts
* API semantic contract
* DB semantics
* authentication semantics
* RLS
* production deployment
* Cloud Run configuration
* Supabase configuration
* Cloudflare configuration
* R2 contents
* Transcend runtime implementation
* Companion behavior implementation
* 3D assets
* user-facing scene behavior

필요하면 읽고 evidence를 기록할 수만 있다.

---

# 25. Do not overengineer

이 작업의 목적은 새로운 platform을 만드는 것이 아니다.

다음을 피한다.

* 새로운 database
* web dashboard
* graph database
* server
* unnecessary framework
* large dependency
* production telemetry
* CI redesign
* unrelated refactor

filesystem + git + small deterministic tooling으로 충분하다.

---

# 26. Verification

최소 검증:

* scanner 자체 test
* deterministic output
* internal link/path validation
* JSON parse/schema consistency
* repeated execution에서 안정적인 결과
* repository policy tests 중 관련되는 기존 test
* `git diff --check`
* final self-review

repository 전체 테스트가 이번 변경과 무관하게 매우 크다면 무조건 모든 suite를 돌리려고 하지 말고, 변경 범위에 맞는 validation을 우선한다.

그러나 기존 required policy를 우회하지 않는다.

---

# 27. Final completion criteria

다음을 모두 충족해야 완료다.

* repository inventory 완료
* evidence taxonomy 확정
* important evidence normalization 완료
* reference scanner 존재
* local reference validation 가능
* evidence index 생성
* authority map 생성
* gap report 생성
* reproducible audit command 존재
* machine-readable state/result 존재
* required atomic tasks verified
* STATE의 active task 없음
* working tree 상태 확인
* final self-review 완료
* unresolved items 명시
* 다른 production/runtime lane 수정 없음

완료 후:

```json
{
  "status": "complete"
}
```

가 STATE에 기록되어야 한다.

---

# 28. Final report

마지막 응답은 길게 작업 과정을 재서술하지 않는다.

다음만 명확히 보고한다.

```text
BASE
BRANCH
FINAL HEAD

WHAT WAS BUILT

KEY FINDINGS

GAPS FOUND

FILES ADDED/CHANGED

VALIDATION

COMMITS

MAIN DIVERGENCE

UNRESOLVED ITEMS

PUSH PERFORMED: 0
PR CREATED: 0
MERGE PERFORMED: 0
DEPLOY PERFORMED: 0
```

그리고 다음 human action이 무엇인지 한 줄로 표시한다.

---

# 29. Start now

이제 실제 최신 `origin/main`을 확인하고 시작한다.

먼저 repository와 병렬 worktree를 조사하여 충돌 없는 isolated worktree를 만든다.

그 다음 가장 먼저 **persistent control plane (`WORKPLAN.md`, `STATE.json`, `QUEUE.json`, `RESUME.md`)을 실제로 작성하고 첫 local checkpoint commit을 만든 뒤** repository archaeology를 계속한다.

설계를 다시 확장하는 데 시간을 쓰지 말고, 실제 repository evidence를 조사하고 저장하는 작업으로 진행한다.

중간에 token/context가 부족해질 경우 새 일을 시작하지 말고 checkpoint protocol을 실행한다.

**현재 Codex session의 종료는 이 프로젝트의 종료가 아니다. Repository에 남은 state가 다음 Codex session의 시작점이다.**
