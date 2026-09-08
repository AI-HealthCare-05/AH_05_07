import os

import pytest

from app.services.model_v2_activation_contract import CURRENT_T7_EVALUATION
from app.services.model_v2_product_readiness import (
    CONTRACT_VERSION,
    CURRENT_T8_EVALUATION,
    ProductReadiness,
    ProductReadinessContractError,
    evaluate_product_readiness,
    evaluate_product_readiness_payload,
    parse_product_readiness,
)

ALL_PASS = {
    "product_term_approved": "PASS",
    "result_visibility_approved": "PASS",
    "age_applicability_approved": "PASS",
    "missing_policy_approved": "PASS",
    "research_product_applicability_approved": "PASS",
    "data_separation_approved": "PASS",
}


def test_contract_version_is_frozen_for_t8():
    assert CONTRACT_VERSION == "model-v2-product-readiness-v1"


def test_all_dimensions_pass_means_product_readiness_pass():
    result = evaluate_product_readiness_payload(ALL_PASS)
    assert result.decision == "PASS"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_blocked_dimension_blocks_product_readiness(field: str):
    payload = {**ALL_PASS, field: "BLOCKED"}
    assert evaluate_product_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_not_reviewed_dimension_blocks_product_readiness(field: str):
    payload = {**ALL_PASS, field: "NOT_REVIEWED"}
    assert evaluate_product_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize(
    "bad_payload",
    [
        {},
        {key: value for key, value in ALL_PASS.items() if key != "data_separation_approved"},
        {**ALL_PASS, "unexpected": "PASS"},
    ],
)
def test_missing_or_extra_fields_are_rejected(bad_payload):
    with pytest.raises(ProductReadinessContractError):
        parse_product_readiness(bad_payload)


@pytest.mark.parametrize("field", list(ALL_PASS))
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_dimension_state_is_rejected(field: str, value: object):
    payload = {**ALL_PASS, field: value}
    with pytest.raises(ProductReadinessContractError):
        parse_product_readiness(payload)


def test_evaluation_is_deterministic():
    readiness = ProductReadiness(**ALL_PASS)
    assert evaluate_product_readiness(readiness) == evaluate_product_readiness(readiness)


def test_decision_object_contains_only_t8_contract_fields():
    result = evaluate_product_readiness_payload(ALL_PASS)
    fields = set(result.__dataclass_fields__)
    assert fields == {
        "contract_version",
        "decision",
        "product_term_approved",
        "result_visibility_approved",
        "age_applicability_approved",
        "missing_policy_approved",
        "research_product_applicability_approved",
        "data_separation_approved",
    }
    joined = " ".join(fields)
    for prohibited in (
        "score",
        "feature",
        "blood",
        "pressure",
        "challenge",
        "user_id",
        "artifact",
        "schema",
    ):
        assert prohibited not in joined


def test_current_t8_snapshot_is_blocked():
    assert CURRENT_T8_EVALUATION.decision == "BLOCKED"
    assert CURRENT_T8_EVALUATION.product_term_approved == "PASS"
    assert CURRENT_T8_EVALUATION.result_visibility_approved == "PASS"
    assert CURRENT_T8_EVALUATION.age_applicability_approved == "BLOCKED"
    assert CURRENT_T8_EVALUATION.missing_policy_approved == "PASS"
    assert CURRENT_T8_EVALUATION.research_product_applicability_approved == "BLOCKED"
    assert CURRENT_T8_EVALUATION.data_separation_approved == "PASS"


def test_t7_current_decision_remains_no_go_and_not_rewritten():
    assert CURRENT_T7_EVALUATION.decision == "NO_GO"
    assert CURRENT_T7_EVALUATION.product_readiness == "NOT_REVIEWED"


def test_product_readiness_evaluation_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = evaluate_product_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_configuration_is_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    result = evaluate_product_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
