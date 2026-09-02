from unittest.mock import Mock

from fastapi import FastAPI

from app import main


def test_skips_legacy_mysql_when_disabled(monkeypatch) -> None:
    initialize_tortoise = Mock()
    monkeypatch.setattr(main.config, "ENABLE_LEGACY_MYSQL", False)
    monkeypatch.setattr(main, "initialize_tortoise", initialize_tortoise)

    main.initialize_persistence(FastAPI())

    initialize_tortoise.assert_not_called()


def test_initializes_legacy_mysql_when_enabled(monkeypatch) -> None:
    initialize_tortoise = Mock()
    application = FastAPI()
    monkeypatch.setattr(main.config, "ENABLE_LEGACY_MYSQL", True)
    monkeypatch.setattr(main, "initialize_tortoise", initialize_tortoise)

    main.initialize_persistence(application)

    initialize_tortoise.assert_called_once_with(application)
