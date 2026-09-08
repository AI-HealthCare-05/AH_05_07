import os
from dataclasses import replace

import pytest

from app.services.model_v2_activation_approval_resolution import (
    CONTRACT_VERSION,
    CURRENT_T16_EVALUATION,
    REQUIRED_DIMENSIONS,
    ActivationApprovalResolutionContractError,
    evaluate_activation_approval_resolution_payload,
)
from app.services.model_v2_release_readiness import (
    CURRENT_T11_EVALUATION,
    PRE_T16_T11_EVALUATION,
    ReleaseReadinessTransitionError,
    derive_current_release_readiness,
    transition_release_readiness_after_t16,
)

ALL_PASS = {name: "PASS" for name in REQUIRED_DIMENSIONS}


def test_t16_contract_version_is_frozen():
    assert CONTRACT_VERSION == "model-v2-explicit-activation-approval-v1"


def test_t16_required_dimensions_are_exact():
    assert REQUIRED_DIMENSIONS == (
        "all_readiness_pass_confirmed",
        "operator_explicit_activation_approval_recorded",
        "production_enablement_separate_step_acknowledged",
        "rollback_kill_switch_authority_acknowledged",
        "real_user_collection_separate_step_acknowledged",
    )


def test_all_t16_dimensions_pass_means_pass():
    assert evaluate_activation_approval_resolution_payload(ALL_PASS).decision == "PASS"


@pytest.mark.parametrize("field", REQUIRED_DIMENSIONS)
@pytest.mark.parametrize("state", ["BLOCKED", "NOT_REVIEWED"])
def test_any_non_pass_t16_dimension_blocks(field: str, state: str):
    payload = {**ALL_PASS, field: state}
    assert evaluate_activation_approval_resolution_payload(payload).decision == "BLOCKED"


@pytest.mark.parametrize("field", REQUIRED_DIMENSIONS)
@pytest.mark.parametrize("value", ["READY", "GO", "", None, True, 1, [], {}])
def test_unknown_or_non_string_t16_state_is_rejected(field: str, value: object):
    with pytest.raises(ActivationApprovalResolutionContractError):
        evaluate_activation_approval_resolution_payload({**ALL_PASS, field: value})


def test_missing_and_extra_t16_fields_are_rejected():
    with pytest.raises(ActivationApprovalResolutionContractError):
        evaluate_activation_approval_resolution_payload({})
    with pytest.raises(ActivationApprovalResolutionContractError):
        evaluate_activation_approval_resolution_payload({**ALL_PASS, "unexpected": "PASS"})


def test_pre_t16_t11_snapshot_is_preserved_as_no_go():
    assert PRE_T16_T11_EVALUATION.technical_readiness == "PASS"
    assert PRE_T16_T11_EVALUATION.product_readiness == "PASS"
    assert PRE_T16_T11_EVALUATION.privacy_readiness == "PASS"
    assert PRE_T16_T11_EVALUATION.operational_readiness == "PASS"
    assert PRE_T16_T11_EVALUATION.explicit_activation_approval is False
    assert PRE_T16_T11_EVALUATION.decision == "NO_GO"


def test_t16_transition_changes_only_explicit_activation_approval():
    result = transition_release_readiness_after_t16(
        previous=PRE_T16_T11_EVALUATION,
        t16_evaluation=CURRENT_T16_EVALUATION,
    )

    assert result.technical_readiness == PRE_T16_T11_EVALUATION.technical_readiness
    assert result.product_readiness == PRE_T16_T11_EVALUATION.product_readiness
    assert result.privacy_readiness == PRE_T16_T11_EVALUATION.privacy_readiness
    assert result.operational_readiness == PRE_T16_T11_EVALUATION.operational_readiness
    assert PRE_T16_T11_EVALUATION.explicit_activation_approval is False
    assert result.explicit_activation_approval is True
    assert result.decision == "GO"


def test_t16_transition_rejects_wrong_contract_version():
    wrong = replace(CURRENT_T16_EVALUATION, contract_version="wrong")
    with pytest.raises(ReleaseReadinessTransitionError):
        transition_release_readiness_after_t16(
            previous=PRE_T16_T11_EVALUATION,
            t16_evaluation=wrong,
        )


def test_t16_transition_rejects_blocked_resolution():
    blocked = replace(CURRENT_T16_EVALUATION, decision="BLOCKED")
    with pytest.raises(ReleaseReadinessTransitionError):
        transition_release_readiness_after_t16(
            previous=PRE_T16_T11_EVALUATION,
            t16_evaluation=blocked,
        )


def test_t16_transition_rejects_changed_pretransition_snapshot():
    changed = replace(PRE_T16_T11_EVALUATION, privacy_readiness="BLOCKED")
    with pytest.raises(ReleaseReadinessTransitionError):
        transition_release_readiness_after_t16(
            previous=changed,
            t16_evaluation=CURRENT_T16_EVALUATION,
        )


def test_current_release_is_go_after_t16():
    result = derive_current_release_readiness()
    assert result.technical_readiness == "PASS"
    assert result.product_readiness == "PASS"
    assert result.privacy_readiness == "PASS"
    assert result.operational_readiness == "PASS"
    assert result.explicit_activation_approval is True
    assert result.decision == "GO"
    assert CURRENT_T11_EVALUATION == result


def test_t16_does_not_enable_runtime(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = derive_current_release_readiness()

    assert result.decision == "GO"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"
