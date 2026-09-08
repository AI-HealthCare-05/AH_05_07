from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-activation-go-no-go-v1"

ReadinessState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
ActivationDecision = Literal["GO", "NO_GO"]

REQUIRED_DIMENSIONS = (
    "technical_readiness",
    "product_readiness",
    "privacy_readiness",
    "operational_readiness",
    "explicit_activation_approval",
)

READINESS_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class ActivationContractError(ValueError):
    """Raised when an activation readiness payload violates the T7 contract."""


@dataclass(frozen=True)
class ActivationReadiness:
    technical_readiness: ReadinessState
    product_readiness: ReadinessState
    privacy_readiness: ReadinessState
    operational_readiness: ReadinessState
    explicit_activation_approval: bool


@dataclass(frozen=True)
class ActivationEvaluation:
    contract_version: str
    decision: ActivationDecision
    technical_readiness: ReadinessState
    product_readiness: ReadinessState
    privacy_readiness: ReadinessState
    operational_readiness: ReadinessState
    explicit_activation_approval: bool


def _readiness_state(name: str, value: object) -> ReadinessState:
    if not isinstance(value, str) or value not in READINESS_STATES:
        raise ActivationContractError(
            f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED"
        )
    return value  # type: ignore[return-value]


def parse_activation_readiness(payload: Mapping[str, object]) -> ActivationReadiness:
    if not isinstance(payload, Mapping):
        raise ActivationContractError("activation readiness payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise ActivationContractError(
            f"activation readiness fields mismatch: missing={missing}, extra={extra}"
        )

    explicit = payload["explicit_activation_approval"]
    if type(explicit) is not bool:
        raise ActivationContractError("explicit_activation_approval must be boolean")

    return ActivationReadiness(
        technical_readiness=_readiness_state(
            "technical_readiness", payload["technical_readiness"]
        ),
        product_readiness=_readiness_state(
            "product_readiness", payload["product_readiness"]
        ),
        privacy_readiness=_readiness_state(
            "privacy_readiness", payload["privacy_readiness"]
        ),
        operational_readiness=_readiness_state(
            "operational_readiness", payload["operational_readiness"]
        ),
        explicit_activation_approval=explicit,
    )


def evaluate_activation_readiness(
    readiness: ActivationReadiness,
) -> ActivationEvaluation:
    readiness_passed = all(
        state == "PASS"
        for state in (
            readiness.technical_readiness,
            readiness.product_readiness,
            readiness.privacy_readiness,
            readiness.operational_readiness,
        )
    )
    decision: ActivationDecision = (
        "GO"
        if readiness_passed and readiness.explicit_activation_approval
        else "NO_GO"
    )

    return ActivationEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        technical_readiness=readiness.technical_readiness,
        product_readiness=readiness.product_readiness,
        privacy_readiness=readiness.privacy_readiness,
        operational_readiness=readiness.operational_readiness,
        explicit_activation_approval=readiness.explicit_activation_approval,
    )


def evaluate_activation_payload(
    payload: Mapping[str, object],
) -> ActivationEvaluation:
    return evaluate_activation_readiness(parse_activation_readiness(payload))


CURRENT_T7_READINESS = ActivationReadiness(
    technical_readiness="PASS",
    product_readiness="NOT_REVIEWED",
    privacy_readiness="NOT_REVIEWED",
    operational_readiness="NOT_REVIEWED",
    explicit_activation_approval=False,
)

CURRENT_T7_EVALUATION = evaluate_activation_readiness(CURRENT_T7_READINESS)
