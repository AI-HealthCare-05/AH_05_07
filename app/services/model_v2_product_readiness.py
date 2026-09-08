from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.services.model_v2_product_policy_resolution import (
    CONTRACT_VERSION as T12_CONTRACT_VERSION,
)
from app.services.model_v2_product_policy_resolution import (
    CURRENT_T12_EVALUATION,
    ProductPolicyResolutionEvaluation,
)

CONTRACT_VERSION = "model-v2-product-readiness-v1"
T13_TRANSITION_VERSION = "model-v2-product-readiness-t13-transition-v1"

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
ProductReadinessDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "product_term_approved",
    "result_visibility_approved",
    "age_applicability_approved",
    "missing_policy_approved",
    "research_product_applicability_approved",
    "data_separation_approved",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class ProductReadinessContractError(ValueError):
    """Raised when a T8 product-readiness payload violates the contract."""


class ProductReadinessTransitionError(ProductReadinessContractError):
    """Raised when the T13 readiness transition is not authorized by T12 evidence."""


@dataclass(frozen=True)
class ProductReadiness:
    product_term_approved: DimensionState
    result_visibility_approved: DimensionState
    age_applicability_approved: DimensionState
    missing_policy_approved: DimensionState
    research_product_applicability_approved: DimensionState
    data_separation_approved: DimensionState


@dataclass(frozen=True)
class ProductReadinessEvaluation:
    contract_version: str
    decision: ProductReadinessDecision
    product_term_approved: DimensionState
    result_visibility_approved: DimensionState
    age_applicability_approved: DimensionState
    missing_policy_approved: DimensionState
    research_product_applicability_approved: DimensionState
    data_separation_approved: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise ProductReadinessContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_product_readiness(payload: Mapping[str, object]) -> ProductReadiness:
    if not isinstance(payload, Mapping):
        raise ProductReadinessContractError("product readiness payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise ProductReadinessContractError(f"product readiness fields mismatch: missing={missing}, extra={extra}")

    return ProductReadiness(
        product_term_approved=_dimension_state("product_term_approved", payload["product_term_approved"]),
        result_visibility_approved=_dimension_state(
            "result_visibility_approved", payload["result_visibility_approved"]
        ),
        age_applicability_approved=_dimension_state(
            "age_applicability_approved", payload["age_applicability_approved"]
        ),
        missing_policy_approved=_dimension_state("missing_policy_approved", payload["missing_policy_approved"]),
        research_product_applicability_approved=_dimension_state(
            "research_product_applicability_approved",
            payload["research_product_applicability_approved"],
        ),
        data_separation_approved=_dimension_state("data_separation_approved", payload["data_separation_approved"]),
    )


def evaluate_product_readiness(
    readiness: ProductReadiness,
) -> ProductReadinessEvaluation:
    decision: ProductReadinessDecision = (
        "PASS"
        if all(
            state == "PASS"
            for state in (
                readiness.product_term_approved,
                readiness.result_visibility_approved,
                readiness.age_applicability_approved,
                readiness.missing_policy_approved,
                readiness.research_product_applicability_approved,
                readiness.data_separation_approved,
            )
        )
        else "BLOCKED"
    )

    return ProductReadinessEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        product_term_approved=readiness.product_term_approved,
        result_visibility_approved=readiness.result_visibility_approved,
        age_applicability_approved=readiness.age_applicability_approved,
        missing_policy_approved=readiness.missing_policy_approved,
        research_product_applicability_approved=(readiness.research_product_applicability_approved),
        data_separation_approved=readiness.data_separation_approved,
    )


def evaluate_product_readiness_payload(
    payload: Mapping[str, object],
) -> ProductReadinessEvaluation:
    return evaluate_product_readiness(parse_product_readiness(payload))


PRE_T13_T8_READINESS = ProductReadiness(
    product_term_approved="PASS",
    result_visibility_approved="PASS",
    age_applicability_approved="BLOCKED",
    missing_policy_approved="PASS",
    research_product_applicability_approved="BLOCKED",
    data_separation_approved="PASS",
)

PRE_T13_T8_EVALUATION = evaluate_product_readiness(PRE_T13_T8_READINESS)


def transition_product_readiness_after_t12(
    *,
    previous: ProductReadiness,
    t12_evaluation: ProductPolicyResolutionEvaluation,
) -> ProductReadiness:
    if t12_evaluation.contract_version != T12_CONTRACT_VERSION:
        raise ProductReadinessTransitionError("T12 product-policy evidence contract version mismatch")
    if t12_evaluation.decision != "PASS":
        raise ProductReadinessTransitionError("T12 product-policy resolution must be PASS before T8 transition")
    if previous != PRE_T13_T8_READINESS:
        raise ProductReadinessTransitionError("T8 pre-transition snapshot does not match the reviewed T13 baseline")

    return ProductReadiness(
        product_term_approved=previous.product_term_approved,
        result_visibility_approved=previous.result_visibility_approved,
        age_applicability_approved="PASS",
        missing_policy_approved=previous.missing_policy_approved,
        research_product_applicability_approved="PASS",
        data_separation_approved=previous.data_separation_approved,
    )


CURRENT_T8_READINESS = transition_product_readiness_after_t12(
    previous=PRE_T13_T8_READINESS,
    t12_evaluation=CURRENT_T12_EVALUATION,
)

CURRENT_T8_EVALUATION = evaluate_product_readiness(CURRENT_T8_READINESS)
