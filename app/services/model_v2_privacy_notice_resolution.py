from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "model-v2-privacy-notice-resolution-v1"
PRODUCT_TERM = "입력 기반 위험군 선별 신호"

INPUT_CATEGORIES = (
    "age",
    "sex",
    "height_weight",
    "smoking",
    "alcohol",
    "walking_activity",
    "strength_activity",
    "sleep",
)

STORAGE_STATUS = (
    "model_v2_inputs_not_persisted",
    "model_v2_result_score_not_persisted",
)

PROHIBITED_USES = (
    "training_retraining",
    "advertising_marketing",
    "profile_enrichment",
    "cross_profile_use",
)

NON_DIAGNOSTIC_BOUNDARY = (
    "not_diagnosis",
    "not_treatment_recommendation",
    "not_prevention_judgment",
    "not_clinical_decision",
)

DimensionState = Literal["PASS", "BLOCKED", "NOT_REVIEWED"]
PrivacyNoticeResolutionDecision = Literal["PASS", "BLOCKED"]

REQUIRED_DIMENSIONS = (
    "input_categories_disclosed",
    "exact_purpose_disclosed",
    "non_diagnostic_boundary_disclosed",
    "no_persistence_status_disclosed",
    "no_training_retraining_use_approved",
    "no_ads_marketing_use_approved",
    "no_profile_enrichment_cross_profile_use_approved",
    "data_separation_disclosed",
    "raw_input_logging_prohibited",
    "raw_score_logging_prohibited",
    "raw_input_analytics_prohibited",
    "raw_score_analytics_prohibited",
)

DIMENSION_STATES = frozenset({"PASS", "BLOCKED", "NOT_REVIEWED"})


class PrivacyNoticeResolutionContractError(ValueError):
    """Raised when a T14 privacy-notice resolution payload violates the contract."""


@dataclass(frozen=True)
class PrivacyNoticeResolution:
    input_categories_disclosed: DimensionState
    exact_purpose_disclosed: DimensionState
    non_diagnostic_boundary_disclosed: DimensionState
    no_persistence_status_disclosed: DimensionState
    no_training_retraining_use_approved: DimensionState
    no_ads_marketing_use_approved: DimensionState
    no_profile_enrichment_cross_profile_use_approved: DimensionState
    data_separation_disclosed: DimensionState
    raw_input_logging_prohibited: DimensionState
    raw_score_logging_prohibited: DimensionState
    raw_input_analytics_prohibited: DimensionState
    raw_score_analytics_prohibited: DimensionState


@dataclass(frozen=True)
class PrivacyNoticeResolutionEvaluation:
    contract_version: str
    decision: PrivacyNoticeResolutionDecision
    input_categories_disclosed: DimensionState
    exact_purpose_disclosed: DimensionState
    non_diagnostic_boundary_disclosed: DimensionState
    no_persistence_status_disclosed: DimensionState
    no_training_retraining_use_approved: DimensionState
    no_ads_marketing_use_approved: DimensionState
    no_profile_enrichment_cross_profile_use_approved: DimensionState
    data_separation_disclosed: DimensionState
    raw_input_logging_prohibited: DimensionState
    raw_score_logging_prohibited: DimensionState
    raw_input_analytics_prohibited: DimensionState
    raw_score_analytics_prohibited: DimensionState


def _dimension_state(name: str, value: object) -> DimensionState:
    if not isinstance(value, str) or value not in DIMENSION_STATES:
        raise PrivacyNoticeResolutionContractError(f"{name} must be one of PASS, BLOCKED, NOT_REVIEWED")
    return value  # type: ignore[return-value]


def parse_privacy_notice_resolution(
    payload: Mapping[str, object],
) -> PrivacyNoticeResolution:
    if not isinstance(payload, Mapping):
        raise PrivacyNoticeResolutionContractError("privacy notice resolution payload must be a mapping")

    keys = tuple(payload.keys())
    missing = [name for name in REQUIRED_DIMENSIONS if name not in payload]
    extra = [name for name in keys if name not in REQUIRED_DIMENSIONS]
    if missing or extra:
        raise PrivacyNoticeResolutionContractError(
            f"privacy notice resolution fields mismatch: missing={missing}, extra={extra}"
        )

    return PrivacyNoticeResolution(**{name: _dimension_state(name, payload[name]) for name in REQUIRED_DIMENSIONS})


def evaluate_privacy_notice_resolution(
    resolution: PrivacyNoticeResolution,
) -> PrivacyNoticeResolutionEvaluation:
    states = tuple(getattr(resolution, name) for name in REQUIRED_DIMENSIONS)
    decision: PrivacyNoticeResolutionDecision = "PASS" if all(state == "PASS" for state in states) else "BLOCKED"

    return PrivacyNoticeResolutionEvaluation(
        contract_version=CONTRACT_VERSION,
        decision=decision,
        **{name: getattr(resolution, name) for name in REQUIRED_DIMENSIONS},
    )


def evaluate_privacy_notice_resolution_payload(
    payload: Mapping[str, object],
) -> PrivacyNoticeResolutionEvaluation:
    return evaluate_privacy_notice_resolution(parse_privacy_notice_resolution(payload))


CURRENT_T14_RESOLUTION = PrivacyNoticeResolution(**{name: "PASS" for name in REQUIRED_DIMENSIONS})

CURRENT_T14_EVALUATION = evaluate_privacy_notice_resolution(CURRENT_T14_RESOLUTION)
