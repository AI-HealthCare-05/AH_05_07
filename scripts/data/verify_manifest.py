import json
from pathlib import Path

manifest_path = Path("data/manifest/nhanes_2017_2020.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

assert manifest["join_key"] == "SEQN"
assert manifest["label"]["prohibited_predictors"]
assert set(manifest["files"]) == set(manifest["module_columns"])
assert set(manifest["module_columns"]["blood_pressure"]) == set(manifest["label"]["prohibited_predictors"])
declared_predictors = {
    column for module, columns in manifest["module_columns"].items() if module != "blood_pressure" for column in columns
}
assert declared_predictors == set(manifest["candidate_predictors"])
assert not set(manifest["candidate_predictors"]) & set(manifest["label"]["prohibited_predictors"])
assert manifest["status"] == "schema_audit_required_before_training"

print("manifest contract: ok")
