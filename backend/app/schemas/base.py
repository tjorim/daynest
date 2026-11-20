"""Shared contracts for external request bodies."""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field


class RequestModel(BaseModel):
    """Reject unknown fields instead of silently accepting misspelled writes."""

    model_config = ConfigDict(extra="forbid")


def omit_but_never_null(schema: dict[str, Any]) -> None:
    """``json_schema_extra`` for an optional request field that may be left out but not sent as ``null``.

    ``T | None = None`` makes the published schema accept ``null``; for a field the route rejects ``null`` for,
    that lets the generated frontend type promise a request the backend refuses.
    """
    non_null = [option for option in schema.pop("anyOf", []) if option.get("type") != "null"]
    if len(non_null) == 1:
        schema.update(non_null[0])
    else:
        schema["anyOf"] = non_null
    schema.pop("default", None)


class ResponseModel(BaseModel):
    """Base of every response body.

    A field with a default is always sent, so the published schema must list it as required: otherwise the
    OpenAPI document (and the frontend types generated from it) call it optional and force screens to guard a
    field that is always there. Validation and serialisation are unchanged; only the schema differs.
    """

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


NonEmptyText255 = Annotated[str, Field(min_length=1, max_length=255)]
Text255 = Annotated[str, Field(max_length=255)]
Text4000 = Annotated[str, Field(max_length=4000)]
