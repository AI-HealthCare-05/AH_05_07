#!/usr/bin/env python3
"""Convert the immutable SK7 Run10 archive to Learning Record v0.1.

Identifiers are opaque and deterministic.  Each identifier is the first 24
hexadecimal characters of SHA-256 over UTF-8 strings joined by a NUL byte.  The
first string is a domain separator (record, artifact, presentation, and so on),
and the remaining strings are immutable identities recorded by Run10: supplied
content hashes, supplied recipe hashes, or exact scene-instance positions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.contracts.common import load_json_unique
from app.core.contracts.learning_record import validate_learning_record

CONVERTER_VERSION = "run10-learning-record-v0.1.0"
SOURCE_RUN = "SK7_Visual_Factory_Run_20260919_10"
SOURCE_MANIFEST = "recipes/SOURCE_MANIFEST.json"
DECISION_LEDGER = "catalog/temporary-decisions-f10.json"
EVIDENCE_INDEX = "catalog/REVIEW_EVIDENCE_INDEX.json"
DERIVATIVE_REPORT = "reports/DERIVATIVE_DELTA_REPORT.json"
RICE_REPORT = "reports/RICE_COMPARISON.json"
RUN_SUMMARY = "reports/RUN_SUMMARY.json"


class ConversionError(ValueError):
    """Run10 cannot be converted faithfully."""


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _opaque_id(prefix: str, *parts: object) -> str:
    payload = "\0".join((prefix, *(str(part) for part in parts))).encode()
    return f"{prefix}-{_sha256_bytes(payload)[:24]}"


def _content_ref(source_ref: dict[str, Any], *, locator: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {}
    if source_ref.get("sha256") is not None:
        result["contentHash"] = {"algorithm": "sha-256", "value": source_ref["sha256"]}
    resolved_locator = locator if locator is not None else source_ref.get("path")
    if resolved_locator:
        result["locator"] = resolved_locator
    if not result:
        raise ConversionError("source reference has neither a supplied hash nor a locator")
    return result


class Run10Archive:
    """Read-only access to the single rooted Run10 ZIP."""

    def __init__(self, path: Path):
        self.path = path
        self.archive_sha256 = _sha256_file(path)
        self._zip = zipfile.ZipFile(path)
        file_names = [name for name in self._zip.namelist() if not name.endswith("/")]
        roots = {name.split("/", 1)[0] for name in file_names if "/" in name}
        if len(roots) != 1:
            raise ConversionError(f"expected one archive root, found {sorted(roots)}")
        self.root = roots.pop()
        if self.root != SOURCE_RUN:
            raise ConversionError(f"unexpected Run10 archive root: {self.root}")
        self._members = set(file_names)

    def close(self) -> None:
        self._zip.close()

    def __enter__(self) -> Run10Archive:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def _member(self, relative_path: str) -> str:
        member = f"{self.root}/{relative_path}"
        if member not in self._members:
            raise ConversionError(f"missing Run10 member: {relative_path}")
        return member

    def read(self, relative_path: str) -> bytes:
        return self._zip.read(self._member(relative_path))

    def json(self, relative_path: str) -> Any:
        return load_json_unique(self.read(relative_path))

    def paths(self, prefix: str, suffix: str = "") -> list[str]:
        rooted_prefix = f"{self.root}/{prefix}"
        return sorted(
            name.removeprefix(f"{self.root}/")
            for name in self._members
            if name.startswith(rooted_prefix) and name.endswith(suffix)
        )


def _source_version(source: dict[str, Any]) -> int:
    matches = re.findall(r"-v(\d+)(?:-|\.|$)", source["sourceId"])
    return int(matches[-1]) if matches else 1


def _episode_key(source: dict[str, Any]) -> str:
    source_id = source["sourceId"].removesuffix(".scene")
    return re.sub(r"-v\d+(?=-|$)", "-v#", source_id)


def _json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _candidate_view(recipe: dict[str, Any]) -> str:
    camera = _json_compact(recipe["camera"])
    return f"camera={camera};canvas={recipe['width']}x{recipe['height']}"


def _index_evidence(index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for candidate in index["items"]:
        for item in candidate["reviewEvidenceRefs"]:
            previous = result.get(item["path"])
            if previous and previous.get("sha256") != item.get("sha256"):
                raise ConversionError(f"conflicting evidence hashes for {item['path']}")
            result[item["path"]] = item
    return result


def _validate_archive_hashes(archive: Run10Archive, source_manifest: dict[str, Any]) -> None:
    for source in source_manifest["sources"]:
        actual = _sha256_bytes(archive.read(source["path"]))
        if actual != source["sha256"]:
            raise ConversionError(f"source hash mismatch for {source['path']}: {actual} != {source['sha256']}")


def _load_inputs(archive: Run10Archive) -> dict[str, Any]:
    values = {
        "source_manifest": archive.json(SOURCE_MANIFEST),
        "decision_ledger": archive.json(DECISION_LEDGER),
        "evidence_index": archive.json(EVIDENCE_INDEX),
        "derivative_report": archive.json(DERIVATIVE_REPORT),
        "rice_report": archive.json(RICE_REPORT),
        "run_summary": archive.json(RUN_SUMMARY),
    }
    values["candidate_recipes"] = {
        Path(path).stem: archive.json(path) for path in archive.paths("recipes/candidates/", ".json")
    }
    values["scenes"] = {path: archive.json(path) for path in archive.paths("source/scenes/", ".scene.json")}
    _validate_archive_hashes(archive, values["source_manifest"])
    for candidate in values["decision_ledger"]["items"]:
        recipe_ref = candidate["recipeRef"]
        if _sha256_bytes(archive.read(recipe_ref["path"])) != recipe_ref["sha256"]:
            raise ConversionError(f"candidate recipe hash mismatch: {recipe_ref['path']}")
    for candidate in values["evidence_index"]["items"]:
        for evidence_ref in candidate["reviewEvidenceRefs"]:
            if _sha256_bytes(archive.read(evidence_ref["path"])) != evidence_ref["sha256"]:
                raise ConversionError(f"review evidence hash mismatch: {evidence_ref['path']}")
    return values


def _group_sources(sources: list[dict[str, Any]]) -> tuple[dict[str, str], dict[str, int]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for source in sources:
        groups[_episode_key(source)].append(source)
    episode_ids: dict[str, str] = {}
    attempt_indexes: dict[str, int] = {}
    for group_sources in groups.values():
        ordered = sorted(group_sources, key=lambda item: (_source_version(item), item["sha256"]))
        root_hash = ordered[0]["sha256"]
        episode_id = _opaque_id("ep", SOURCE_RUN, root_hash)
        for attempt_index, source in enumerate(ordered, start=1):
            episode_ids[source["sourceId"]] = episode_id
            attempt_indexes[source["sourceId"]] = attempt_index
    return episode_ids, attempt_indexes


def _build_scene_inputs(source: dict[str, Any], scene: dict[str, Any]) -> tuple[list[dict], list[dict], list[dict]]:
    inputs: list[dict] = []
    relations: list[dict] = []
    mappings: list[dict] = []
    for index, instance in enumerate(scene["instances"]):
        source_ref = instance["sourceRef"]
        input_id = _opaque_id("in", source["sha256"], index, instance["id"], source_ref.get("sha256", ""))
        inputs.append({"inputId": input_id, "role": "scene-component", "ref": _content_ref(source_ref)})
        relations.append({"type": "composition-contains", "target": {"kind": "input", "id": input_id}})
        mappings.append({"inputId": input_id, "instanceId": instance["id"]})
    return inputs, relations, mappings


def _build_source_inputs(source: dict[str, Any]) -> list[dict]:
    inputs: list[dict] = []
    for index, source_ref in enumerate(source.get("sourceDependencies", [])):
        input_id = _opaque_id("in", source["sha256"], index, source_ref.get("sha256", source_ref["path"]))
        inputs.append({"inputId": input_id, "role": "parent-artifact", "ref": _content_ref(source_ref)})
    return inputs


def _legacy_derivative_ref(source: dict[str, Any]) -> dict[str, Any]:
    legacy_id = source["derivativeOf"][0]
    if source["path"].endswith(".scene.json"):
        return {"locator": f"legacy-asset-id:{legacy_id}"}
    dependencies = source.get("sourceDependencies", [])
    if not dependencies:
        return {"locator": f"legacy-asset-id:{legacy_id}"}
    return _content_ref(dependencies[0])


def _build_lineage(
    source: dict[str, Any],
    sources_by_path: dict[str, dict[str, Any]],
    ids_by_path: dict[str, dict[str, str]],
    composition_relations: list[dict],
) -> dict[str, Any]:
    relations = list(composition_relations)
    dependencies = source.get("sourceDependencies", [])
    prior_internal = next((dependency for dependency in dependencies if dependency["path"] in sources_by_path), None)
    if prior_internal and _source_version(source) > _source_version(sources_by_path[prior_internal["path"]]):
        prior_ids = ids_by_path[prior_internal["path"]]
        relations.append({"type": "repair-of", "target": {"kind": "learning-record", "id": prior_ids["recordId"]}})
    for reuse in source.get("geometryReuse", []):
        source_ref = reuse["sourceRef"]
        if source_ref["path"] in ids_by_path:
            target = {"kind": "artifact", "id": ids_by_path[source_ref["path"]]["artifactId"]}
        else:
            target = _content_ref(source_ref)
        relations.append({"type": "reuses-geometry-from", "target": target})
    if source.get("derivativeOf"):
        relations.append({"type": "derivative-of", "target": _legacy_derivative_ref(source)})
    return {"relations": relations}


def _evidence_for_candidates(
    candidates: list[dict[str, Any]], evidence_by_path: dict[str, dict[str, Any]], record_hash: str
) -> tuple[list[dict], dict[str, str]]:
    evidence: list[dict] = []
    ids_by_path: dict[str, str] = {}
    for path in sorted({path for candidate in candidates for path in candidate.get("reviewEvidence", [])}):
        indexed = evidence_by_path.get(path)
        if indexed is None:
            raise ConversionError(f"review evidence is not indexed: {path}")
        evidence_id = _opaque_id("ev", record_hash, indexed["sha256"], path)
        evidence.append({"evidenceId": evidence_id, "kind": "screenshot", "ref": _content_ref(indexed)})
        ids_by_path[path] = evidence_id
    return evidence, ids_by_path


def _candidate_entities(
    source: dict[str, Any],
    artifact_id: str,
    candidates: list[dict[str, Any]],
    recipes: dict[str, dict[str, Any]],
    evidence_ids: dict[str, str],
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    presentations: list[dict] = []
    evaluations: list[dict] = []
    decisions: list[dict] = []
    mappings: list[dict] = []
    for candidate in sorted(candidates, key=lambda item: item["id"]):
        recipe = recipes.get(candidate["id"])
        if recipe is None:
            raise ConversionError(f"candidate recipe missing: {candidate['id']}")
        if recipe["sourceRef"]["path"] != source["path"] or recipe["sourceSha256"] != source["sha256"]:
            raise ConversionError(f"candidate source mismatch: {candidate['id']}")
        recipe_hash = candidate["recipeRef"]["sha256"]
        presentation_id = _opaque_id("pres", source["sha256"], recipe_hash)
        decision_id = _opaque_id("dec", recipe_hash, candidate["reviewedAtUtc"])
        presentations.append(
            {"presentationId": presentation_id, "artifactId": artifact_id, "view": _candidate_view(recipe)}
        )
        evidence_refs = [{"kind": "evidence", "id": evidence_ids[path]} for path in candidate.get("reviewEvidence", [])]
        evaluation_base = {
            "subjectRef": {"kind": "presentation", "id": presentation_id},
            "evidenceRefs": evidence_refs or None,
        }
        evaluations.extend(_candidate_evaluations(candidate, recipe_hash, evaluation_base))
        decisions.append(_candidate_decision(candidate, presentation_id, decision_id))
        mappings.append({"candidateId": candidate["id"], "presentationId": presentation_id, "decisionId": decision_id})
    return presentations, evaluations, decisions, mappings


def _candidate_evaluations(candidate: dict[str, Any], recipe_hash: str, base: dict[str, Any]) -> list[dict]:
    source_gate = candidate["sourceGate"]
    pixel_gate = candidate["pixelGate"]
    evaluations = [
        {
            "evaluationId": _opaque_id("eval", recipe_hash, "static-source"),
            **base,
            "kind": "static-source",
            "verdict": "pass" if source_gate["status"] == "PASS_STATIC_SOURCE" else "fail",
            "authority": "automated",
            "notes": f"{source_gate['status']}; triangles={source_gate['triangles']}",
        },
        {
            "evaluationId": _opaque_id("eval", recipe_hash, "pixel-integrity"),
            **base,
            "kind": "pixel-integrity",
            "verdict": "pass" if pixel_gate["status"] == "PASS_PIXEL_GATE" else "fail",
            "authority": "automated",
            "notes": f"{pixel_gate['status']}; artApproval={str(pixel_gate['artApproval']).lower()}",
        },
        {
            "evaluationId": _opaque_id("eval", recipe_hash, "native-runtime"),
            **base,
            "kind": "native-runtime",
            "verdict": (
                "unknown"
                if source_gate.get("nativeEngineVerified") is None
                else "pass"
                if source_gate["nativeEngineVerified"]
                else "not-tested"
            ),
            "authority": "automated",
            "notes": "nativeEngineVerified=false is not a passing runtime test",
        },
        {
            "evaluationId": _opaque_id("eval", recipe_hash, "semantic-readability"),
            **base,
            "kind": "semantic-readability",
            "verdict": "pass" if candidate["retained"] else "fail",
            "authority": "assistant",
            "notes": candidate["critique"],
        },
    ]
    topology_gate = candidate.get("topologyGate")
    if topology_gate is not None:
        evaluations.append(
            {
                "evaluationId": _opaque_id("eval", recipe_hash, "topology"),
                **base,
                "kind": "topology",
                "verdict": "pass" if topology_gate["pass"] else "fail",
                "authority": "automated",
            }
        )
    return evaluations


def _candidate_decision(candidate: dict[str, Any], presentation_id: str, decision_id: str) -> dict[str, Any]:
    reviewed_at = candidate["reviewedAtUtc"]
    if "not human owner approval" not in candidate["reviewer"]:
        raise ConversionError(f"owner approval state is not explicit for {candidate['id']}")
    if candidate["productionActivation"] is not False:
        raise ConversionError(f"unexpected production activation for {candidate['id']}")
    return {
        "decisionId": decision_id,
        "subjectRef": {"kind": "presentation", "id": presentation_id},
        "disposition": "retain" if candidate["retained"] else "reject",
        "authority": "assistant",
        "observation": {"observedAt": reviewed_at, "source": f"{DECISION_LEDGER}#{candidate['id']}"},
        "ownerApproval": {"value": "pending", "observedAt": reviewed_at, "source": candidate["reviewer"]},
        "productionActivation": {"value": False, "observedAt": reviewed_at, "source": DECISION_LEDGER},
        "rationale": candidate["critique"],
    }


def _hand_trowel_comparison(record: dict[str, Any]) -> list[dict]:
    mappings = {item["candidateId"]: item for item in record["extensions"]["run10"]["candidateMappings"]}
    left = mappings["hand-trowel-a-v1-f10"]["presentationId"]
    right = mappings["hand-trowel-b-v1-f10"]["presentationId"]
    return [
        {
            "comparisonId": _opaque_id("cmp", left, right, "readability"),
            "leftSubjectRef": {"kind": "presentation", "id": left},
            "rightSubjectRef": {"kind": "presentation", "id": right},
            "dimensionResults": [
                {
                    "dimension": "semantic-readability",
                    "outcome": "prefer-right",
                    "finding": "Camera B reveals the shallow scoop concavity better than Camera A.",
                    "rationale": "Recorded assistant visual-review preference; the artifact itself is not globally rejected.",
                }
            ],
            "aggregateOutcome": "prefer-right",
        }
    ]


def _folded_cloth_comparison(record: dict[str, Any], prior_artifact_id: str) -> list[dict]:
    current_artifact_id = record["artifact"]["artifactId"]
    return [
        {
            "comparisonId": _opaque_id("cmp", prior_artifact_id, current_artifact_id, "cloth-v2"),
            "leftSubjectRef": {"kind": "artifact", "id": prior_artifact_id},
            "rightSubjectRef": {"kind": "artifact", "id": current_artifact_id},
            "dimensionResults": [
                {
                    "dimension": "performance-budget",
                    "outcome": "prefer-left",
                    "finding": "v2 increases geometry cost from 11,516 to 16,364 triangles.",
                },
                {
                    "dimension": "semantic-readability",
                    "outcome": "prefer-right",
                    "finding": "v2 is less rigid, but remains ambiguous as folded card or cloth.",
                },
            ],
            "aggregateOutcome": "different-tradeoff",
        }
    ]


def _rice_comparison(record: dict[str, Any], rice_report: dict[str, Any], version: int) -> list[dict]:
    original_ref = _content_ref(rice_report["originalSourceRef"])
    artifact_id = record["artifact"]["artifactId"]
    triangles = rice_report["triangles"]
    if version == 1:
        dimensions = [
            {
                "dimension": "performance-budget",
                "outcome": "prefer-left",
                "finding": f"Run06 parent has {triangles['original']:,} triangles; v1 has {triangles['v1']:,}.",
            },
            {
                "dimension": "small-slot-readability",
                "outcome": "prefer-left",
                "finding": "v1 loses rice specificity without a convincing 80px gain.",
            },
        ]
        aggregate = "prefer-left"
    else:
        dimensions = [
            {
                "dimension": "performance-budget",
                "outcome": "prefer-right",
                "finding": f"Run06 parent has {triangles['original']:,} triangles; v2 has {triangles['v2']:,}.",
            },
            {
                "dimension": "small-slot-readability",
                "outcome": "inconclusive",
                "finding": "The 80px view does not demonstrate a robust rice-specificity gain.",
            },
        ]
        aggregate = "different-tradeoff"
    return [
        {
            "comparisonId": _opaque_id("cmp", rice_report["originalSourceRef"]["sha256"], artifact_id),
            "leftSubjectRef": original_ref,
            "rightSubjectRef": {"kind": "artifact", "id": artifact_id},
            "dimensionResults": dimensions,
            "aggregateOutcome": aggregate,
        }
    ]


def _comparisons_for_record(
    record: dict[str, Any], source: dict[str, Any], ids_by_path: dict[str, dict[str, str]], rice_report: dict[str, Any]
) -> list[dict]:
    source_path = source["path"]
    if source_path == "source/hand-trowel-f10-v1.glb":
        return _hand_trowel_comparison(record)
    if source_path == "source/folded-cloth-f10-v2.glb":
        prior = ids_by_path["source/folded-cloth-f10-v1.glb"]["artifactId"]
        return _folded_cloth_comparison(record, prior)
    if source_path.startswith("source/rice-bowl-compact-f10-v"):
        return _rice_comparison(record, rice_report, _source_version(source))
    return []


def _record_limitations(candidates: list[dict[str, Any]]) -> list[dict[str, str]]:
    descriptions = sorted({item for candidate in candidates for item in candidate.get("unsupportedConditions", [])})
    return [
        {"scope": "recorded-review-boundary", "description": description, "reason": "Run10 source limitation"}
        for description in descriptions
    ]


def _build_record(
    source: dict[str, Any],
    candidates: list[dict[str, Any]],
    scene: dict[str, Any] | None,
    inputs: dict[str, Any],
    episode_ids: dict[str, str],
    attempt_indexes: dict[str, int],
    sources_by_path: dict[str, dict[str, Any]],
    ids_by_path: dict[str, dict[str, str]],
) -> dict[str, Any]:
    ids = ids_by_path[source["path"]]
    evidence_by_path = _index_evidence(inputs["evidence_index"])
    evidence, evidence_ids = _evidence_for_candidates(candidates, evidence_by_path, source["sha256"])
    presentations, evaluations, decisions, candidate_mappings = _candidate_entities(
        source, ids["artifactId"], candidates, inputs["candidate_recipes"], evidence_ids
    )
    scene_mappings: list[dict] = []
    composition_relations: list[dict] = []
    if scene is not None:
        record_inputs, composition_relations, scene_mappings = _build_scene_inputs(source, scene)
    else:
        record_inputs = _build_source_inputs(source)
    record: dict[str, Any] = {
        "schema": "sk7.learning-record",
        "schemaVersion": "0.1",
        "recordId": ids["recordId"],
        "episodeId": episode_ids[source["sourceId"]],
        "attemptIndex": attempt_indexes[source["sourceId"]],
        "recordState": "complete",
        "request": {
            "originalTextStatus": "not-recorded",
            "goal": {"text": source["changeIntent"], "basis": "recorded-source-metadata"},
        },
        "inputs": record_inputs,
        "build": {
            "operationId": _opaque_id("op", source["sha256"], "recorded-change-intent"),
            "type": "compose" if scene is not None else "author-geometry",
            "target": source["sourceId"],
            "intent": source["changeIntent"],
            "basis": "recorded-source-metadata",
        },
        "artifact": {
            "artifactId": ids["artifactId"],
            "kind": "composition" if scene is not None else "mesh",
            "ref": _content_ref(source),
        },
        "presentations": presentations,
        "evidence": evidence,
        "evaluations": evaluations,
        "decisions": decisions,
        "comparisons": [],
        "lineage": _build_lineage(source, sources_by_path, ids_by_path, composition_relations),
        "limitations": _record_limitations(candidates),
        "provenance": {
            "origin": "legacy-visual-factory",
            "sourceRun": source["sourceRun"],
            "migrationVersion": CONVERTER_VERSION,
        },
        "extensions": {
            "run10": {
                "sourceId": source["sourceId"],
                "sourcePath": source["path"],
                "sourceStatus": source["status"],
                "sourceProductionActivation": source["productionActivation"],
                "candidateMappings": candidate_mappings,
                "sceneInputInstances": scene_mappings,
            }
        },
    }
    record["comparisons"] = _comparisons_for_record(record, source, ids_by_path, inputs["rice_report"])
    return record


def convert_run10(archive_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any], str]:
    """Convert Run10 in memory and validate both records and corpus references."""
    with Run10Archive(archive_path) as archive:
        inputs = _load_inputs(archive)
        sources = inputs["source_manifest"]["sources"]
        sources_by_path = {source["path"]: source for source in sources}
        ids_by_path = {
            source["path"]: {
                "recordId": _opaque_id("lr", source["sha256"]),
                "artifactId": _opaque_id("art", source["sha256"]),
            }
            for source in sources
        }
        episode_ids, attempt_indexes = _group_sources(sources)
        candidates_by_path: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for candidate in inputs["decision_ledger"]["items"]:
            candidates_by_path[candidate["sourceRef"]["path"]].append(candidate)
        records = [
            _build_record(
                source,
                candidates_by_path[source["path"]],
                inputs["scenes"].get(source["path"]),
                inputs,
                episode_ids,
                attempt_indexes,
                sources_by_path,
                ids_by_path,
            )
            for source in sorted(sources, key=lambda item: item["path"])
        ]
        for record in records:
            validate_learning_record(record)
        validation = validate_run10_corpus(records, inputs)
        return records, validation, archive.archive_sha256


def _entity_index(records: list[dict[str, Any]]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = defaultdict(set)
    for record in records:
        index["learning-record"].add(record["recordId"])
        index["artifact"].add(record["artifact"]["artifactId"])
        for field, kind, id_key in (
            ("inputs", "input", "inputId"),
            ("presentations", "presentation", "presentationId"),
            ("evidence", "evidence", "evidenceId"),
            ("evaluations", "evaluation", "evaluationId"),
            ("decisions", "decision", "decisionId"),
            ("comparisons", "comparison", "comparisonId"),
        ):
            index[kind].update(item[id_key] for item in record.get(field, []))
    return index


def _internal_references(record: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for item in record.get("evaluations", []):
        refs.append(item["subjectRef"])
        refs.extend(item.get("evidenceRefs") or [])
    refs.extend(item["subjectRef"] for item in record.get("decisions", []))
    for comparison in record.get("comparisons", []):
        for key in ("leftSubjectRef", "rightSubjectRef"):
            ref = comparison[key]
            if ref.get("kind") is not None:
                refs.append(ref)
    for relation in record.get("lineage", {}).get("relations") or []:
        if relation["target"].get("kind") is not None:
            refs.append(relation["target"])
    return refs


def _validate_references(records: list[dict[str, Any]]) -> dict[str, Any]:
    entity_index = _entity_index(records)
    checked = 0
    unresolved: list[dict[str, str]] = []
    for record in records:
        for ref in _internal_references(record):
            checked += 1
            if ref["id"] not in entity_index.get(ref["kind"], set()):
                unresolved.append(ref)
    return {"valid": not unresolved, "internalReferencesChecked": checked, "unresolved": unresolved}


def _validate_repairs(records: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {record["recordId"]: record for record in records}
    edges: dict[str, str] = {}
    for record in records:
        for relation in record["lineage"]["relations"]:
            target = relation["target"]
            if relation["type"] != "repair-of":
                continue
            if target["kind"] != "learning-record" or target["id"] not in by_id:
                raise ConversionError(f"invalid repair target from {record['recordId']}")
            prior = by_id[target["id"]]
            if record["episodeId"] != prior["episodeId"] or record["attemptIndex"] <= prior["attemptIndex"]:
                raise ConversionError(f"invalid repair direction from {record['recordId']}")
            edges[record["recordId"]] = target["id"]
    for start in edges:
        seen: set[str] = set()
        current = start
        while current in edges:
            if current in seen:
                raise ConversionError(f"Run10 repair cycle at {current}")
            seen.add(current)
            current = edges[current]
    return {"valid": True, "repairRelations": len(edges), "cycles": 0}


def _validate_compositions(records: list[dict[str, Any]], scenes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    checked = 0
    for record in records:
        path = record["extensions"]["run10"]["sourcePath"]
        if path not in scenes:
            continue
        scene = scenes[path]
        mappings = record["extensions"]["run10"]["sceneInputInstances"]
        inputs_by_id = {item["inputId"]: item for item in record["inputs"]}
        relation_targets = {
            relation["target"]["id"]
            for relation in record["lineage"]["relations"]
            if relation["type"] == "composition-contains"
        }
        if len(mappings) != len(scene["instances"]) or set(inputs_by_id) != relation_targets:
            raise ConversionError(f"composition input cardinality mismatch: {path}")
        for mapping, instance in zip(mappings, scene["instances"], strict=True):
            item = inputs_by_id[mapping["inputId"]]
            expected_ref = _content_ref(instance["sourceRef"])
            if (
                mapping["instanceId"] != instance["id"]
                or item["role"] != "scene-component"
                or item["ref"] != expected_ref
            ):
                raise ConversionError(f"composition instance mismatch: {path}#{instance['id']}")
            checked += 1
    return {"valid": True, "sceneComponentInputsChecked": checked}


def _source_facts(inputs: dict[str, Any]) -> dict[str, int]:
    sources = inputs["source_manifest"]["sources"]
    decisions = inputs["decision_ledger"]["items"]
    return {
        "meshSourceVersions": sum(source["path"].endswith(".glb") for source in sources),
        "compositionSceneSources": sum(source["path"].endswith(".scene.json") for source in sources),
        "records": len(sources),
        "presentations": len(inputs["candidate_recipes"]),
        "retain": sum(candidate["retained"] is True for candidate in decisions),
        "reject": sum(candidate["retained"] is False for candidate in decisions),
        "pending": sum(candidate["retained"] is None for candidate in decisions),
    }


def _converted_facts(records: list[dict[str, Any]]) -> dict[str, int]:
    decisions = [decision for record in records for decision in record.get("decisions", [])]
    return {
        "records": len(records),
        "presentations": sum(len(record.get("presentations", [])) for record in records),
        "retain": sum(decision["disposition"] == "retain" for decision in decisions),
        "reject": sum(decision["disposition"] == "reject" for decision in decisions),
        "pending": sum(decision["disposition"] == "pending" for decision in decisions),
    }


def _validate_candidate_mapping(records: list[dict[str, Any]], inputs: dict[str, Any]) -> dict[str, Any]:
    mappings = [mapping for record in records for mapping in record["extensions"]["run10"]["candidateMappings"]]
    source_candidates = {item["id"]: item for item in inputs["decision_ledger"]["items"]}
    source_ids = list(source_candidates)
    mapped_ids = [item["candidateId"] for item in mappings]
    if Counter(source_ids) != Counter(mapped_ids) or any(count != 1 for count in Counter(mapped_ids).values()):
        raise ConversionError("candidate mappings are not exactly one-to-one")
    presentation_ids = {item["presentationId"] for record in records for item in record["presentations"]}
    decision_ids = {item["decisionId"] for record in records for item in record["decisions"]}
    if {item["presentationId"] for item in mappings} != presentation_ids:
        raise ConversionError("a presentation is missing its candidate mapping")
    if {item["decisionId"] for item in mappings} != decision_ids:
        raise ConversionError("a decision is missing its candidate mapping")
    decision_targets = Counter(item["subjectRef"]["id"] for record in records for item in record["decisions"])
    if set(decision_targets) != presentation_ids or any(count != 1 for count in decision_targets.values()):
        raise ConversionError("every presentation must have exactly one decision")
    decisions_by_id = {item["decisionId"]: item for record in records for item in record["decisions"]}
    for mapping in mappings:
        expected = "retain" if source_candidates[mapping["candidateId"]]["retained"] else "reject"
        if decisions_by_id[mapping["decisionId"]]["disposition"] != expected:
            raise ConversionError(f"candidate disposition changed: {mapping['candidateId']}")
    return {"valid": True, "sourceCandidates": len(source_ids), "mappedExactlyOnce": len(mapped_ids)}


def _validate_episode_grouping(records: list[dict[str, Any]], sources: list[dict[str, Any]]) -> dict[str, Any]:
    records_by_source = {record["extensions"]["run10"]["sourceId"]: record for record in records}
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for source in sources:
        groups[_episode_key(source)].append(source)
    for sources_in_group in groups.values():
        ordered = sorted(sources_in_group, key=lambda item: (_source_version(item), item["sha256"]))
        episode_ids = {records_by_source[source["sourceId"]]["episodeId"] for source in ordered}
        attempts = [records_by_source[source["sourceId"]]["attemptIndex"] for source in ordered]
        if len(episode_ids) != 1 or attempts != list(range(1, len(ordered) + 1)):
            raise ConversionError(f"invalid episode grouping for {[item['sourceId'] for item in ordered]}")
    return {"valid": True, "episodes": len(groups), "episodeAttempts": len(records)}


def _validate_source_preservation(records: list[dict[str, Any]], inputs: dict[str, Any]) -> dict[str, Any]:
    sources = inputs["source_manifest"]["sources"]
    records_by_path = {record["extensions"]["run10"]["sourcePath"]: record for record in records}
    source_paths = {source["path"] for source in sources}
    if set(records_by_path) != source_paths:
        raise ConversionError("source versions do not map exactly once to records")
    for source in sources:
        record = records_by_path[source["path"]]
        if record["artifact"]["ref"] != _content_ref(source):
            raise ConversionError(f"artifact source hash or locator changed: {source['path']}")
    recipe_ids = set(inputs["candidate_recipes"])
    decision_ids = {candidate["id"] for candidate in inputs["decision_ledger"]["items"]}
    if recipe_ids != decision_ids:
        raise ConversionError("candidate recipes and decision ledger IDs differ")
    indexed_evidence = _index_evidence(inputs["evidence_index"])
    for record in records:
        for evidence in record["evidence"]:
            locator = evidence["ref"]["locator"]
            if locator not in indexed_evidence or evidence["ref"] != _content_ref(indexed_evidence[locator]):
                raise ConversionError(f"evidence hash or locator changed: {locator}")
    return {
        "valid": True,
        "sourceVersionsMappedExactlyOnce": len(source_paths),
        "sourceArtifactHashesPreserved": len(source_paths),
        "candidateRecipesMatched": len(recipe_ids),
    }


def _validate_external_comparisons(records: list[dict[str, Any]]) -> dict[str, Any]:
    checked = 0
    for record in records:
        for comparison in record["comparisons"]:
            for key in ("leftSubjectRef", "rightSubjectRef"):
                ref = comparison[key]
                if ref.get("kind") is not None:
                    continue
                if ref.get("contentHash") is None and ref.get("locator") is None:
                    raise ConversionError(f"invalid external comparison reference in {comparison['comparisonId']}")
                checked += 1
    return {"valid": True, "externalComparisonReferences": checked}


def _validate_derivative_evidence(records: list[dict[str, Any]], inputs: dict[str, Any]) -> dict[str, Any]:
    report = inputs["derivative_report"]
    records_by_path = {record["extensions"]["run10"]["sourcePath"]: record for record in records}
    checked_reuse = 0
    derivative_cases = [report["tray"], *report["rejectedRiceComparisons"]]
    for case in derivative_cases:
        record = records_by_path[case["childSourceRef"]["path"]]
        expected = _content_ref(case["parentSourceRef"])
        reuse_targets = [
            relation["target"]
            for relation in record["lineage"]["relations"]
            if relation["type"] == "reuses-geometry-from"
        ]
        if expected not in reuse_targets:
            raise ConversionError(f"derivative reuse evidence was not preserved: {case['childSourceRef']['path']}")
        checked_reuse += 1
    checked_scene_dependencies = 0
    for scene_id, dependencies in report["sceneDependencies"].items():
        scene_path = f"source/scenes/{scene_id}.scene.json"
        recorded_refs = [instance["sourceRef"] for instance in inputs["scenes"][scene_path]["instances"]]
        if [(item["path"], item["sha256"]) for item in dependencies] != [
            (item["path"], item["sha256"]) for item in recorded_refs
        ]:
            raise ConversionError(f"derivative scene dependencies differ: {scene_id}")
        checked_scene_dependencies += len(dependencies)
    return {
        "valid": True,
        "geometryReuseCasesChecked": checked_reuse,
        "sceneDependenciesChecked": checked_scene_dependencies,
        "oldSceneGeometryNotFlattened": report["oldSceneGeometryNotFlattened"],
    }


def _validate_run_summary(source: dict[str, int], summary: dict[str, Any]) -> dict[str, Any]:
    summary_facts = {
        "meshSourceVersions": summary["sourceVersions"],
        "compositionSceneSources": summary["newSceneRecipes"],
        "presentations": summary["temporaryCandidates"],
        "retain": len(summary["currentRunRetainedIds"]),
        "reject": summary["rejectedCandidates"],
        "pending": summary["pendingCandidates"],
    }
    if any(source[key] != value for key, value in summary_facts.items()):
        raise ConversionError(f"independently discovered source facts disagree with RUN_SUMMARY: {summary_facts}")
    return {"valid": True, "productionActivation": summary["productionActivation"], **summary_facts}


def validate_run10_corpus(records: list[dict[str, Any]], inputs: dict[str, Any]) -> dict[str, Any]:
    """Validate Run10-only corpus invariants without duplicating record semantics."""
    source = _source_facts(inputs)
    converted = _converted_facts(records)
    required = {"records": 10, "presentations": 14, "retain": 5, "reject": 9, "pending": 0}
    if source["records"] != source["meshSourceVersions"] + source["compositionSceneSources"]:
        raise ConversionError("source record count is not independently explained by mesh and scene sources")
    if {key: source[key] for key in required} != required:
        raise ConversionError(f"Run10 source facts do not match the frozen mapping: {source}")
    if converted != required or converted != {key: source[key] for key in required}:
        raise ConversionError(f"converted facts do not preserve source facts: {converted} != {source}")
    record_ids = [record["recordId"] for record in records]
    artifact_ids = [record["artifact"]["artifactId"] for record in records]
    episode_attempts = [(record["episodeId"], record["attemptIndex"]) for record in records]
    if len(set(record_ids)) != len(record_ids) or len(set(artifact_ids)) != len(artifact_ids):
        raise ConversionError("record or artifact IDs are not unique")
    if len(set(episode_attempts)) != len(episode_attempts):
        raise ConversionError("duplicate episode-local attemptIndex")
    reference_validation = _validate_references(records)
    if not reference_validation["valid"]:
        raise ConversionError(f"unresolved internal references: {reference_validation['unresolved']}")
    return {
        "valid": True,
        "sourceFacts": source,
        "convertedFacts": converted,
        "contractValidatedRecords": len(records),
        "uniqueRecordIds": len(set(record_ids)),
        "uniqueArtifactIds": len(set(artifact_ids)),
        "uniqueEpisodeAttempts": len(set(episode_attempts)),
        "episodes": _validate_episode_grouping(records, inputs["source_manifest"]["sources"]),
        "sourcePreservation": _validate_source_preservation(records, inputs),
        "candidateMapping": _validate_candidate_mapping(records, inputs),
        "references": reference_validation,
        "externalComparisons": _validate_external_comparisons(records),
        "repairs": _validate_repairs(records),
        "compositions": _validate_compositions(records, inputs["scenes"]),
        "derivativeEvidence": _validate_derivative_evidence(records, inputs),
        "runSummaryCrossCheck": _validate_run_summary(source, inputs["run_summary"]),
        "contractBlockers": [],
    }


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _output_manifest(records: list[dict[str, Any]], archive_path: Path, archive_sha256: str) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "converterVersion": CONVERTER_VERSION,
        "sourceArchive": {"filename": archive_path.name, "sha256": archive_sha256},
        "idDerivation": {
            "algorithm": "sha-256",
            "encoding": "utf-8 strings joined by NUL",
            "rendering": "entity prefix plus first 24 lowercase hex characters",
            "inputs": "domain separator plus immutable source/recipe/evidence/scene-instance identities",
        },
        "records": [
            {
                "recordId": record["recordId"],
                "artifactId": record["artifact"]["artifactId"],
                "sourcePath": record["extensions"]["run10"]["sourcePath"],
                "filename": f"{record['recordId']}.json",
            }
            for record in records
        ],
    }


def _readme() -> str:
    return """# SK7 Stage 4 Run10 conversion evidence

This directory was generated deterministically from the unchanged Run10 ZIP.
`records/` contains one Learning Record v0.1 JSON file per immutable Run10
source/build version. The conversion and reference reports contain no wall-clock
execution metadata.

Identifiers use SHA-256 domain separation. The converter hashes UTF-8 strings
joined by a NUL byte, then renders the entity prefix and the first 24 lowercase
hex characters. Inputs are immutable source hashes, recipe hashes, evidence
hashes, and exact scene-instance positions recorded in the source corpus.

The original GLB and PNG binaries are not copied here. Their source-supplied
SHA-256 values and archive-relative locators remain in the records.
"""


def write_evidence(
    records: list[dict[str, Any]],
    validation: dict[str, Any],
    archive_path: Path,
    archive_sha256: str,
    output_dir: Path,
) -> None:
    output_parent = output_dir.parent
    output_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f".{output_dir.name}.", dir=output_parent) as temporary:
        staging = Path(temporary) / output_dir.name
        records_dir = staging / "records"
        records_dir.mkdir(parents=True)
        for record in records:
            _write_json(records_dir / f"{record['recordId']}.json", record)
        report = {
            "schemaVersion": 1,
            "converterVersion": CONVERTER_VERSION,
            "sourceArchiveSha256": archive_sha256,
            **validation,
        }
        _write_json(staging / "RUN10_CONVERSION_REPORT.json", report)
        _write_json(staging / "RUN10_REFERENCE_VALIDATION.json", validation["references"])
        _write_json(staging / "RUN10_CONVERSION_MANIFEST.json", _output_manifest(records, archive_path, archive_sha256))
        (staging / "README.md").write_text(_readme(), encoding="utf-8")
        if output_dir.exists():
            shutil.rmtree(output_dir)
        shutil.copytree(staging, output_dir)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_zip", type=Path, help="immutable Run10 DELTA ZIP")
    parser.add_argument("output_dir", type=Path, help="directory for records and validation reports")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    before = _sha256_file(args.source_zip)
    records, validation, archive_sha256 = convert_run10(args.source_zip)
    write_evidence(records, validation, args.source_zip, archive_sha256, args.output_dir)
    after = _sha256_file(args.source_zip)
    if before != after:
        raise ConversionError(f"source archive changed during conversion: {before} != {after}")
    facts = validation["convertedFacts"]
    print(
        f"converted records={facts['records']} presentations={facts['presentations']} "
        f"retain={facts['retain']} reject={facts['reject']} pending={facts['pending']} sha256={after}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
