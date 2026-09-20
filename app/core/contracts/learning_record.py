"""SK7 Learning Record v0.1 — machine contract and validator."""

from __future__ import annotations

import warnings
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.contracts.common import Hex64, SemanticToken, load_json_unique

warnings.filterwarnings("ignore", message='Field name "schema"')


class _CoreModel(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())


class ContentHash(_CoreModel):
    algorithm: Literal["sha-256"]
    value: Hex64


class ExternalContentRef(_CoreModel):
    """Reference to legacy/external immutable content by hash and/or locator."""

    contentHash: ContentHash | None = None
    locator: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _has_some_identity(self) -> ExternalContentRef:
        if self.contentHash is None and self.locator is None:
            msg = "external-content reference requires contentHash and/or locator"
            raise ValueError(msg)
        return self


class InternalRef(_CoreModel):
    """Reference to an immutable entity inside the Learning Corpus."""

    kind: Literal[
        "learning-record", "artifact", "presentation", "evidence", "evaluation", "decision", "comparison", "input"
    ]
    id: str = Field(min_length=1)


type Reference = InternalRef | ExternalContentRef


class RequestGoal(_CoreModel):
    text: str = Field(min_length=1)
    basis: Literal["recorded", "recorded-source-metadata", "derived-from-recorded-metadata"]


class Request(_CoreModel):
    originalTextStatus: Literal["recorded", "not-recorded", "not-applicable"]
    goal: RequestGoal | None = None


class Input(_CoreModel):
    inputId: str = Field(min_length=1)
    role: Literal[
        "parent-artifact",
        "reference-artifact",
        "geometry-source",
        "material-source",
        "motion-source",
        "scene-component",
        "tool-input",
    ]
    ref: Reference


class Build(_CoreModel):
    operationId: str | None = Field(default=None, min_length=1)
    type: SemanticToken | None = None
    target: str | None = Field(default=None, min_length=1)
    intent: str | None = Field(default=None, min_length=1)
    basis: Literal["recorded", "recorded-source-metadata", "derived-from-recorded-metadata"] | None = None


class Artifact(_CoreModel):
    artifactId: str = Field(min_length=1)
    kind: Literal["mesh", "composition", "animation", "material", "image", "other"]
    ref: Reference


class Presentation(_CoreModel):
    presentationId: str = Field(min_length=1)
    artifactId: str = Field(min_length=1)
    view: str | None = Field(default=None, min_length=1)


class Evidence(_CoreModel):
    evidenceId: str = Field(min_length=1)
    kind: Literal[
        "render",
        "screenshot",
        "metric-report",
        "qa-json",
        "runtime-log",
        "human-note",
        "comparison-image",
    ]
    ref: Reference


class Evaluation(_CoreModel):
    evaluationId: str = Field(min_length=1)
    subjectRef: InternalRef
    evidenceRefs: list[InternalRef] | None = None
    kind: Literal[
        "static-source",
        "topology",
        "pixel-integrity",
        "performance-budget",
        "small-slot-readability",
        "semantic-readability",
        "material-readability",
        "composition-readability",
        "animation-runtime",
        "interaction-runtime",
        "native-runtime",
        "human-preference",
        "safety",
        "other",
    ]
    verdict: Literal["pass", "fail", "mixed", "unknown", "not-tested", "not-applicable"]
    authority: Literal["automated", "assistant", "human-reviewer", "human-owner", "external-tool"]
    notes: str | None = None


class ObservationSnapshot(_CoreModel):
    value: Any
    observedAt: datetime
    source: str = Field(min_length=1)


class DecisionObservation(_CoreModel):
    observedAt: datetime
    source: str = Field(min_length=1)


class Decision(_CoreModel):
    decisionId: str = Field(min_length=1)
    subjectRef: InternalRef
    disposition: Literal["retain", "reject", "pending", "superseded", "study-only"]
    authority: Literal["automated", "assistant", "human-reviewer", "human-owner", "external-tool"]
    observation: DecisionObservation
    ownerApproval: ObservationSnapshot | None = None
    productionActivation: ObservationSnapshot | None = None
    rationale: str | None = None


class DimensionResult(_CoreModel):
    dimension: SemanticToken
    outcome: Literal["prefer-left", "prefer-right", "tie", "inconclusive", "different-tradeoff"]
    finding: str | None = None
    rationale: str | None = None


class Comparison(_CoreModel):
    comparisonId: str = Field(min_length=1)
    leftSubjectRef: Reference
    rightSubjectRef: Reference
    dimensionResults: list[DimensionResult] = Field(min_length=1)
    aggregateOutcome: (
        Literal[
            "prefer-left",
            "prefer-right",
            "tie",
            "inconclusive",
            "different-tradeoff",
        ]
        | None
    ) = None


class LineageRelation(_CoreModel):
    type: Literal[
        "repair-of",
        "reuses-geometry-from",
        "supersedes",
        "composition-contains",
        "derivative-of",
    ]
    target: Reference


class Lineage(_CoreModel):
    relations: list[LineageRelation] | None = None


class Limitation(_CoreModel):
    scope: str | None = None
    description: str = Field(min_length=1)
    reason: str | None = None


class Provenance(_CoreModel):
    origin: str | None = None
    sourceRun: str | None = None
    migrationVersion: str | None = None


class LearningRecord(_CoreModel):
    schema: Literal["sk7.learning-record"]
    schemaVersion: Literal["0.1"]
    recordId: str = Field(min_length=1)
    episodeId: str = Field(min_length=1)
    attemptIndex: int
    recordState: Literal["complete", "partial", "aborted"]
    request: Request | None = None
    inputs: list[Input] | None = None
    build: Build | None = None
    artifact: Artifact | None = None
    presentations: list[Presentation] | None = None
    evidence: list[Evidence] | None = None
    evaluations: list[Evaluation] | None = None
    decisions: list[Decision] | None = None
    comparisons: list[Comparison] | None = None
    lineage: Lineage | None = None
    limitations: list[Limitation] | None = None
    provenance: Provenance | None = None
    extensions: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _local_id_uniqueness(self) -> LearningRecord:
        seen: set[str] = set()

        def check(name: str, value: str) -> None:
            if value in seen:
                msg = f"duplicate local ID {name}={value!r} within the record"
                raise ValueError(msg)
            seen.add(value)

        id_groups = [
            ("inputId", [i.inputId for i in self.inputs or []]),
            ("presentationId", [p.presentationId for p in self.presentations or []]),
            ("evidenceId", [e.evidenceId for e in self.evidence or []]),
            ("evaluationId", [ev.evaluationId for ev in self.evaluations or []]),
            ("decisionId", [d.decisionId for d in self.decisions or []]),
            ("comparisonId", [c.comparisonId for c in self.comparisons or []]),
        ]
        for name, values in id_groups:
            for value in values:
                check(name, value)
        return self

    @model_validator(mode="after")
    def _artifact_presence(self) -> LearningRecord:
        if self.recordState == "complete":
            if self.artifact is None:
                msg = "recordState=complete requires a primary artifact"
                raise ValueError(msg)
        elif (
            self.artifact is None
            and not self.limitations
            and not any(value is not None for value in (self.build.model_dump().values() if self.build else []))
        ):
            msg = (
                f"recordState={self.recordState} without an artifact requires "
                "limitations and/or build to explain the absence"
            )
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _repair_of_multiplicity(self) -> LearningRecord:
        if not self.lineage or not self.lineage.relations:
            return self
        repair_count = sum(1 for r in self.lineage.relations if r.type == "repair-of")
        if repair_count > 1:
            msg = "at most one direct repair-of relation is allowed in v0.1"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _presentation_artifact_refs(self) -> LearningRecord:
        if not self.presentations or not self.artifact:
            return self
        valid_ids = {self.artifact.artifactId}
        if self.inputs:
            for inp in self.inputs:
                ref = inp.ref
                if isinstance(ref, InternalRef):
                    if ref.kind == "artifact" and ref.id:
                        valid_ids.add(ref.id)
        for presentation in self.presentations:
            if presentation.artifactId not in valid_ids:
                msg = (
                    f"presentation {presentation.presentationId!r} references "
                    f"unknown artifactId {presentation.artifactId!r}"
                )
                raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _evidence_ref_targets(self) -> LearningRecord:
        if not self.evaluations:
            return self
        evidence_ids = {e.evidenceId for e in self.evidence or []}
        for evaluation in self.evaluations:
            if not evaluation.evidenceRefs:
                continue
            for ref in evaluation.evidenceRefs:
                if ref.kind != "evidence":
                    msg = (
                        f"evaluation {evaluation.evaluationId!r} evidenceRef kind must be 'evidence', got {ref.kind!r}"
                    )
                    raise ValueError(msg)
                if ref.id not in evidence_ids:
                    msg = f"evaluation {evaluation.evaluationId!r} references unknown evidenceId {ref.id!r}"
                    raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _typed_subjects_and_lineage(self) -> LearningRecord:  # noqa: C901
        for evaluation in self.evaluations or []:
            if evaluation.subjectRef.kind not in {"artifact", "presentation"}:
                raise ValueError("evaluation subjectRef must target artifact or presentation")
        for decision in self.decisions or []:
            if decision.subjectRef.kind not in {"artifact", "presentation"}:
                raise ValueError("decision subjectRef must target artifact or presentation")
        for comparison in self.comparisons or []:
            for target in (comparison.leftSubjectRef, comparison.rightSubjectRef):
                if isinstance(target, InternalRef) and target.kind not in {
                    "learning-record",
                    "artifact",
                    "presentation",
                }:
                    raise ValueError(
                        "comparison internal operands must target learning-record, artifact, or presentation"
                    )
        for relation in self.lineage.relations if self.lineage and self.lineage.relations else []:
            target = relation.target
            if relation.type in {"repair-of", "supersedes"}:
                if not isinstance(target, InternalRef) or target.kind != "learning-record":
                    raise ValueError(f"{relation.type} target must be a learning-record")
            elif relation.type == "reuses-geometry-from":
                if isinstance(target, InternalRef) and target.kind != "artifact":
                    raise ValueError("reuses-geometry-from target must be artifact or external content")
            elif relation.type == "derivative-of":
                if isinstance(target, InternalRef) and target.kind not in {"learning-record", "artifact"}:
                    raise ValueError("derivative-of target must be learning-record, artifact, or external content")
            elif relation.type == "composition-contains":
                if not isinstance(target, InternalRef) or target.kind != "input":
                    raise ValueError("composition-contains target must reference an input by inputId")
                if self.artifact is None or self.artifact.kind != "composition":
                    raise ValueError("composition-contains requires a composition source artifact")
        return self

    @model_validator(mode="after")
    def _composition_contains_inputs(self) -> LearningRecord:
        if not self.lineage or not self.lineage.relations:
            return self
        input_ids = {inp.inputId: inp for inp in (self.inputs or [])}
        for relation in self.lineage.relations:
            if relation.type != "composition-contains":
                continue
            target = relation.target
            if not isinstance(target, InternalRef) or target.kind != "input":
                msg = "composition-contains target must reference an input by inputId"
                raise ValueError(msg)
            inp = input_ids.get(target.id)
            if inp is None or inp.role != "scene-component":
                msg = f"composition-contains target {target.id!r} must reference an input with role scene-component"
                raise ValueError(msg)
        return self


def validate_learning_record(data: Any) -> LearningRecord:
    """Structural + semantic validation for Learning Record v0.1."""
    return LearningRecord.model_validate(data)


def parse_learning_record_json(data: str | bytes) -> Any:
    """Parse Learning Record JSON while rejecting duplicate object keys."""
    return load_json_unique(data)


LearningRecord.model_rebuild()
Input.model_rebuild()
Artifact.model_rebuild()
Evidence.model_rebuild()
Evaluation.model_rebuild()
Decision.model_rebuild()
Comparison.model_rebuild()
LineageRelation.model_rebuild()
validate_learning_record.__doc__ = validate_learning_record.__doc__ or ""
