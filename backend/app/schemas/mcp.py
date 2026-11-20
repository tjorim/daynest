"""Response body of the unauthenticated MCP capability manifest."""

from typing import Literal

from app.schemas.base import ResponseModel


class McpToolAccess(ResponseModel):
    auth: Literal["interactive", "user_or_integration"]
    tier: Literal["household_member", "owner"]


class McpToolCapability(ResponseModel):
    name: str
    effect: Literal["read", "write"]
    requires_confirmation: bool
    access: McpToolAccess


class McpResourceCapability(ResponseModel):
    uri: str


class McpPromptCapability(ResponseModel):
    name: str


class McpCapabilitiesResponse(ResponseModel):
    contract_version: int
    enabled: bool
    mount_path: str
    version: str | None
    tools: list[McpToolCapability]
    resources: list[McpResourceCapability]
    prompts: list[McpPromptCapability]
