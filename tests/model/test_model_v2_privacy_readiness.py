import os

import pytest

from app.services.model_v2_activation_contract import CURRENT_T7_EVALUATION
from app.services.model_v2_privacy_readiness import (
    CONTRACT_VERSION,
    CURRENT_T9_EVALUATION,
    PrivacyReadiness,
    PrivacyReadinessContractError,
    evaluate_privacy_readiness,
    evaluate_privacy_readiness_payload,
    parse_privacy_readiness,
)
from app.services.model_v2_product_readiness import CURRENT_T8_EVALUATION

ALL_PASS = {
    "purpose_limitation_approved": "PASS",
    "data_minimization_approved": "PASS",
    "transient_processing_approved": "PASS",
    "logging_monitoring_approved": "PASS",
    "analytics_boundary_approved": "PASS",
    "data_separation_approved": "PASS",
    "user_notice_collection_approved": "PASS",
    "retention_deletion_approved": "PASS",
}


def test_contract_version_is_frozen_for_t9():
    assert CONTRACT_VERSION == "model-v2-privacy-readiness-v1"


def test_all_dimensions_pass_means_privacy_readiness_pass():
    assert evaluate_privacy_readiness_payload(ALL_PASS).decision == "PASS"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_blocked_dimension_blocks_privacy_readiness(field: str):
    payload = {**ALL_PASS, field: "BLOCKED"}
    assert evaluate_privacy_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_not_reviewed_dimension_blocks_privacy_readiness(field: str):
    payload = {**ALL_PASS, field: "NOT_REVIEWED"}
    assert evaluate_privacy_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize(
    "bad_payload",
    [
        {},
        {key: value for key, value in ALL_PASS.items() if key != "retention_deletion_approved"},
        {**ALL_PASS, "unexpected": "PASS"},
    ],
)
def test_missing_or_extra_fields_are_rejected(bad_payload):
    with pytest.raises(PrivacyReadinessContractError):
        parse_privacy_readiness(bad_payload)


@pytest.mark.parametrize("field", list(ALL_PASS))
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_dimension_state_is_rejected(field: str, value: object):
    payload = {**ALL_PASS, field: value}
    with pytest.raises(PrivacyReadinessContractError):
        parse_privacy_readiness(payload)


def test_evaluation_is_deterministic():
    readiness = PrivacyReadiness(**ALL_PASS)
    assert evaluate_privacy_readiness(readiness) == evaluate_privacy_readiness(readiness)


def test_decision_object_contains_only_t9_contract_fields():
    result = evaluate_privacy_readiness_payload(ALL_PASS)
    fields = set(result.__dataclass_fields__)
    assert fields == {
        "contract_version",
        "decision",
        "purpose_limitation_approved",
        "data_minimization_approved",
        "transient_processing_approved",
        "logging_monitoring_approved",
        "analytics_boundary_approved",
        "data_separation_approved",
        "user_notice_collection_approved",
        "retention_deletion_approved",
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


def test_current_t9_snapshot_is_blocked_only_by_notice_collection_gate():
    assert CURRENT_T9_EVALUATION.decision == "BLOCKED"
    assert CURRENT_T9_EVALUATION.purpose_limitation_approved == "PASS"
    assert CURRENT_T9_EVALUATION.data_minimization_approved == "PASS"
    assert CURRENT_T9_EVALUATION.transient_processing_approved == "PASS"
    assert CURRENT_T9_EVALUATION.logging_monitoring_approved == "PASS"
    assert CURRENT_T9_EVALUATION.analytics_boundary_approved == "PASS"
    assert CURRENT_T9_EVALUATION.data_separation_approved == "PASS"
    assert CURRENT_T9_EVALUATION.user_notice_collection_approved == "BLOCKED"
    assert CURRENT_T9_EVALUATION.retention_deletion_approved == "PASS"


def test_t7_current_decision_remains_no_go_and_privacy_not_rewritten():
    assert CURRENT_T7_EVALUATION.decision == "NO_GO"
    assert CURRENT_T7_EVALUATION.privacy_readiness == "NOT_REVIEWED"


def test_t8_current_product_readiness_remains_blocked():
    assert CURRENT_T8_EVALUATION.decision == "BLOCKED"


def test_privacy_readiness_evaluation_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = evaluate_privacy_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_configuration_or_user_data_is_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    result = evaluate_privacy_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
