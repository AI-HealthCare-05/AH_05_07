"""Pure, read-only projections over validated SK7 Learning Record v0.1 data."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from app.core.contracts.learning_record import InternalRef, LearningRecord, validate_learning_record

ComparisonSide = Literal["left", "right"]


@dataclass(frozen=True, slots=True)
class RecordedObservation:
    """Recorded observation kept separate from decision disposition."""

    value: Any
    observed_at: datetime
    source: str


@dataclass(frozen=True, slots=True)
class DecisionProjection:
    decision_id: str
    disposition: str
    authority: str
    owner_approval: RecordedObservation | None
    production_activation: RecordedObservation | None


@dataclass(frozen=True, slots=True)
class EvaluationProjection:
    evaluation_id: str
    kind: str
    verdict: str
    authority: str
    evidence_ref_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DimensionProjection:
    dimension: str
    outcome: str


@dataclass(frozen=True, slots=True)
class ComparisonMembership:
    comparison_id: str
    side: ComparisonSide
    aggregate_outcome: str | None
    dimensions: tuple[DimensionProjection, ...]


@dataclass(frozen=True, slots=True)
class PresentationReview:
    record_id: str
    presentation_id: str
    decisions: tuple[DecisionProjection, ...]
    evaluations: tuple[EvaluationProjection, ...]
    comparisons: tuple[ComparisonMembership, ...]


@dataclass(frozen=True, slots=True)
class RepairChain:
    """Explicit repair ancestry from newest/start record toward recorded parents."""

    record_ids: tuple[str, ...]
    unresolved_target_id: str | None = None


class LearningRecordIndex:
    """Deterministic read-only index over already-valid Learning Record data."""

    def __init__(self, records: Sequence[Any]) -> None:
        validated = tuple(_validated_copy(record) for record in records)

        by_id: dict[str, LearningRecord] = {}
        episode_attempts: set[tuple[str, int]] = set()
        by_episode: defaultdict[str, list[LearningRecord]] = defaultdict(list)

        for record in validated:
            if record.recordId in by_id:
                raise ValueError(f"duplicate Learning Record recordId: {record.recordId!r}")

            episode_attempt = (record.episodeId, record.attemptIndex)
            if episode_attempt in episode_attempts:
                raise ValueError(
                    "duplicate Learning Record episode/attempt: "
                    f"episodeId={record.episodeId!r} attemptIndex={record.attemptIndex}"
                )

            by_id[record.recordId] = record
            episode_attempts.add(episode_attempt)
            by_episode[record.episodeId].append(record)

        self._by_id = by_id
        self._episode_record_ids = {
            episode_id: tuple(
                record.recordId
                for record in sorted(
                    episode_records,
                    key=lambda item: (item.attemptIndex, item.recordId),
                )
            )
            for episode_id, episode_records in by_episode.items()
        }
        self._unresolved_learning_record_refs = tuple(
            sorted(
                {
                    ref.id
                    for record in validated
                    for ref in _internal_refs(record)
                    if ref.kind == "learning-record" and ref.id not in by_id
                }
            )
        )

    @property
    def unresolved_learning_record_refs(self) -> tuple[str, ...]:
        """IDs referenced as Learning Records but absent from this index."""

        return self._unresolved_learning_record_refs

    def record(self, record_id: str) -> LearningRecord:
        """Return a defensive copy for one exact recorded ID."""

        try:
            record = self._by_id[record_id]
        except KeyError:
            raise KeyError(f"unknown Learning Record recordId: {record_id!r}") from None
        return record.model_copy(deep=True)

    def episode(self, episode_id: str) -> tuple[LearningRecord, ...]:
        """Return exact episode records in deterministic attempt order."""

        record_ids = self._episode_record_ids.get(episode_id, ())
        return tuple(self._by_id[record_id].model_copy(deep=True) for record_id in record_ids)

    def repair_chain(self, record_id: str) -> RepairChain:
        """Follow explicit ``repair-of`` edges only; never infer ancestry."""

        if record_id not in self._by_id:
            raise KeyError(f"unknown Learning Record recordId: {record_id!r}")

        chain: list[str] = []
        seen: set[str] = set()
        current_id = record_id

        while True:
            if current_id in seen:
                cycle = " -> ".join((*chain, current_id))
                raise ValueError(f"repair-of cycle detected: {cycle}")

            seen.add(current_id)
            chain.append(current_id)
            parent_id = _repair_parent_id(self._by_id[current_id])

            if parent_id is None:
                return RepairChain(tuple(chain))

            if parent_id in seen:
                cycle = " -> ".join((*chain, parent_id))
                raise ValueError(f"repair-of cycle detected: {cycle}")

            if parent_id not in self._by_id:
                return RepairChain(tuple(chain), unresolved_target_id=parent_id)

            current_id = parent_id

    def presentation_review(self, record_id: str, presentation_id: str) -> PresentationReview:
        """Project recorded review facts for one exact presentation."""

        try:
            record = self._by_id[record_id]
        except KeyError:
            raise KeyError(f"unknown Learning Record recordId: {record_id!r}") from None

        if not any(item.presentationId == presentation_id for item in record.presentations or ()):
            raise KeyError(f"unknown presentationId {presentation_id!r} in Learning Record {record_id!r}")

        decisions = tuple(
            DecisionProjection(
                decision_id=decision.decisionId,
                disposition=decision.disposition,
                authority=decision.authority,
                owner_approval=_observation(decision.ownerApproval),
                production_activation=_observation(decision.productionActivation),
            )
            for decision in record.decisions or ()
            if decision.subjectRef.kind == "presentation" and decision.subjectRef.id == presentation_id
        )

        evaluations = tuple(
            EvaluationProjection(
                evaluation_id=evaluation.evaluationId,
                kind=evaluation.kind,
                verdict=evaluation.verdict,
                authority=evaluation.authority,
                evidence_ref_ids=tuple(ref.id for ref in evaluation.evidenceRefs or ()),
            )
            for evaluation in record.evaluations or ()
            if evaluation.subjectRef.kind == "presentation" and evaluation.subjectRef.id == presentation_id
        )

        comparisons: list[ComparisonMembership] = []
        for comparison in record.comparisons or ():
            dimensions = tuple(
                DimensionProjection(dimension=result.dimension, outcome=result.outcome)
                for result in comparison.dimensionResults
            )
            for side, ref in (
                ("left", comparison.leftSubjectRef),
                ("right", comparison.rightSubjectRef),
            ):
                if isinstance(ref, InternalRef) and ref.kind == "presentation" and ref.id == presentation_id:
                    comparisons.append(
                        ComparisonMembership(
                            comparison_id=comparison.comparisonId,
                            side=side,
                            aggregate_outcome=comparison.aggregateOutcome,
                            dimensions=dimensions,
                        )
                    )

        return PresentationReview(
            record_id=record_id,
            presentation_id=presentation_id,
            decisions=decisions,
            evaluations=evaluations,
            comparisons=tuple(comparisons),
        )


def build_learning_record_index(records: Sequence[Any]) -> LearningRecordIndex:
    """Validate records and build the pure read-only index."""

    return LearningRecordIndex(records)


def _validated_copy(data: Any) -> LearningRecord:
    if isinstance(data, LearningRecord):
        return validate_learning_record(data.model_dump(mode="python"))
    return validate_learning_record(data)


def _observation(value: Any) -> RecordedObservation | None:
    if value is None:
        return None
    return RecordedObservation(
        value=deepcopy(value.value),
        observed_at=value.observedAt,
        source=value.source,
    )


def _repair_parent_id(record: LearningRecord) -> str | None:
    for relation in record.lineage.relations if record.lineage and record.lineage.relations else ():
        if relation.type != "repair-of":
            continue
        target = relation.target
        if isinstance(target, InternalRef) and target.kind == "learning-record":
            return target.id
    return None


def _append_internal_ref(refs: list[InternalRef], ref: Any) -> None:
    if isinstance(ref, InternalRef):
        refs.append(ref)


def _internal_refs(record: LearningRecord) -> tuple[InternalRef, ...]:
    refs: list[InternalRef] = []

    for item in record.inputs or ():
        _append_internal_ref(refs, item.ref)

    _append_internal_ref(refs, record.artifact.ref if record.artifact else None)

    for item in record.evidence or ():
        _append_internal_ref(refs, item.ref)

    for item in record.evaluations or ():
        refs.append(item.subjectRef)
        refs.extend(item.evidenceRefs or ())

    for item in record.decisions or ():
        refs.append(item.subjectRef)

    for item in record.comparisons or ():
        _append_internal_ref(refs, item.leftSubjectRef)
        _append_internal_ref(refs, item.rightSubjectRef)

    relations = record.lineage.relations if record.lineage and record.lineage.relations else ()
    for item in relations:
        _append_internal_ref(refs, item.target)

    return tuple(refs)
