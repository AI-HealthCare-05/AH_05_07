import pytest

from app.core.config import parse_api_cors_origins


def test_parses_deduplicated_api_cors_origins() -> None:
    assert parse_api_cors_origins(" https://app.example.com,https://app.example.com, http://localhost:5173 ") == [
        "https://app.example.com",
        "http://localhost:5173",
    ]


def test_rejects_wildcard_api_cors_origin() -> None:
    with pytest.raises(ValueError, match="must not include"):
        parse_api_cors_origins("https://app.example.com,*")
