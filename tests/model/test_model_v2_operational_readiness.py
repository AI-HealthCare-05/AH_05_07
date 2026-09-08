import os

import pytest

from app.services.model_v2_activation_contract import CURRENT_T7_EVALUATION
from app.services.model_v2_operational_readiness import (
    CONTRACT_VERSION,
    CURRENT_T10_EVALUATION,
    FROZEN_ARTIFACT_FILENAME,
    FROZEN_ARTIFACT_SHA256,
    FROZEN_FEATURE_COUNT,
    FROZEN_SCHEMA_VERSION,
    PRE_T15_T10_EVALUATION,
    OperationalReadiness,
    OperationalReadinessContractError,
    evaluate_operational_readiness,
    evaluate_operational_readiness_payload,
    parse_operational_readiness,
)
from app.services.model_v2_privacy_readiness import CURRENT_T9_EVALUATION
from app.services.model_v2_product_readiness import CURRENT_T8_EVALUATION

ALL_PASS = {
    "artifact_integrity_approved": "PASS",
    "schema_integrity_approved": "PASS",
    "disabled_fail_closed_approved": "PASS",
    "authenticated_smoke_approved": "PASS",
    "rollback_kill_switch_approved": "PASS",
    "monitoring_boundary_approved": "PASS",
    "incident_response_approved": "PASS",
    "operational_owner_approved": "PASS",
    "enablement_runbook_approved": "PASS",
}


def test_contract_version_is_frozen_for_t10():
    assert CONTRACT_VERSION == "model-v2-operational-readiness-v1"


def test_frozen_runtime_references_match_round_2_contract():
    assert FROZEN_ARTIFACT_FILENAME == "model-v2-r1-a.joblib"
    assert FROZEN_ARTIFACT_SHA256 == "d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84"
    assert FROZEN_SCHEMA_VERSION == "model-v2-r1-schema-v1"
    assert FROZEN_FEATURE_COUNT == 11


def test_all_dimensions_pass_means_operational_readiness_pass():
    assert evaluate_operational_readiness_payload(ALL_PASS).decision == "PASS"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_blocked_dimension_blocks_operational_readiness(field: str):
    payload = {**ALL_PASS, field: "BLOCKED"}
    assert evaluate_operational_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("field", list(ALL_PASS))
def test_any_not_reviewed_dimension_blocks_operational_readiness(field: str):
    payload = {**ALL_PASS, field: "NOT_REVIEWED"}
    assert evaluate_operational_readiness_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize(
    "bad_payload",
    [
        {},
        {key: value for key, value in ALL_PASS.items() if key != "enablement_runbook_approved"},
        {**ALL_PASS, "unexpected": "PASS"},
    ],
)
def test_missing_or_extra_fields_are_rejected(bad_payload):
    with pytest.raises(OperationalReadinessContractError):
        parse_operational_readiness(bad_payload)


@pytest.mark.parametrize("field", list(ALL_PASS))
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_dimension_state_is_rejected(field: str, value: object):
    payload = {**ALL_PASS, field: value}
    with pytest.raises(OperationalReadinessContractError):
        parse_operational_readiness(payload)


def test_evaluation_is_deterministic():
    readiness = OperationalReadiness(**ALL_PASS)
    assert evaluate_operational_readiness(readiness) == evaluate_operational_readiness(readiness)


def test_decision_object_contains_only_t10_contract_fields():
    result = evaluate_operational_readiness_payload(ALL_PASS)
    fields = set(result.__dataclass_fields__)
    assert fields == {
        "contract_version",
        "decision",
        "artifact_integrity_approved",
        "schema_integrity_approved",
        "disabled_fail_closed_approved",
        "authenticated_smoke_approved",
        "rollback_kill_switch_approved",
        "monitoring_boundary_approved",
        "incident_response_approved",
        "operational_owner_approved",
        "enablement_runbook_approved",
    }

    joined = " ".join(fields)
    for prohibited in (
        "score",
        "feature_payload",
        "blood",
        "pressure",
        "challenge",
        "user_id",
        "request_body",
    ):
        assert prohibited not in joined


def test_pre_t15_t10_snapshot_is_blocked_only_by_operational_owner():
    assert PRE_T15_T10_EVALUATION.decision == "BLOCKED"
    assert PRE_T15_T10_EVALUATION.operational_owner_approved == "BLOCKED"


def test_current_t10_snapshot_is_pass_after_t15():
    assert CURRENT_T10_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.operational_owner_approved == "PASS"


def test_t7_current_decision_remains_no_go_and_operational_not_rewritten():
    assert CURRENT_T7_EVALUATION.decision == "NO_GO"
    assert CURRENT_T7_EVALUATION.operational_readiness == "NOT_REVIEWED"
    assert CURRENT_T7_EVALUATION.explicit_activation_approval is False


def test_t8_product_readiness_remains_pass():
    assert CURRENT_T8_EVALUATION.decision == "PASS"


def test_t9_privacy_readiness_remains_pass_after_t14():
    assert CURRENT_T9_EVALUATION.decision == "PASS"


def test_operational_evaluation_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = evaluate_operational_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_or_production_configuration_is_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    result = evaluate_operational_readiness_payload(ALL_PASS)

    assert result.decision == "PASS"
