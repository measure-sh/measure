# AI 

Measure makes it easy to debug Crashes and ANRs with AI assistance.

* [**Copy AI Context**](#copy-ai-context)
* [**AI Integration**](#ai-integration)
  * [**Setting Up AI integration**](#setting-up-ai-integration)
  * [**Debugging with AI**](#debugging-with-ai)

## Copy AI Context
On Crash and ANR details pages, you will see a `Copy AI Context` button. This allows you to copy the relevant stacktrace and session timeline to the copy clipboard for easy pasting into an external LLM interface of your choice.

This feature does not require setting up the AI Assitant and can be used directly.

## AI Assistant Integration
This integration enables developers to get help with Crash/ANR debugging via our AI assitant.

### Setting up AI integration
If you are a self hosted user, please set up AI Assistant integration if you haven't done so using this [guide](/docs/hosting/ai.md).

### Debugging with AI
You will be able to see a `Debug With AI` button on Crash and ANR details pages. You can click it to open the assitant interface and start chatting. 

You can attach the current exception context as well as the corresponding session timeline using the chat input toolbar.

You can also attach code files and images to help in your debugging workflow.


