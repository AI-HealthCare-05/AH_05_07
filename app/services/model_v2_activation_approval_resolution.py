from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-explicit-activation-approval-v1"

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
ActivationApprovalResolutionDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "all_readiness_pass_confirmed",
    "operator_explicit_activation_approval_recorded",
    "production_enablement_separate_step_acknowledged",
    "rollback_kill_switch_authority_acknowledged",
    "real_user_collection_separate_step_acknowledged",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class ActivationApprovalResolutionContractError(ValueError):
    """Raised when a T16 activation-approval payload violates the contract."""


@dataclass(frozen=True)
class ActivationApprovalResolution:
    all_readiness_pass_confirmed: DimensionState
    operator_explicit_activation_approval_recorded: DimensionState
    production_enablement_separate_step_acknowledged: DimensionState
    rollback_kill_switch_authority_acknowledged: DimensionState
    real_user_collection_separate_step_acknowledged: DimensionState


@dataclass(frozen=True)
class ActivationApprovalResolutionEvaluation:
    contract_version: str
    decision: ActivationApprovalResolutionDecision
    all_readiness_pass_confirmed: DimensionState
    operator_explicit_activation_approval_recorded: DimensionState
    production_enablement_separate_step_acknowledged: DimensionState
    rollback_kill_switch_authority_acknowledged: DimensionState
    real_user_collection_separate_step_acknowledged: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise ActivationApprovalResolutionContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_activation_approval_resolution(
    payload: Mapping[str, object],
) -> ActivationApprovalResolution:
    if not isinstance(payload, Mapping):
        raise ActivationApprovalResolutionContractError("activation approval resolution payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise ActivationApprovalResolutionContractError(
            f"activation approval resolution fields mismatch: missing={missing}, extra={extra}"
        )

    return ActivationApprovalResolution(**{name: _dimension_state(name, payload[name]) for name in REQUIRED_DIMENSIONS})


def evaluate_activation_approval_resolution(
    resolution: ActivationApprovalResolution,
) -> ActivationApprovalResolutionEvaluation:
    states = tuple(getattr(resolution, name) for name in REQUIRED_DIMENSIONS)
    decision: ActivationApprovalResolutionDecision = "PASS" if all(state == "PASS" for state in states) else "BLOCKED"

    return ActivationApprovalResolutionEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        **{name: getattr(resolution, name) for name in REQUIRED_DIMENSIONS},
    )


def evaluate_activation_approval_resolution_payload(
    payload: Mapping[str, object],
) -> ActivationApprovalResolutionEvaluation:
    return evaluate_activation_approval_resolution(parse_activation_approval_resolution(payload))


CURRENT_T16_RESOLUTION = ActivationApprovalResolution(**{name: "PASS" for name in REQUIRED_DIMENSIONS})

CURRENT_T16_EVALUATION = evaluate_activation_approval_resolution(CURRENT_T16_RESOLUTION)
