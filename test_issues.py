# Test GitHub issues extraction

from mcp_server.client import MCPClient

client = MCPClient("github_tools.py")
issues = client.get_issues("microsoft", "vscode")
print(f"Found {{len(issues)}} open issues")
for i in issues[:3]: print(f"- {i[\"title\"]} ({i[\"url\"]})")
