import os

import pytest

from app.services.model_v2_activation_contract import (
    CONTRACT_VERSION,
    CURRENT_T7_EVALUATION,
    ActivationContractError,
    ActivationReadiness,
    evaluate_activation_payload,
    evaluate_activation_readiness,
    parse_activation_readiness,
)

ALL_PASS_NO_APPROVAL = {
    "technical_readiness": "PASS",
    "product_readiness": "PASS",
    "privacy_readiness": "PASS",
    "operational_readiness": "PASS",
    "explicit_activation_approval": False,
}


def test_contract_version_is_frozen_for_t7():
    assert CONTRACT_VERSION == "model-v2-activation-go-no-go-v1"


def test_all_pass_without_explicit_approval_is_no_go():
    result = evaluate_activation_payload(ALL_PASS_NO_APPROVAL)
    assert result.decision == "NO_GO"


@pytest.mark.parametrize(
    "field",
    [
        "technical_readiness",
        "product_readiness",
        "privacy_readiness",
        "operational_readiness",
    ],
)
def test_any_blocked_dimension_is_no_go(field: str):
    payload = {**ALL_PASS_NO_APPROVAL, field: "BLOCKED", "explicit_activation_approval": True}
    assert evaluate_activation_payload(payload).decision == "NO_GO"


@pytest.mark.parametrize(
    "field",
    [
        "technical_readiness",
        "product_readiness",
        "privacy_readiness",
        "operational_readiness",
    ],
)
def test_any_not_reviewed_dimension_is_no_go(field: str):
    payload = {**ALL_PASS_NO_APPROVAL, field: "NOT_REVIEWED", "explicit_activation_approval": True}
    assert evaluate_activation_payload(payload).decision == "NO_GO"


def test_all_pass_and_explicit_approval_is_go_at_contract_level_only():
    payload = {**ALL_PASS_NO_APPROVAL, "explicit_activation_approval": True}
    result = evaluate_activation_payload(payload)
    assert result.decision == "GO"


@pytest.mark.parametrize(
    "bad_payload",
    [
        {},
        {
            "technical_readiness": "PASS",
            "product_readiness": "PASS",
            "privacy_readiness": "PASS",
            "operational_readiness": "PASS",
        },
        {
            **ALL_PASS_NO_APPROVAL,
            "unexpected": "PASS",
        },
    ],
)
def test_missing_or_extra_fields_are_rejected(bad_payload):
    with pytest.raises(ActivationContractError):
        parse_activation_readiness(bad_payload)


@pytest.mark.parametrize(
    "field",
    [
        "technical_readiness",
        "product_readiness",
        "privacy_readiness",
        "operational_readiness",
    ],
)
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_readiness_state_is_rejected(field: str, value: object):
    payload = {**ALL_PASS_NO_APPROVAL, field: value}
    with pytest.raises(ActivationContractError):
        parse_activation_readiness(payload)


@pytest.mark.parametrize("value", [1, 0, "true", "false", None, [], {}])
def test_explicit_activation_approval_requires_boolean(value: object):
    payload = {**ALL_PASS_NO_APPROVAL, "explicit_activation_approval": value}
    with pytest.raises(ActivationContractError):
        parse_activation_readiness(payload)


def test_evaluation_is_deterministic():
    readiness = ActivationReadiness(
        technical_readiness="PASS",
        product_readiness="PASS",
        privacy_readiness="PASS",
        operational_readiness="PASS",
        explicit_activation_approval=False,
    )
    assert evaluate_activation_readiness(readiness) == evaluate_activation_readiness(readiness)


def test_decision_object_contains_no_score_feature_bp_or_challenge_payload():
    result = evaluate_activation_payload(ALL_PASS_NO_APPROVAL)
    fields = set(result.__dataclass_fields__)
    assert fields == {
        "contract_version",
        "decision",
        "technical_readiness",
        "product_readiness",
        "privacy_readiness",
        "operational_readiness",
        "explicit_activation_approval",
    }
    joined = " ".join(fields)
    for prohibited in ("score", "feature", "blood", "pressure", "challenge"):
        assert prohibited not in joined


def test_current_t7_completion_decision_is_no_go():
    assert CURRENT_T7_EVALUATION.decision == "NO_GO"
    assert CURRENT_T7_EVALUATION.technical_readiness == "PASS"
    assert CURRENT_T7_EVALUATION.product_readiness == "NOT_REVIEWED"
    assert CURRENT_T7_EVALUATION.privacy_readiness == "NOT_REVIEWED"
    assert CURRENT_T7_EVALUATION.operational_readiness == "NOT_REVIEWED"
    assert CURRENT_T7_EVALUATION.explicit_activation_approval is False


def test_evaluation_does_not_mutate_scoring_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = evaluate_activation_payload({**ALL_PASS_NO_APPROVAL, "explicit_activation_approval": True})

    assert result.decision == "GO"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_configuration_is_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    result = evaluate_activation_payload(ALL_PASS_NO_APPROVAL)

    assert result.decision == "NO_GO"
