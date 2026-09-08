from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.model_v2_activation_approval_resolution import (
    CONTRACT_VERSION as T16_CONTRACT_VERSION,
)
from app.services.model_v2_activation_approval_resolution import (
    CURRENT_T16_EVALUATION,
    ActivationApprovalResolutionEvaluation,
)
from app.services.model_v2_operational_readiness import (
    CONTRACT_VERSION as T10_CONTRACT_VERSION,
)
from app.services.model_v2_operational_readiness import (
    CURRENT_T10_EVALUATION,
)
from app.services.model_v2_privacy_readiness import (
    CONTRACT_VERSION as T9_CONTRACT_VERSION,
)
from app.services.model_v2_privacy_readiness import (
    CURRENT_T9_EVALUATION,
)
from app.services.model_v2_product_readiness import (
    CONTRACT_VERSION as T8_CONTRACT_VERSION,
)
from app.services.model_v2_product_readiness import (
    CURRENT_T8_EVALUATION,
)

CONTRACT_VERSION = "model-v2-release-readiness-integration-v1"
T16_TRANSITION_VERSION = "model-v2-release-readiness-t16-transition-v1"

ReadinessState = Literal["PASS", "BLOCKED"]
ReleaseDecision = Literal["GO", "NO_GO"]


@dataclass(frozen=True)
class ReleaseReadiness:
    technical_readiness: ReadinessState
    product_readiness: ReadinessState
    privacy_readiness: ReadinessState
    operational_readiness: ReadinessState
    explicit_activation_approval: bool


@dataclass(frozen=True)
class ReleaseReadinessEvaluation:
    contract_version: str
    t8_contract_version: str
    t9_contract_version: str
    t10_contract_version: str
    decision: ReleaseDecision
    technical_readiness: ReadinessState
    product_readiness: ReadinessState
    privacy_readiness: ReadinessState
    operational_readiness: ReadinessState
    explicit_activation_approval: bool


class ReleaseReadinessContractError(ValueError):
    """Raised when a T11 release-readiness input violates the contract."""


class ReleaseReadinessTransitionError(ReleaseReadinessContractError):
    """Raised when T16 approval evidence does not authorize the T11 transition."""


def _state(name: str, value: object) -> ReadinessState:
    if not isinstance(value, str) or value not in {"PASS", "BLOCKED"}:
        raise ReleaseReadinessContractError(f"{name} must be PASS or BLOCKED")
    return value  # type: ignore[return-value]


def evaluate_release_readiness(
    *,
    technical_readiness: object,
    product_readiness: object,
    privacy_readiness: object,
    operational_readiness: object,
    explicit_activation_approval: object,
) -> ReleaseReadinessEvaluation:
    technical = _state("technical_readiness", technical_readiness)
    product = _state("product_readiness", product_readiness)
    privacy = _state("privacy_readiness", privacy_readiness)
    operational = _state("operational_readiness", operational_readiness)

    if type(explicit_activation_approval) is not bool:
        raise ReleaseReadinessContractError("explicit_activation_approval must be boolean")

    readiness = ReleaseReadiness(
        technical_readiness=technical,
        product_readiness=product,
        privacy_readiness=privacy,
        operational_readiness=operational,
        explicit_activation_approval=explicit_activation_approval,
    )

    decision: ReleaseDecision = (
        "GO"
        if (
            readiness.technical_readiness == "PASS"
            and readiness.product_readiness == "PASS"
            and readiness.privacy_readiness == "PASS"
            and readiness.operational_readiness == "PASS"
            and readiness.explicit_activation_approval
        )
        else "NO_GO"
    )

    return ReleaseReadinessEvaluation(
        contract_version=CONTRACT_VERSION,
        t8_contract_version=T8_CONTRACT_VERSION,
        t9_contract_version=T9_CONTRACT_VERSION,
        t10_contract_version=T10_CONTRACT_VERSION,
        decision=decision,
        technical_readiness=readiness.technical_readiness,
        product_readiness=readiness.product_readiness,
        privacy_readiness=readiness.privacy_readiness,
        operational_readiness=readiness.operational_readiness,
        explicit_activation_approval=readiness.explicit_activation_approval,
    )


PRE_T16_T11_EVALUATION = evaluate_release_readiness(
    technical_readiness="PASS",
    product_readiness=CURRENT_T8_EVALUATION.decision,
    privacy_readiness=CURRENT_T9_EVALUATION.decision,
    operational_readiness=CURRENT_T10_EVALUATION.decision,
    explicit_activation_approval=False,
)


def transition_release_readiness_after_t16(
    *,
    previous: ReleaseReadinessEvaluation,
    t16_evaluation: ActivationApprovalResolutionEvaluation,
) -> ReleaseReadinessEvaluation:
    if t16_evaluation.contract_version != T16_CONTRACT_VERSION:
        raise ReleaseReadinessTransitionError("T16 activation-approval evidence contract version mismatch")
    if t16_evaluation.decision != "PASS":
        raise ReleaseReadinessTransitionError("T16 activation approval must be PASS before T11 transition")
    if previous != PRE_T16_T11_EVALUATION:
        raise ReleaseReadinessTransitionError("T11 pre-transition snapshot does not match the reviewed T16 baseline")
    if (
        previous.technical_readiness != "PASS"
        or previous.product_readiness != "PASS"
        or previous.privacy_readiness != "PASS"
        or previous.operational_readiness != "PASS"
        or previous.explicit_activation_approval is not False
    ):
        raise ReleaseReadinessTransitionError(
            "T11 pre-transition readiness must be all PASS with explicit approval false"
        )

    return evaluate_release_readiness(
        technical_readiness=previous.technical_readiness,
        product_readiness=previous.product_readiness,
        privacy_readiness=previous.privacy_readiness,
        operational_readiness=previous.operational_readiness,
        explicit_activation_approval=True,
    )


def derive_current_release_readiness() -> ReleaseReadinessEvaluation:
    return transition_release_readiness_after_t16(
        previous=PRE_T16_T11_EVALUATION,
        t16_evaluation=CURRENT_T16_EVALUATION,
    )


CURRENT_T11_EVALUATION = derive_current_release_readiness()
