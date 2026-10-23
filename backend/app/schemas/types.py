"""Reusable value constraints; concrete schemas own defaults and nullability."""

from typing import Annotated

from pydantic import Field

NonEmptyText255 = Annotated[str, Field(min_length=1, max_length=255)]
Text255 = Annotated[str, Field(max_length=255)]
Text4000 = Annotated[str, Field(max_length=4000)]
