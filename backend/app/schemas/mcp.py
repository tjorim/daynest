"""Response body of the unauthenticated MCP capability manifest."""

from typing import Literal

from pydantic import BaseModel


class McpToolAccess(BaseModel):
    auth: Literal["interactive", "user_or_integration"]
    tier: Literal["household_member", "owner"]


class McpToolCapability(BaseModel):
    name: str
    effect: Literal["read", "write"]
    requires_confirmation: bool
    access: McpToolAccess


class McpResourceCapability(BaseModel):
    uri: str


class McpPromptCapability(BaseModel):
    name: str


class McpCapabilitiesResponse(BaseModel):
    contract_version: int
    enabled: bool
    mount_path: str
    version: str | None
    tools: list[McpToolCapability]
    resources: list[McpResourceCapability]
    prompts: list[McpPromptCapability]
