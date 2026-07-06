const PERFETTO_UI_ORIGIN = "https://ui.perfetto.dev";

// Opens a trace in the Perfetto UI. The dashboard fetches the trace bytes and
// hands them to Perfetto over postMessage, so presigned (non-public) trace URLs
// work without being exposed to Perfetto or needing CORS on Perfetto's origin.
// See https://perfetto.dev/docs/visualization/deep-linking-to-perfetto-ui
export async function openTraceInPerfetto(
  traceUrl: string,
  title: string,
): Promise<void> {
  // window.open must run synchronously within the click gesture, before the
  // await below, or the popup blocker will reject it.
  const perfettoWindow = window.open(PERFETTO_UI_ORIGIN);
  if (perfettoWindow === null) {
    throw new Error("could not open Perfetto UI, check your popup blocker");
  }

  let buffer: ArrayBuffer;
  try {
    const response = await fetch(traceUrl);
    if (!response.ok) {
      throw new Error(`fetching trace failed with status ${response.status}`);
    }
    buffer = await response.arrayBuffer();
  } catch (error) {
    perfettoWindow.close();
    throw error;
  }

  await waitForPerfettoReady(perfettoWindow);
  perfettoWindow.postMessage(
    { perfetto: { buffer, title } },
    PERFETTO_UI_ORIGIN,
  );
}

// Perfetto's message channel is not buffered, so we PING until the UI answers
// with PONG before posting the trace.
function waitForPerfettoReady(perfettoWindow: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === PERFETTO_UI_ORIGIN && event.data === "PONG") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearInterval(pingInterval);
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };

    window.addEventListener("message", onMessage);
    const pingInterval = window.setInterval(() => {
      perfettoWindow.postMessage("PING", PERFETTO_UI_ORIGIN);
    }, 100);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for Perfetto UI to load"));
    }, 15000);
  });
}
