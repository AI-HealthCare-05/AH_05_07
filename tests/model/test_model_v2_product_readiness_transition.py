import os
from dataclasses import replace

import pytest

from app.services.model_v2_operational_readiness import CURRENT_T10_EVALUATION
from app.services.model_v2_privacy_readiness import CURRENT_T9_EVALUATION
from app.services.model_v2_product_policy_resolution import (
    CONTRACT_VERSION as T12_CONTRACT_VERSION,
)
from app.services.model_v2_product_policy_resolution import (
    CURRENT_T12_EVALUATION,
)
from app.services.model_v2_product_readiness import (
    CONTRACT_VERSION,
    CURRENT_T8_EVALUATION,
    CURRENT_T8_READINESS,
    PRE_T13_T8_EVALUATION,
    PRE_T13_T8_READINESS,
    T13_TRANSITION_VERSION,
    ProductReadinessTransitionError,
    transition_product_readiness_after_t12,
)
from app.services.model_v2_release_readiness import (
    CURRENT_T11_EVALUATION,
    derive_current_release_readiness,
)


def test_versions_are_frozen():
    assert CONTRACT_VERSION == "model-v2-product-readiness-v1"
    assert T13_TRANSITION_VERSION == "model-v2-product-readiness-t13-transition-v1"
    assert T12_CONTRACT_VERSION == "model-v2-product-policy-resolution-v1"


def test_t12_current_resolution_is_pass():
    assert CURRENT_T12_EVALUATION.decision == "PASS"


def test_pre_t13_snapshot_records_exact_two_blockers():
    assert PRE_T13_T8_EVALUATION.decision == "BLOCKED"
    assert PRE_T13_T8_READINESS.product_term_approved == "PASS"
    assert PRE_T13_T8_READINESS.result_visibility_approved == "PASS"
    assert PRE_T13_T8_READINESS.age_applicability_approved == "BLOCKED"
    assert PRE_T13_T8_READINESS.missing_policy_approved == "PASS"
    assert PRE_T13_T8_READINESS.research_product_applicability_approved == "BLOCKED"
    assert PRE_T13_T8_READINESS.data_separation_approved == "PASS"


def test_transition_changes_exactly_two_dimensions():
    before = PRE_T13_T8_READINESS.__dict__
    after = CURRENT_T8_READINESS.__dict__

    changed = {name for name in before if before[name] != after[name]}

    assert changed == {
        "age_applicability_approved",
        "research_product_applicability_approved",
    }
    assert CURRENT_T8_READINESS.age_applicability_approved == "PASS"
    assert CURRENT_T8_READINESS.research_product_applicability_approved == "PASS"


def test_current_t8_readiness_is_pass_after_t13():
    assert all(value == "PASS" for value in CURRENT_T8_READINESS.__dict__.values())
    assert CURRENT_T8_EVALUATION.decision == "PASS"


def test_transition_fails_closed_when_t12_is_not_pass():
    blocked_t12 = replace(CURRENT_T12_EVALUATION, decision="BLOCKED")

    with pytest.raises(ProductReadinessTransitionError):
        transition_product_readiness_after_t12(
            previous=PRE_T13_T8_READINESS,
            t12_evaluation=blocked_t12,
        )


def test_transition_fails_closed_on_t12_contract_version_mismatch():
    wrong_version = replace(
        CURRENT_T12_EVALUATION,
        contract_version="unexpected-version",
    )

    with pytest.raises(ProductReadinessTransitionError):
        transition_product_readiness_after_t12(
            previous=PRE_T13_T8_READINESS,
            t12_evaluation=wrong_version,
        )


def test_transition_fails_closed_on_unreviewed_previous_snapshot():
    changed_previous = replace(
        PRE_T13_T8_READINESS,
        data_separation_approved="BLOCKED",
    )

    with pytest.raises(ProductReadinessTransitionError):
        transition_product_readiness_after_t12(
            previous=changed_previous,
            t12_evaluation=CURRENT_T12_EVALUATION,
        )


def test_transition_is_deterministic():
    first = transition_product_readiness_after_t12(
        previous=PRE_T13_T8_READINESS,
        t12_evaluation=CURRENT_T12_EVALUATION,
    )
    second = transition_product_readiness_after_t12(
        previous=PRE_T13_T8_READINESS,
        t12_evaluation=CURRENT_T12_EVALUATION,
    )
    assert first == second == CURRENT_T8_READINESS


def test_t9_and_t10_are_pass_after_t15():
    assert CURRENT_T9_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.decision == "PASS"


def test_t11_rederived_snapshot_reads_product_pass_but_remains_no_go():
    result = derive_current_release_readiness()

    assert result.technical_readiness == "PASS"
    assert result.product_readiness == "PASS"
    assert result.privacy_readiness == "PASS"
    assert result.operational_readiness == "PASS"
    assert result.explicit_activation_approval is False
    assert result.decision == "NO_GO"


def test_imported_t11_current_snapshot_is_no_go():
    assert CURRENT_T11_EVALUATION.product_readiness == "PASS"
    assert CURRENT_T11_EVALUATION.privacy_readiness == "PASS"
    assert CURRENT_T11_EVALUATION.operational_readiness == "PASS"
    assert CURRENT_T11_EVALUATION.explicit_activation_approval is False
    assert CURRENT_T11_EVALUATION.decision == "NO_GO"


def test_transition_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = transition_product_readiness_after_t12(
        previous=PRE_T13_T8_READINESS,
        t12_evaluation=CURRENT_T12_EVALUATION,
    )

    assert result == CURRENT_T8_READINESS
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_or_production_credentials_are_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    assert CURRENT_T8_EVALUATION.decision == "PASS"
    assert derive_current_release_readiness().decision == "NO_GO"
