"""DF-007: canonical record schemas must declare timestamp coverage.

The inventory is intentionally schema-driven.  Adding a record type to a schema
therefore adds it to this check without requiring a second, hand-maintained list.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PARTS = {"schema", "schemas", "contracts"}
EXEMPTION_KEYS = (
    "x-timestamp-exemption",
    "timestamp_exemption",
    "timestampExemption",
)


def _schema_files() -> Iterator[Path]:
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() != ".json":
            continue
        if any(part in {".git", ".venv", "node_modules"} for part in path.parts):
            continue
        if any(part.lower() in SCHEMA_PARTS for part in path.parts):
            yield path


def _record_definitions(document: Any, source: Path) -> Iterator[tuple[str, dict[str, Any]]]:
    if not isinstance(document, dict):
        return

    def visit(value: Any, name: str) -> Iterator[tuple[str, dict[str, Any]]]:
        if not isinstance(value, dict):
            return
        if value.get("type") == "object" and isinstance(value.get("properties"), dict):
            yield f"{source.relative_to(ROOT)}:{name}", value
        for container_name in ("$defs", "definitions"):
            definitions = value.get(container_name)
            if isinstance(definitions, dict):
                for child_name, child in definitions.items():
                    yield from visit(child, child_name)

    yield from visit(document, document.get("title", source.stem))


def _has_validated_timestamp(properties: dict[str, Any]) -> bool:
    for name, schema in properties.items():
        if not isinstance(schema, dict):
            continue
        lowered = name.lower()
        looks_like_timestamp = (
            lowered == "timestamp"
            or lowered.endswith("_timestamp")
            or lowered.endswith("_at")
            or lowered.endswith("_time")
        )
        if looks_like_timestamp and schema.get("type") == "string" and schema.get("format") in {
            "date-time",
            "datetime",
        }:
            return True
    return False


def _exemption_reason(record: dict[str, Any]) -> str | None:
    for key in EXEMPTION_KEYS:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            reason = value.get("reason")
            if isinstance(reason, str) and reason.strip():
                return reason.strip()
    return None


def test_every_canonical_record_type_has_timestamp_or_reasoned_exemption() -> None:
    failures: list[str] = []
    records = 0

    for path in _schema_files():
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for identity, record in _record_definitions(document, path):
            records += 1
            if not _has_validated_timestamp(record["properties"]) and not _exemption_reason(record):
                failures.append(identity)

    assert records, "no canonical record schemas were discovered"
    assert not failures, "canonical record types lack timestamp coverage: " + ", ".join(failures)
