"""Shared contracts for external request bodies."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class RequestModel(BaseModel):
    """Reject unknown fields instead of silently accepting misspelled writes."""

    model_config = ConfigDict(extra="forbid")


NonEmptyText255 = Annotated[str, Field(min_length=1, max_length=255)]
Text255 = Annotated[str, Field(max_length=255)]
Text4000 = Annotated[str, Field(max_length=4000)]
