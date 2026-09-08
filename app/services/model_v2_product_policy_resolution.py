from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-product-policy-resolution-v1"
PRODUCT_TERM = "입력 기반 위험군 선별 신호"

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
ProductPolicyResolutionDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "age_19_plus_policy_approved",
    "age_80_plus_disclosure_approved",
    "no_upper_cutoff_invention_approved",
    "self_report_non_equivalence_approved",
    "product_applicability_limitation_approved",
    "non_diagnostic_wording_approved",
    "hidden_score_policy_preserved",
    "data_separation_preserved",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class ProductPolicyResolutionContractError(ValueError):
    """Raised when a T12 product-policy resolution payload violates the contract."""


@dataclass(frozen=True)
class ProductPolicyResolution:
    age_19_plus_policy_approved: DimensionState
    age_80_plus_disclosure_approved: DimensionState
    no_upper_cutoff_invention_approved: DimensionState
    self_report_non_equivalence_approved: DimensionState
    product_applicability_limitation_approved: DimensionState
    non_diagnostic_wording_approved: DimensionState
    hidden_score_policy_preserved: DimensionState
    data_separation_preserved: DimensionState


@dataclass(frozen=True)
class ProductPolicyResolutionEvaluation:
    contract_version: str
    decision: ProductPolicyResolutionDecision
    age_19_plus_policy_approved: DimensionState
    age_80_plus_disclosure_approved: DimensionState
    no_upper_cutoff_invention_approved: DimensionState
    self_report_non_equivalence_approved: DimensionState
    product_applicability_limitation_approved: DimensionState
    non_diagnostic_wording_approved: DimensionState
    hidden_score_policy_preserved: DimensionState
    data_separation_preserved: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise ProductPolicyResolutionContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_product_policy_resolution(
    payload: Mapping[str, object],
) -> ProductPolicyResolution:
    if not isinstance(payload, Mapping):
        raise ProductPolicyResolutionContractError("product policy resolution payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise ProductPolicyResolutionContractError(
            f"product policy resolution fields mismatch: missing={missing}, extra={extra}"
        )

    return ProductPolicyResolution(
        age_19_plus_policy_approved=_dimension_state(
            "age_19_plus_policy_approved", payload["age_19_plus_policy_approved"]
        ),
        age_80_plus_disclosure_approved=_dimension_state(
            "age_80_plus_disclosure_approved",
            payload["age_80_plus_disclosure_approved"],
        ),
        no_upper_cutoff_invention_approved=_dimension_state(
            "no_upper_cutoff_invention_approved",
            payload["no_upper_cutoff_invention_approved"],
        ),
        self_report_non_equivalence_approved=_dimension_state(
            "self_report_non_equivalence_approved",
            payload["self_report_non_equivalence_approved"],
        ),
        product_applicability_limitation_approved=_dimension_state(
            "product_applicability_limitation_approved",
            payload["product_applicability_limitation_approved"],
        ),
        non_diagnostic_wording_approved=_dimension_state(
            "non_diagnostic_wording_approved",
            payload["non_diagnostic_wording_approved"],
        ),
        hidden_score_policy_preserved=_dimension_state(
            "hidden_score_policy_preserved",
            payload["hidden_score_policy_preserved"],
        ),
        data_separation_preserved=_dimension_state(
            "data_separation_preserved",
            payload["data_separation_preserved"],
        ),
    )


def evaluate_product_policy_resolution(
    resolution: ProductPolicyResolution,
) -> ProductPolicyResolutionEvaluation:
    decision: ProductPolicyResolutionDecision = (
        "PASS"
        if all(
            state == "PASS"
            for state in (
                resolution.age_19_plus_policy_approved,
                resolution.age_80_plus_disclosure_approved,
                resolution.no_upper_cutoff_invention_approved,
                resolution.self_report_non_equivalence_approved,
                resolution.product_applicability_limitation_approved,
                resolution.non_diagnostic_wording_approved,
                resolution.hidden_score_policy_preserved,
                resolution.data_separation_preserved,
            )
        )
        else "BLOCKED"
    )

    return ProductPolicyResolutionEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        age_19_plus_policy_approved=resolution.age_19_plus_policy_approved,
        age_80_plus_disclosure_approved=resolution.age_80_plus_disclosure_approved,
        no_upper_cutoff_invention_approved=(resolution.no_upper_cutoff_invention_approved),
        self_report_non_equivalence_approved=(resolution.self_report_non_equivalence_approved),
        product_applicability_limitation_approved=(resolution.product_applicability_limitation_approved),
        non_diagnostic_wording_approved=resolution.non_diagnostic_wording_approved,
        hidden_score_policy_preserved=resolution.hidden_score_policy_preserved,
        data_separation_preserved=resolution.data_separation_preserved,
    )


def evaluate_product_policy_resolution_payload(
    payload: Mapping[str, object],
) -> ProductPolicyResolutionEvaluation:
    return evaluate_product_policy_resolution(parse_product_policy_resolution(payload))


CURRENT_T12_RESOLUTION = ProductPolicyResolution(
    age_19_plus_policy_approved="PASS",
    age_80_plus_disclosure_approved="PASS",
    no_upper_cutoff_invention_approved="PASS",
    self_report_non_equivalence_approved="PASS",
    product_applicability_limitation_approved="PASS",
    non_diagnostic_wording_approved="PASS",
    hidden_score_policy_preserved="PASS",
    data_separation_preserved="PASS",
)

CURRENT_T12_EVALUATION = evaluate_product_policy_resolution(CURRENT_T12_RESOLUTION)
