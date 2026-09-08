from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-privacy-readiness-v1"

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
PrivacyReadinessDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "purpose_limitation_approved",
    "data_minimization_approved",
    "transient_processing_approved",
    "logging_monitoring_approved",
    "analytics_boundary_approved",
    "data_separation_approved",
    "user_notice_collection_approved",
    "retention_deletion_approved",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class PrivacyReadinessContractError(ValueError):
    """Raised when a T9 privacy-readiness payload violates the contract."""


@dataclass(frozen=True)
class PrivacyReadiness:
    purpose_limitation_approved: DimensionState
    data_minimization_approved: DimensionState
    transient_processing_approved: DimensionState
    logging_monitoring_approved: DimensionState
    analytics_boundary_approved: DimensionState
    data_separation_approved: DimensionState
    user_notice_collection_approved: DimensionState
    retention_deletion_approved: DimensionState


@dataclass(frozen=True)
class PrivacyReadinessEvaluation:
    contract_version: str
    decision: PrivacyReadinessDecision
    purpose_limitation_approved: DimensionState
    data_minimization_approved: DimensionState
    transient_processing_approved: DimensionState
    logging_monitoring_approved: DimensionState
    analytics_boundary_approved: DimensionState
    data_separation_approved: DimensionState
    user_notice_collection_approved: DimensionState
    retention_deletion_approved: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise PrivacyReadinessContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_privacy_readiness(payload: Mapping[str, object]) -> PrivacyReadiness:
    if not isinstance(payload, Mapping):
        raise PrivacyReadinessContractError("privacy readiness payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise PrivacyReadinessContractError(f"privacy readiness fields mismatch: missing={missing}, extra={extra}")

    return PrivacyReadiness(
        purpose_limitation_approved=_dimension_state(
            "purpose_limitation_approved", payload["purpose_limitation_approved"]
        ),
        data_minimization_approved=_dimension_state(
            "data_minimization_approved", payload["data_minimization_approved"]
        ),
        transient_processing_approved=_dimension_state(
            "transient_processing_approved", payload["transient_processing_approved"]
        ),
        logging_monitoring_approved=_dimension_state(
            "logging_monitoring_approved", payload["logging_monitoring_approved"]
        ),
        analytics_boundary_approved=_dimension_state(
            "analytics_boundary_approved", payload["analytics_boundary_approved"]
        ),
        data_separation_approved=_dimension_state("data_separation_approved", payload["data_separation_approved"]),
        user_notice_collection_approved=_dimension_state(
            "user_notice_collection_approved",
            payload["user_notice_collection_approved"],
        ),
        retention_deletion_approved=_dimension_state(
            "retention_deletion_approved", payload["retention_deletion_approved"]
        ),
    )


def evaluate_privacy_readiness(
    readiness: PrivacyReadiness,
) -> PrivacyReadinessEvaluation:
    decision: PrivacyReadinessDecision = (
        "PASS"
        if all(
            state == "PASS"
            for state in (
                readiness.purpose_limitation_approved,
                readiness.data_minimization_approved,
                readiness.transient_processing_approved,
                readiness.logging_monitoring_approved,
                readiness.analytics_boundary_approved,
                readiness.data_separation_approved,
                readiness.user_notice_collection_approved,
                readiness.retention_deletion_approved,
            )
        )
        else "BLOCKED"
    )

    return PrivacyReadinessEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        purpose_limitation_approved=readiness.purpose_limitation_approved,
        data_minimization_approved=readiness.data_minimization_approved,
        transient_processing_approved=readiness.transient_processing_approved,
        logging_monitoring_approved=readiness.logging_monitoring_approved,
        analytics_boundary_approved=readiness.analytics_boundary_approved,
        data_separation_approved=readiness.data_separation_approved,
        user_notice_collection_approved=readiness.user_notice_collection_approved,
        retention_deletion_approved=readiness.retention_deletion_approved,
    )


def evaluate_privacy_readiness_payload(
    payload: Mapping[str, object],
) -> PrivacyReadinessEvaluation:
    return evaluate_privacy_readiness(parse_privacy_readiness(payload))


CURRENT_T9_READINESS = PrivacyReadiness(
    purpose_limitation_approved="PASS",
    data_minimization_approved="PASS",
    transient_processing_approved="PASS",
    logging_monitoring_approved="PASS",
    analytics_boundary_approved="PASS",
    data_separation_approved="PASS",
    user_notice_collection_approved="BLOCKED",
    retention_deletion_approved="PASS",
)

CURRENT_T9_EVALUATION = evaluate_privacy_readiness(CURRENT_T9_READINESS)
