from pydantic import BaseModel


class IntegrationContractVersion(BaseModel):
    adapter: str
    contract_version: str


HOME_ASSISTANT_CONTRACT_VERSION = "ha.v1"
MCP_CONTRACT_VERSION = "mcp.v1"


def integration_contract_header(adapter: str, version: str) -> str:
    return f"{adapter}; version={version}"
