INTEGRATION_CONTRACT_HEADER = "X-Integration-Contract"

HOME_ASSISTANT_ADAPTER = "home-assistant"
HOME_ASSISTANT_CONTRACT_VERSION = "ha.v1"

MCP_ADAPTER = "mcp"
MCP_CONTRACT_VERSION = "mcp.v1"


def integration_contract_header(adapter: str, version: str) -> str:
    return f"{adapter}; version={version}"
