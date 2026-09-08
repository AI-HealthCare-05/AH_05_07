import os
from dataclasses import replace

import pytest

from app.services.model_v2_operational_owner_resolution import (
    CONTRACT_VERSION,
    CURRENT_T15_EVALUATION,
    OPERATIONAL_OWNER_ROLE,
    REQUIRED_DIMENSIONS,
    OperationalOwnerResolutionContractError,
    evaluate_operational_owner_resolution_payload,
)
from app.services.model_v2_operational_readiness import (
    CURRENT_T10_EVALUATION,
    PRE_T15_T10_EVALUATION,
    PRE_T15_T10_READINESS,
    OperationalReadinessTransitionError,
    transition_operational_readiness_after_t15,
)
from app.services.model_v2_release_readiness import derive_current_release_readiness

ALL_PASS = {name: "PASS" for name in REQUIRED_DIMENSIONS}


def test_t15_contract_version_and_role_are_frozen():
    assert CONTRACT_VERSION == "model-v2-operational-owner-resolution-v1"
    assert OPERATIONAL_OWNER_ROLE == "Model V2 operational owner"


def test_t15_required_dimensions_are_exact():
    assert REQUIRED_DIMENSIONS == (
        "operational_owner_designated",
        "rollback_kill_switch_authority_acknowledged",
        "monitoring_review_responsibility_acknowledged",
        "incident_response_responsibility_acknowledged",
        "activation_boundary_acknowledged",
    )


def test_all_t15_dimensions_pass_means_pass():
    assert evaluate_operational_owner_resolution_payload(ALL_PASS).decision == "PASS"


@pytest.mark.parametrize("field", REQUIRED_DIMENSIONS)
@pytest.mark.parametrize("state", ["BLOCKED", "NOT_REVIEWED"])
def test_any_non_pass_t15_dimension_blocks(field: str, state: str):
    payload = {**ALL_PASS, field: state}
    assert evaluate_operational_owner_resolution_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("field", REQUIRED_DIMENSIONS)
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_or_non_string_t15_state_is_rejected(field: str, value: object):
    with pytest.raises(OperationalOwnerResolutionContractError):
        evaluate_operational_owner_resolution_payload({**ALL_PASS, field: value})


def test_missing_and_extra_t15_fields_are_rejected():
    with pytest.raises(OperationalOwnerResolutionContractError):
        evaluate_operational_owner_resolution_payload({})
    with pytest.raises(OperationalOwnerResolutionContractError):
        evaluate_operational_owner_resolution_payload({**ALL_PASS, "unexpected": "PASS"})


def test_pre_t15_t10_snapshot_is_preserved_as_blocked():
    assert PRE_T15_T10_EVALUATION.decision == "BLOCKED"
    assert PRE_T15_T10_EVALUATION.operational_owner_approved == "BLOCKED"


def test_t15_transition_changes_exactly_operational_owner_dimension():
    transitioned = transition_operational_readiness_after_t15(
        previous=PRE_T15_T10_READINESS,
        t15_evaluation=CURRENT_T15_EVALUATION,
    )
    for field in PRE_T15_T10_READINESS.__dataclass_fields__:
        before = getattr(PRE_T15_T10_READINESS, field)
        after = getattr(transitioned, field)
        if field == "operational_owner_approved":
            assert before == "BLOCKED"
            assert after == "PASS"
        else:
            assert after == before


def test_t15_transition_rejects_wrong_contract_version():
    wrong = replace(CURRENT_T15_EVALUATION, contract_version="wrong")
    with pytest.raises(OperationalReadinessTransitionError):
        transition_operational_readiness_after_t15(
            previous=PRE_T15_T10_READINESS,
            t15_evaluation=wrong,
        )


def test_t15_transition_rejects_blocked_resolution():
    blocked = replace(CURRENT_T15_EVALUATION, decision="BLOCKED")
    with pytest.raises(OperationalReadinessTransitionError):
        transition_operational_readiness_after_t15(
            previous=PRE_T15_T10_READINESS,
            t15_evaluation=blocked,
        )


def test_t15_transition_rejects_changed_pretransition_snapshot():
    changed = replace(PRE_T15_T10_READINESS, incident_response_approved="BLOCKED")
    with pytest.raises(OperationalReadinessTransitionError):
        transition_operational_readiness_after_t15(
            previous=changed,
            t15_evaluation=CURRENT_T15_EVALUATION,
        )


def test_current_t10_is_pass_after_t15():
    assert CURRENT_T10_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.operational_owner_approved == "PASS"


def test_release_remains_no_go_without_explicit_activation():
    result = derive_current_release_readiness()
    assert result.technical_readiness == "PASS"
    assert result.product_readiness == "PASS"
    assert result.privacy_readiness == "PASS"
    assert result.operational_readiness == "PASS"
    assert result.explicit_activation_approval is False
    assert result.decision == "NO_GO"


def test_t15_evaluation_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)
    result = evaluate_operational_owner_resolution_payload(ALL_PASS)
    assert result.decision == "PASS"
    assert dict(os.environ) == before
