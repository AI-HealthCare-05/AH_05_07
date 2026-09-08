from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.services.model_v2_privacy_notice_resolution import (
    CONTRACT_VERSION as T14_CONTRACT_VERSION,
)
from app.services.model_v2_privacy_notice_resolution import (
    CURRENT_T14_EVALUATION,
    PrivacyNoticeResolutionEvaluation,
)

CONTRACT_VERSION = "model-v2-privacy-readiness-v1"
T14_TRANSITION_VERSION = "model-v2-privacy-readiness-t14-transition-v1"

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


class PrivacyReadinessTransitionError(PrivacyReadinessContractError):
    """Raised when the T14 notice evidence does not authorize the T9 transition."""


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
            "transient_processing_approved",
            payload["transient_processing_approved"],
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


PRE_T14_T9_READINESS = PrivacyReadiness(
    purpose_limitation_approved="PASS",
    data_minimization_approved="PASS",
    transient_processing_approved="PASS",
    logging_monitoring_approved="PASS",
    analytics_boundary_approved="PASS",
    data_separation_approved="PASS",
    user_notice_collection_approved="BLOCKED",
    retention_deletion_approved="PASS",
)

PRE_T14_T9_EVALUATION = evaluate_privacy_readiness(PRE_T14_T9_READINESS)


def transition_privacy_readiness_after_t14(
    *,
    previous: PrivacyReadiness,
    t14_evaluation: PrivacyNoticeResolutionEvaluation,
) -> PrivacyReadiness:
    if t14_evaluation.contract_version != T14_CONTRACT_VERSION:
        raise PrivacyReadinessTransitionError("T14 privacy-notice evidence contract version mismatch")
    if t14_evaluation.decision != "PASS":
        raise PrivacyReadinessTransitionError("T14 privacy-notice resolution must be PASS before T9 transition")
    if previous != PRE_T14_T9_READINESS:
        raise PrivacyReadinessTransitionError("T9 pre-transition snapshot does not match the reviewed T14 baseline")

    return PrivacyReadiness(
        purpose_limitation_approved=previous.purpose_limitation_approved,
        data_minimization_approved=previous.data_minimization_approved,
        transient_processing_approved=previous.transient_processing_approved,
        logging_monitoring_approved=previous.logging_monitoring_approved,
        analytics_boundary_approved=previous.analytics_boundary_approved,
        data_separation_approved=previous.data_separation_approved,
        user_notice_collection_approved="PASS",
        retention_deletion_approved=previous.retention_deletion_approved,
    )


CURRENT_T9_READINESS = transition_privacy_readiness_after_t14(
    previous=PRE_T14_T9_READINESS,
    t14_evaluation=CURRENT_T14_EVALUATION,
)

CURRENT_T9_EVALUATION = evaluate_privacy_readiness(CURRENT_T9_READINESS)
