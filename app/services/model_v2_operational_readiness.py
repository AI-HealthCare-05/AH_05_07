from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-operational-readiness-v1"

FROZEN_ARTIFACT_FILENAME = "model-v2-r1-a.joblib"
FROZEN_ARTIFACT_SHA256 = "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84"
FROZEN_SCHEMA_VERSION = "model-v2-r1-schema-v1"
FROZEN_FEATURE_COUNT = 11

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
OperationalReadinessDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "artifact_integrity_approved",
    "schema_integrity_approved",
    "disabled_fail_closed_approved",
    "authenticated_smoke_approved",
    "rollback_kill_switch_approved",
    "monitoring_boundary_approved",
    "incident_response_approved",
    "operational_owner_approved",
    "enablement_runbook_approved",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class OperationalReadinessContractError(ValueError):
    """Raised when a T10 operational-readiness payload violates the contract."""


@dataclass(frozen=True)
class OperationalReadiness:
    artifact_integrity_approved: DimensionState
    schema_integrity_approved: DimensionState
    disabled_fail_closed_approved: DimensionState
    authenticated_smoke_approved: DimensionState
    rollback_kill_switch_approved: DimensionState
    monitoring_boundary_approved: DimensionState
    incident_response_approved: DimensionState
    operational_owner_approved: DimensionState
    enablement_runbook_approved: DimensionState


@dataclass(frozen=True)
class OperationalReadinessEvaluation:
    contract_version: str
    decision: OperationalReadinessDecision
    artifact_integrity_approved: DimensionState
    schema_integrity_approved: DimensionState
    disabled_fail_closed_approved: DimensionState
    authenticated_smoke_approved: DimensionState
    rollback_kill_switch_approved: DimensionState
    monitoring_boundary_approved: DimensionState
    incident_response_approved: DimensionState
    operational_owner_approved: DimensionState
    enablement_runbook_approved: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise OperationalReadinessContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_operational_readiness(
    payload: Mapping[str, object],
) -> OperationalReadiness:
    if not isinstance(payload, Mapping):
        raise OperationalReadinessContractError("operational readiness payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise OperationalReadinessContractError(
            f"operational readiness fields mismatch: missing={missing}, extra={extra}"
        )

    return OperationalReadiness(
        artifact_integrity_approved=_dimension_state(
            "artifact_integrity_approved", payload["artifact_integrity_approved"]
        ),
        schema_integrity_approved=_dimension_state("schema_integrity_approved", payload["schema_integrity_approved"]),
        disabled_fail_closed_approved=_dimension_state(
            "disabled_fail_closed_approved", payload["disabled_fail_closed_approved"]
        ),
        authenticated_smoke_approved=_dimension_state(
            "authenticated_smoke_approved", payload["authenticated_smoke_approved"]
        ),
        rollback_kill_switch_approved=_dimension_state(
            "rollback_kill_switch_approved", payload["rollback_kill_switch_approved"]
        ),
        monitoring_boundary_approved=_dimension_state(
            "monitoring_boundary_approved", payload["monitoring_boundary_approved"]
        ),
        incident_response_approved=_dimension_state(
            "incident_response_approved", payload["incident_response_approved"]
        ),
        operational_owner_approved=_dimension_state(
            "operational_owner_approved", payload["operational_owner_approved"]
        ),
        enablement_runbook_approved=_dimension_state(
            "enablement_runbook_approved", payload["enablement_runbook_approved"]
        ),
    )


def evaluate_operational_readiness(
    readiness: OperationalReadiness,
) -> OperationalReadinessEvaluation:
    decision: OperationalReadinessDecision = (
        "PASS"
        if all(
            state == "PASS"
            for state in (
                readiness.artifact_integrity_approved,
                readiness.schema_integrity_approved,
                readiness.disabled_fail_closed_approved,
                readiness.authenticated_smoke_approved,
                readiness.rollback_kill_switch_approved,
                readiness.monitoring_boundary_approved,
                readiness.incident_response_approved,
                readiness.operational_owner_approved,
                readiness.enablement_runbook_approved,
            )
        )
        else "BLOCKED"
    )

    return OperationalReadinessEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        artifact_integrity_approved=readiness.artifact_integrity_approved,
        schema_integrity_approved=readiness.schema_integrity_approved,
        disabled_fail_closed_approved=readiness.disabled_fail_closed_approved,
        authenticated_smoke_approved=readiness.authenticated_smoke_approved,
        rollback_kill_switch_approved=readiness.rollback_kill_switch_approved,
        monitoring_boundary_approved=readiness.monitoring_boundary_approved,
        incident_response_approved=readiness.incident_response_approved,
        operational_owner_approved=readiness.operational_owner_approved,
        enablement_runbook_approved=readiness.enablement_runbook_approved,
    )


def evaluate_operational_readiness_payload(
    payload: Mapping[str, object],
) -> OperationalReadinessEvaluation:
    return evaluate_operational_readiness(parse_operational_readiness(payload))


CURRENT_T10_READINESS = OperationalReadiness(
    artifact_integrity_approved="PASS",
    schema_integrity_approved="PASS",
    disabled_fail_closed_approved="PASS",
    authenticated_smoke_approved="PASS",
    rollback_kill_switch_approved="PASS",
    monitoring_boundary_approved="PASS",
    incident_response_approved="PASS",
    operational_owner_approved="BLOCKED",
    enablement_runbook_approved="PASS",
)

CURRENT_T10_EVALUATION = evaluate_operational_readiness(CURRENT_T10_READINESS)
