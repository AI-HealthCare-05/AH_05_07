import os
from dataclasses import replace

import pytest

from app.services.model_v2_operational_readiness import CURRENT_T10_EVALUATION
from app.services.model_v2_privacy_notice_resolution import (
    CONTRACT_VERSION,
    CURRENT_T14_EVALUATION,
    INPUT_CATEGORIES,
    NON_DIAGNOSTIC_BOUNDARY,
    PRODUCT_TERM,
    PROHIBITED_USES,
    REQUIRED_DIMENSIONS,
    STORAGE_STATUS,
    PrivacyNoticeResolutionContractError,
    evaluate_privacy_notice_resolution_payload,
)
from app.services.model_v2_privacy_readiness import (
    CURRENT_T9_EVALUATION,
    CURRENT_T9_READINESS,
    PRE_T14_T9_EVALUATION,
    PRE_T14_T9_READINESS,
    T14_TRANSITION_VERSION,
    PrivacyReadinessTransitionError,
    transition_privacy_readiness_after_t14,
)
from app.services.model_v2_product_readiness import CURRENT_T8_EVALUATION
from app.services.model_v2_release_readiness import (
    CURRENT_T11_EVALUATION,
    derive_current_release_readiness,
)

ALL_PASS = {name: "PASS" for name in REQUIRED_DIMENSIONS}


def test_notice_contract_and_semantics_are_frozen():
    assert CONTRACT_VERSION == "model-v2-privacy-notice-resolution-v1"
    assert T14_TRANSITION_VERSION == "model-v2-privacy-readiness-t14-transition-v1"
    assert PRODUCT_TERM == "입력 기반 위험군 선별 신호"
    assert INPUT_CATEGORIES == (
        "age",
        "sex",
        "height_weight",
        "smoking",
        "alcohol",
        "walking_activity",
        "strength_activity",
        "sleep",
    )
    assert STORAGE_STATUS == (
        "model_v2_inputs_not_persisted",
        "model_v2_result_score_not_persisted",
    )
    assert PROHIBITED_USES == (
        "training_retraining",
        "advertising_marketing",
        "profile_enrichment",
        "cross_profile_use",
    )
    assert NON_DIAGNOSTIC_BOUNDARY == (
        "not_diagnosis",
        "not_treatment_recommendation",
        "not_prevention_judgment",
        "not_clinical_decision",
    )


def test_all_pass_notice_resolution_is_pass():
    assert evaluate_privacy_notice_resolution_payload(ALL_PASS).decision == "PASS"
    assert CURRENT_T14_EVALUATION.decision == "PASS"


@pytest.mark.parametrize("dimension", tuple(ALL_PASS))
def test_any_blocked_notice_dimension_is_blocked(dimension: str):
    payload = dict(ALL_PASS)
    payload[dimension] = "BLOCKED"
    assert evaluate_privacy_notice_resolution_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("dimension", tuple(ALL_PASS))
def test_any_not_reviewed_notice_dimension_is_blocked(dimension: str):
    payload = dict(ALL_PASS)
    payload[dimension] = "NOT_REVIEWED"
    assert evaluate_privacy_notice_resolution_payload(payload).decision == "BLOCKED"


def test_missing_or_extra_notice_dimension_is_rejected():
    missing = dict(ALL_PASS)
    missing.pop(next(iter(ALL_PASS)))
    extra = {**ALL_PASS, "unexpected": "PASS"}

    with pytest.raises(PrivacyNoticeResolutionContractError):
        evaluate_privacy_notice_resolution_payload(missing)
    with pytest.raises(PrivacyNoticeResolutionContractError):
        evaluate_privacy_notice_resolution_payload(extra)


@pytest.mark.parametrize("bad_state", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_or_non_string_notice_state_is_rejected(bad_state: object):
    payload = dict(ALL_PASS)
    payload["exact_purpose_disclosed"] = bad_state

    with pytest.raises(PrivacyNoticeResolutionContractError):
        evaluate_privacy_notice_resolution_payload(payload)


def test_pre_t14_t9_snapshot_is_preserved_as_blocked():
    assert PRE_T14_T9_EVALUATION.decision == "BLOCKED"
    assert PRE_T14_T9_READINESS.user_notice_collection_approved == "BLOCKED"
    assert sum(value == "BLOCKED" for value in PRE_T14_T9_READINESS.__dict__.values()) == 1


def test_t14_transition_changes_exactly_one_t9_dimension():
    before = PRE_T14_T9_READINESS.__dict__
    after = CURRENT_T9_READINESS.__dict__
    changed = {name for name in before if before[name] != after[name]}

    assert changed == {"user_notice_collection_approved"}
    assert CURRENT_T9_READINESS.user_notice_collection_approved == "PASS"
    assert CURRENT_T9_EVALUATION.decision == "PASS"


def test_transition_fails_closed_if_t14_not_pass():
    blocked = replace(CURRENT_T14_EVALUATION, decision="BLOCKED")

    with pytest.raises(PrivacyReadinessTransitionError):
        transition_privacy_readiness_after_t14(
            previous=PRE_T14_T9_READINESS,
            t14_evaluation=blocked,
        )


def test_transition_fails_closed_if_t14_version_mismatches():
    wrong_version = replace(
        CURRENT_T14_EVALUATION,
        contract_version="unexpected-version",
    )

    with pytest.raises(PrivacyReadinessTransitionError):
        transition_privacy_readiness_after_t14(
            previous=PRE_T14_T9_READINESS,
            t14_evaluation=wrong_version,
        )


def test_transition_fails_closed_if_t9_baseline_changed():
    changed_previous = replace(
        PRE_T14_T9_READINESS,
        data_separation_approved="BLOCKED",
    )

    with pytest.raises(PrivacyReadinessTransitionError):
        transition_privacy_readiness_after_t14(
            previous=changed_previous,
            t14_evaluation=CURRENT_T14_EVALUATION,
        )


def test_current_integrated_release_remains_no_go_after_privacy_pass():
    result = derive_current_release_readiness()

    assert CURRENT_T8_EVALUATION.decision == "PASS"
    assert CURRENT_T9_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.decision == "PASS"
    assert result.technical_readiness == "PASS"
    assert result.product_readiness == "PASS"
    assert result.privacy_readiness == "PASS"
    assert result.operational_readiness == "PASS"
    assert result.explicit_activation_approval is False
    assert result.decision == "NO_GO"
    assert CURRENT_T11_EVALUATION == result


def test_notice_evaluation_contains_no_runtime_or_user_payload_fields():
    fields = set(CURRENT_T14_EVALUATION.__dataclass_fields__)
    prohibited_fields = {
        "score",
        "numeric_score",
        "feature_payload",
        "user_id",
        "artifact_path",
        "request_body",
        "blood_pressure",
        "challenge",
    }
    assert fields.isdisjoint(prohibited_fields)


def test_notice_and_transition_do_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    assert evaluate_privacy_notice_resolution_payload(ALL_PASS).decision == "PASS"
    assert (
        transition_privacy_readiness_after_t14(
            previous=PRE_T14_T9_READINESS,
            t14_evaluation=CURRENT_T14_EVALUATION,
        )
        == CURRENT_T9_READINESS
    )

    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_or_production_credentials_are_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    assert CURRENT_T14_EVALUATION.decision == "PASS"
    assert CURRENT_T9_EVALUATION.decision == "PASS"
    assert derive_current_release_readiness().decision == "NO_GO"
