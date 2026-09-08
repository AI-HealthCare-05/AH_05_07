import os

import pytest

from app.services.model_v2_operational_readiness import (
    CONTRACT_VERSION as T10_CONTRACT_VERSION,
)
from app.services.model_v2_operational_readiness import (
    CURRENT_T10_EVALUATION,
)
from app.services.model_v2_privacy_readiness import (
    CONTRACT_VERSION as T9_CONTRACT_VERSION,
)
from app.services.model_v2_privacy_readiness import (
    CURRENT_T9_EVALUATION,
)
from app.services.model_v2_product_readiness import (
    CONTRACT_VERSION as T8_CONTRACT_VERSION,
)
from app.services.model_v2_product_readiness import (
    CURRENT_T8_EVALUATION,
)
from app.services.model_v2_release_readiness import (
    CONTRACT_VERSION,
    CURRENT_T11_EVALUATION,
    ReleaseReadinessContractError,
    derive_current_release_readiness,
    evaluate_release_readiness,
)


def evaluate(
    technical="PASS",
    product="PASS",
    privacy="PASS",
    operational="PASS",
    approval=True,
):
    return evaluate_release_readiness(
        technical_readiness=technical,
        product_readiness=product,
        privacy_readiness=privacy,
        operational_readiness=operational,
        explicit_activation_approval=approval,
    )


def test_contract_version_is_frozen():
    assert CONTRACT_VERSION == "model-v2-release-readiness-integration-v1"


def test_child_contract_versions_are_exposed_without_rewriting_children():
    result = evaluate()
    assert result.t8_contract_version == T8_CONTRACT_VERSION
    assert result.t9_contract_version == T9_CONTRACT_VERSION
    assert result.t10_contract_version == T10_CONTRACT_VERSION


def test_all_pass_and_explicit_approval_true_is_go_at_pure_contract_level():
    assert evaluate().decision == "GO"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("technical", "BLOCKED"),
        ("product", "BLOCKED"),
        ("privacy", "BLOCKED"),
        ("operational", "BLOCKED"),
    ],
)
def test_any_blocked_readiness_is_no_go(field: str, value: str):
    kwargs = {
        "technical": "PASS",
        "product": "PASS",
        "privacy": "PASS",
        "operational": "PASS",
        "approval": True,
    }
    kwargs[field] = value
    assert evaluate(**kwargs).decision == "NO_GO"


def test_explicit_approval_false_is_no_go_even_when_all_readiness_passes():
    assert evaluate(approval=False).decision == "NO_GO"


@pytest.mark.parametrize(
    "bad_value",
    ["NOT_REVIEWED", "READY", "GO", "", None, True, 1, [], {}],
)
def test_invalid_readiness_state_is_rejected(bad_value: object):
    with pytest.raises(ReleaseReadinessContractError):
        evaluate(product=bad_value)


@pytest.mark.parametrize("bad_value", ["true", "false", 1, 0, None, [], {}])
def test_non_boolean_activation_approval_is_rejected(bad_value: object):
    with pytest.raises(ReleaseReadinessContractError):
        evaluate(approval=bad_value)


def test_current_child_snapshots_derive_expected_release_go_after_t16():
    result = derive_current_release_readiness()

    assert CURRENT_T8_EVALUATION.decision == "PASS"
    assert CURRENT_T9_EVALUATION.decision == "PASS"
    assert CURRENT_T10_EVALUATION.decision == "PASS"

    assert result.technical_readiness == "PASS"
    assert result.product_readiness == "PASS"
    assert result.privacy_readiness == "PASS"
    assert result.operational_readiness == "PASS"
    assert result.explicit_activation_approval is True
    assert result.decision == "GO"


def test_current_constant_matches_derived_current_snapshot():
    assert CURRENT_T11_EVALUATION == derive_current_release_readiness()


def test_evaluation_is_deterministic():
    first = evaluate()
    second = evaluate()
    assert first == second


def test_decision_object_contains_no_sensitive_or_runtime_payload_fields():
    fields = set(evaluate().__dataclass_fields__)
    joined = " ".join(fields)

    for prohibited in (
        "score",
        "feature_payload",
        "blood",
        "pressure",
        "challenge",
        "user_id",
        "artifact_path",
        "request_body",
    ):
        assert prohibited not in joined


def test_integration_does_not_mutate_environment(monkeypatch):
    monkeypatch.setenv("MODEL_V2_SCORING_ENABLED", "false")
    before = dict(os.environ)

    result = derive_current_release_readiness()

    assert result.decision == "GO"
    assert dict(os.environ) == before
    assert os.environ["MODEL_V2_SCORING_ENABLED"] == "false"


def test_no_artifact_or_production_credentials_are_required(monkeypatch):
    monkeypatch.delenv("MODEL_V2_ARTIFACT_PATH", raising=False)
    monkeypatch.delenv("MODEL_V2_SCORING_ENABLED", raising=False)

    assert derive_current_release_readiness().decision == "GO"
