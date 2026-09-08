from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-operational-owner-resolution-v1"
OPERATIONAL_OWNER_ROLE = "Model V2 operational owner"

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
OperationalOwnerResolutionDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "operational_owner_designated",
    "rollback_kill_switch_authority_acknowledged",
    "monitoring_review_responsibility_acknowledged",
    "incident_response_responsibility_acknowledged",
    "activation_boundary_acknowledged",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class OperationalOwnerResolutionContractError(ValueError):
    """Raised when a T15 operational-owner resolution payload violates the contract."""


@dataclass(frozen=True)
class OperationalOwnerResolution:
    operational_owner_designated: DimensionState
    rollback_kill_switch_authority_acknowledged: DimensionState
    monitoring_review_responsibility_acknowledged: DimensionState
    incident_response_responsibility_acknowledged: DimensionState
    activation_boundary_acknowledged: DimensionState


@dataclass(frozen=True)
class OperationalOwnerResolutionEvaluation:
    contract_version: str
    decision: OperationalOwnerResolutionDecision
    operational_owner_designated: DimensionState
    rollback_kill_switch_authority_acknowledged: DimensionState
    monitoring_review_responsibility_acknowledged: DimensionState
    incident_response_responsibility_acknowledged: DimensionState
    activation_boundary_acknowledged: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise OperationalOwnerResolutionContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_operational_owner_resolution(
    payload: Mapping[str, object],
) -> OperationalOwnerResolution:
    if not isinstance(payload, Mapping):
        raise OperationalOwnerResolutionContractError("operational owner resolution payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise OperationalOwnerResolutionContractError(
            f"operational owner resolution fields mismatch: missing={missing}, extra={extra}"
        )

    return OperationalOwnerResolution(**{name: _dimension_state(name, payload[name]) for name in REQUIRED_DIMENSIONS})


def evaluate_operational_owner_resolution(
    resolution: OperationalOwnerResolution,
) -> OperationalOwnerResolutionEvaluation:
    states = tuple(getattr(resolution, name) for name in REQUIRED_DIMENSIONS)
    decision: OperationalOwnerResolutionDecision = "PASS" if all(state == "PASS" for state in states) else "BLOCKED"

    return OperationalOwnerResolutionEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        **{name: getattr(resolution, name) for name in REQUIRED_DIMENSIONS},
    )


def evaluate_operational_owner_resolution_payload(
    payload: Mapping[str, object],
) -> OperationalOwnerResolutionEvaluation:
    return evaluate_operational_owner_resolution(parse_operational_owner_resolution(payload))


CURRENT_T15_RESOLUTION = OperationalOwnerResolution(**{name: "PASS" for name in REQUIRED_DIMENSIONS})
CURRENT_T15_EVALUATION = evaluate_operational_owner_resolution(CURRENT_T15_RESOLUTION)
