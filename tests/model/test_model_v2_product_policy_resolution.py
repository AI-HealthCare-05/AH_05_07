import os

import pytest

from app.services.model_v2_operational_readiness import CURRENT_T10_EVALUATION
from app.services.model_v2_privacy_readiness import CURRENT_T9_EVALUATION
from app.services.model_v2_product_policy_resolution import (
    CONTRACT_VERSION,
    CURRENT_T12_EVALUATION,
    PRODUCT_TERM,
    ProductPolicyResolutionContractError,
    evaluate_product_policy_resolution_payload,
)
from app.services.model_v2_product_readiness import (
    CURRENT_T8_EVALUATION,
    PRE_T13_T8_EVALUATION,
)
from app.services.model_v2_release_readiness import CURRENT_T11_EVALUATION

ALL_PASS = {
    "age_19_plus_policy_approved": "PASS",
    "age_80_plus_disclosure_approved": "PASS",
    "no_upper_cutoff_invention_approved": "PASS",
    "self_report_non_equivalence_approved": "PASS",
    "product_applicability_limitation_approved": "PASS",
    "non_diagnostic_wording_approved": "PASS",
    "hidden_score_policy_preserved": "PASS",
    "data_separation_preserved": "PASS",
}


def test_contract_version_and_product_term_are_frozen():
    assert CONTRACT_VERSION == "model-v2-product-policy-resolution-v1"
    assert PRODUCT_TERM == "입력 기반 위험군 선별 신호"


def test_all_pass_is_resolution_pass():
    assert evaluate_product_policy_resolution_payload(ALL_PASS).decision == "PASS"


@pytest.mark.parametrize("dimension", tuple(ALL_PASS))
def test_any_blocked_dimension_is_blocked(dimension: str):
    payload = dict(ALL_PASS)
    payload[dimension] = "BLOCKED"
    assert evaluate_product_policy_resolution_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("dimension", tuple(ALL_PASS))
def test_any_not_reviewed_dimension_is_blocked(dimension: str):
    payload = dict(ALL_PASS)
    payload[dimension] = "NOT_REVIEWED"
    assert evaluate_product_policy_resolution_payload(payload).decision == "BLOCKED"


def test_missing_field_is_rejected():
    payload = dict(ALL_PASS)
    payload.pop("age_80_plus_disclosure_approved")

    with pytest.raises(ProductPolicyResolutionContractError):
        evaluate_product_policy_resolution_payload(payload)


def test_extra_field_is_rejected():
    payload = dict(ALL_PASS)
    payload["unexpected"] = "PASS"

    with pytest.raises(ProductPolicyResolutionContractError):
        evaluate_product_policy_resolution_payload(payload)


@pytest.mark.parametrize(
    "bad_state",
    ["READY", "GO", "", None, True, 1, [], {}],
)
def test_unknown_or_non_string_state_is_rejected(bad_state: object):
    payload = dict(ALL_PASS)
    payload["self_report_non_equivalence_approved"] = bad_state

    with pytest.raises(ProductPolicyResolutionContractError):
        evaluate_product_policy_resolution_payload(payload)


def test_current_t12_policy_snapshot_is_pass():
    assert CURRENT_T12_EVALUATION.decision == "PASS"


def test_pre_t13_t8_historical_snapshot_remains_blocked():
    assert PRE_T13_T8_EVALUATION.age_applicability_approved == "BLOCKED"
    assert PRE_T13_T8_EVALUATION.research_product_applicability_approved == "BLOCKED"
    assert PRE_T13_T8_EVALUATION.decision == "BLOCKED"


def test_current_t8_snapshot_is_pass_after_t13():
    assert CURRENT_T8_EVALUATION.age_applicability_approved == "PASS"
    assert CURRENT_T8_EVALUATION.research_product_applicability_approved == "PASS"
    assert CURRENT_T8_EVALUATION.decision == "PASS"


def test_later_release_gates_are_go_after_t16_activation_approval():
    assert CURRENT_T9_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.decision == "PASS"
    assert CURRENT_T11_EVALUATION.decision == "GO"


def test_resolution_is_deterministic():
    first = evaluate_product_policy_resolution_payload(ALL_PASS)
    second = evaluate_product_policy_resolution_payload(ALL_PASS)
    assert first == second


def test_evaluation_contains_no_sensitive_or_runtime_payload_fields():
    fields = set(CURRENT_T12_EVALUATION.__dataclass_fields__)

    prohibited_fields = {
        "score",
        "numeric_score",
        "feature_payload",
        "feature_vector",
        "blood_pressure",
        "challenge",
        "user_id",
        "artifact_path",
        "request_body",
    }

    assert fields.isdisjoint(prohibited_fields)


def test_resolution_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = evaluate_product_policy_resolution_payload(ALL_PASS)

    assert result.decision == "PASS"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_or_production_credentials_are_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    assert evaluate_product_policy_resolution_payload(ALL_PASS).decision == "PASS"
