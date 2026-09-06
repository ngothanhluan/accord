# Open research questions

Appended by explore sessions. Resolve during the phase that owns the topic.

## 2026-09-05 — remote MCP server as the non-tech frontend

- [ ] Which individual paid plans support custom remote MCP connectors with OAuth, and do
      they surface MCP prompts as well as tools: claude.ai (web/desktop), ChatGPT, Copilot
      (VS Code, CLI, github.com), Codex CLI, Claude Code, Cursor? Verify against official docs.
- [ ] Can any consumer subscription (Claude, ChatGPT, Copilot) legally and technically power a
      third-party app without an API key? Expected answer: no. Confirm so the "no API key"
      constraint is grounded, not assumed.
- [ ] Commit-without-clone: GitHub REST contents endpoint vs GraphQL `createCommitOnBranch`
      for multi-file atomic commits with the user as author. Rate limits, file size cap,
      branch protection interaction.
- [ ] OAuth for an MCP server: GitHub OAuth App vs GitHub App user-to-server tokens. Which
      one lets the MCP server stay stateless (token lives in the client) and still yields the
      real git author on commits?
- [ ] Hosting a stateless Streamable HTTP MCP server: Cloudflare Workers vs a small Node
      host. Does `@cucumber/gherkin`, `yaml`, `ajv` run in a Workers runtime unchanged?
- [ ] Ready gate over a working copy the server never has: the gate needs the whole
      `accord/` folder, not one file. Fetch via tarball/tree API per call, or cache by commit SHA?
- [ ] Shortcut adapter priority: employer tracker is Shortcut, v0.1 ships `github-issues`.
      Does dogfooding need Shortcut sync, or is `none` enough for the first real ticket?

### Resolved 2026-09-05 (quick research pass; sources cited by researcher, not re-opened here)

- [x] Consumer subscriptions cannot power a third-party app. Anthropic: third parties may not route requests through Free/Pro/Max credentials; Agent SDK users must use API keys (https://code.claude.com/docs/en/legal-and-compliance). Copilot is the exception: the Copilot SDK documents seat-based use through a GitHub OAuth App (https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate). ChatGPT sign-in for third-party apps: unverifiable, help.openai.com returned 403.
- [x] Remote MCP with OAuth, by client:
  - claude.ai / Desktop / Cowork: Free (one connector), Pro, Max, Team, Enterprise; Streamable HTTP, OAuth with DCR; tools, prompts, resources (https://support.claude.com/en/articles/11175166, https://claude.com/docs/connectors/building)
  - ChatGPT developer mode: Plus, Pro, Business, Enterprise, Edu; web only; tools only (https://developers.openai.com/api/docs/guides/developer-mode)
  - Codex CLI / IDE / desktop: Streamable HTTP, `codex mcp login`; tools only documented (https://learn.chatgpt.com/docs/extend/mcp). Codex cloud: unverifiable.
  - Claude Code: HTTP + OAuth, tools, prompts, resources (https://code.claude.com/docs/en/mcp)
  - Cursor: Streamable HTTP with OAuth; tools, prompts, resources (https://cursor.com/docs/context/mcp)
  - VS Code Copilot Chat: HTTP; tools, resources, prompts (https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
  - Copilot CLI: Streamable HTTP, tools only, OAuth unmentioned (https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)
  - Copilot coding agent, code review, github.com chat: no OAuth remote MCP, tools only (https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers)
  - Design consequence: the role workflow must be reachable as a tool result, since three of the targets expose tools only.
