---
title: "Set Up Measure Agent for Self-Hosted Measure"
description: "Configure Measure Agent on your self-hosted instance. Get an OpenRouter API key, choose the models and expose the agent service so you can debug your app from your coding agent or Slack."
---

# Set up Measure Agent <!-- omit in toc -->

Use this guide to set up [Measure Agent](../features/feature-agent.md) on a self-hosted instance, so you can debug your app from your coding agent (over MCP) or from Slack.

The agent runs as a separate `agent` service and sends prompts to a language model through [OpenRouter](https://openrouter.ai). You provide an OpenRouter API key and choose which models the agent uses.

## Contents <!-- omit in toc -->
- [Get an OpenRouter API key](#get-an-openrouter-api-key)
- [Choose the models](#choose-the-models)
- [Configure for a new installation](#configure-for-a-new-installation)
- [Configure for an existing installation](#configure-for-an-existing-installation)
- [Make the agent reachable over MCP](#make-the-agent-reachable-over-mcp)

## Get an OpenRouter API key

1. Create an account at [openrouter.ai](https://openrouter.ai).
2. Add credits to your account on the [Credits](https://openrouter.ai/credits) page. OpenRouter bills the agent's usage per token, so the account needs a positive balance for the agent to answer questions.
3. Create an API key on the [Keys](https://openrouter.ai/keys) page and copy it. You will set it as `OPENROUTER_API_KEY`.

## Choose the models

The agent uses two models:

- **Small model** (`OPENROUTER_MODEL_SMALL`) handles light work: summarizing long conversations and working out which app a Slack question is about. It does not call tools, so any capable chat model works. Pick a fast, inexpensive one.
- **Medium model** (`OPENROUTER_MODEL_MEDIUM`) answers the questions by calling Measure's tools, so it **must support tool (function) calling**. Pick a stronger model, since this is where most of the answer quality comes from.

Both models should have a context window of at least 64k tokens so they can hold a long conversation comfortably.

You can use the same model for both, as long as it supports tool calling. Browse the available models at [openrouter.ai/models](https://openrouter.ai/models), confirm the medium model lists tool (function) calling support, and use the model's API id, for example `deepseek/deepseek-v4-pro`.

> [!NOTE]
>
> `OPENROUTER_MODEL_LARGE` is accepted for forward compatibility but is not used yet. You can leave it empty.

## Configure for a new installation

During installation, the configuration wizard prompts for the agent settings. At the **OpenRouter credentials and models** prompts, paste your API key and the small and medium model ids. Leaving them empty disables the agent.

The wizard also asks for the **Measure Agent service URL**, for example `https://measure-agent.yourcompany.com`. This is the public address coding agents use to reach the MCP endpoint. See [Make the agent reachable over MCP](#make-the-agent-reachable-over-mcp).

## Configure for an existing installation

If your instance is already running and you want to enable or change the agent, update the environment variables manually.

1. **Agent Credentials**. Open the `self-host/.env` file & add the following environment variables as obtained from OpenRouter.

    ```sh
    OPENROUTER_API_KEY=your-openrouter-api-key        # change this
    OPENROUTER_MODEL_SMALL=deepseek/deepseek-v4-pro   # change this
    OPENROUTER_MODEL_MEDIUM=deepseek/deepseek-v4-pro  # change this
    ```

2. **Shutdown**. Run the following command to shutdown all services.

    ```sh
    sudo docker compose -f compose.yml -f compose.prod.yml --profile migrate down
    ```

3. **Startup**. Finally, run the `install.sh` script for the configuration to take effect.

    ```sh
    sudo ./install.sh
    ```

## Make the agent reachable over MCP

To use the agent from a coding agent over MCP, the `agent` service (port `8084`) needs a public domain. This uses the same reverse-proxy and DNS setup as the dashboard, API and ingest services in the [Self-Hosting Guide](./README.md).

Add a reverse proxy entry for the agent domain. For Caddy, add the following to your `~/Caddyfile`.

```
measure-agent.yourcompany.com {
	reverse_proxy http://localhost:8084
}
```

Reload the proxy, then add a DNS A record pointing `measure-agent.yourcompany.com` at your VM's external IP, the same way you did for the other subdomains.

The MCP endpoint is then available at `https://measure-agent.yourcompany.com/mcp`. See the [MCP Server](../features/feature-mcp.md) guide for connecting coding agents.

Using the agent from Slack needs no extra domain: Slack delivers events to the API service and the agent consumes them internally. Set that up with the [Slack integration guide](./slack.md).

[Go back to self host guide](./README.md)
