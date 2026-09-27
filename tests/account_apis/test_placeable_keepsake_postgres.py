"""Opt-in isolated PostgreSQL integration; never points at a remote/project database.

Apply E2/E4 migrations first in a disposable network-none Supabase PostgreSQL
container. SK7_KEEPSAKE_TEST_CONTAINER enables this otherwise skipped local gate.
Hosted CI currently runs the API/static contracts, not this Docker fixture.
"""

import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

CONTAINER = os.environ.get("SK7_KEEPSAKE_TEST_CONTAINER")
pytestmark = pytest.mark.skipif(not CONTAINER, reason="isolated local PostgreSQL container required")


@pytest.fixture
def sql():
    details = json.loads(subprocess.check_output(["docker", "inspect", CONTAINER], text=True))[0]
    assert details["HostConfig"]["NetworkMode"] == "none"
    assert not details["HostConfig"].get("Binds")

    def run(statement, check=True):
        result = subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                CONTAINER,
                "psql",
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-Atq",
                "-v",
                "ON_ERROR_STOP=1",
            ],
            input=statement,
            text=True,
            capture_output=True,
            timeout=15,
        )
        if check:
            assert result.returncode == 0, result.stderr
        return result

    return run


def session(owner):
    return f"set role authenticated; set request.jwt.claim.sub = '{owner}';"


def save(revision=0, asset="quiet-moon-v1"):
    return f"""select public.save_my_placeable('{uuid4()}', {revision}, 'placeable.v2', 'e1-plaza.v2',
      '{{"pinwheel":null,"keepsake":"{asset}"}}');"""


def test_same_account_separate_connections_restore_and_owner_isolation(sql):
    owner, other = str(uuid4()), str(uuid4())
    sql(f"insert into auth.users(id) values ('{owner}'), ('{other}');")
    try:
        first = json.loads(sql(session(owner) + save()).stdout)
        restored = json.loads(sql(session(owner) + "select public.read_my_placeable();").stdout)
        assert first == restored
        isolated = json.loads(sql(session(other) + "select public.read_my_placeable();").stdout)
        assert isolated["revision"] == 0
        assert sql(session(other) + "select count(*) from public.placeable_snapshots;").stdout.strip() == "0"
    finally:
        sql(f"delete from auth.users where id in ('{owner}', '{other}');")


@pytest.mark.parametrize("delete_first", [True, False])
def test_v2_save_delete_race_never_resurrects_owner(sql, delete_first):
    owner = str(uuid4())
    sql(f"insert into auth.users(id) values ('{owner}');")
    first = f"delete from auth.users where id = '{owner}';" if delete_first else session(owner) + save()
    second = session(owner) + save() if delete_first else f"delete from auth.users where id = '{owner}';"
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            pending = pool.submit(
                sql, f"set application_name='sk7-e4-race'; begin; {first} select pg_sleep(2); commit;"
            )
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if (
                    sql(
                        "select count(*) from pg_stat_activity where application_name='sk7-e4-race' and wait_event='PgSleep';"
                    ).stdout.strip()
                    == "1"
                ):
                    break
                time.sleep(0.02)
            else:
                pytest.fail("first transaction did not reach locked checkpoint")
            after = pool.submit(sql, second, False)
            pending.result()
            result = after.result()
        if delete_first:
            assert result.returncode != 0 and "owner_deleted" in result.stderr
        else:
            assert result.returncode == 0
        assert sql(f"select count(*) from public.placeable_snapshots where user_id='{owner}';").stdout.strip() == "0"
        late = sql(session(owner) + save(), False)
        assert late.returncode != 0 and "owner_deleted" in late.stderr
    finally:
        sql(f"delete from auth.users where id='{owner}';")
