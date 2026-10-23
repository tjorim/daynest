"""Shared contracts for external request bodies."""

from pydantic import BaseModel, ConfigDict


class RequestModel(BaseModel):
    """Reject unknown fields instead of silently accepting misspelled writes."""

    model_config = ConfigDict(extra="forbid")
