export const PING_EVERY_MS = 30_000;
export const FIRST_RETRY_MS = 1_000;
export const LONGEST_RETRY_MS = 60_000;

type Connect = (url: string) => WebSocket;

const liveUrl = () => {
  const url = new URL("/api/v1/live", location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const isChange = (data: unknown) => {
  try {
    return JSON.parse(String(data))?.type === "changed";
  } catch {
    return false;
  }
};

export function watchChanges(
  onChange: () => void,
  connect: Connect = (url) => new WebSocket(url),
) {
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryIn = FIRST_RETRY_MS;
  let reconnecting = false;
  let stopped = false;
  const ping = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
  }, PING_EVERY_MS);

  const open = () => {
    socket = connect(liveUrl());
    socket.addEventListener("open", () => {
      retryIn = FIRST_RETRY_MS;
      if (reconnecting) onChange();
    });
    socket.addEventListener("message", (event) => {
      if (isChange(event.data)) onChange();
    });
    socket.addEventListener("close", () => {
      if (stopped) return;
      reconnecting = true;
      retry = setTimeout(open, retryIn);
      retryIn = Math.min(retryIn * 2, LONGEST_RETRY_MS);
    });
  };
  open();

  return () => {
    stopped = true;
    clearInterval(ping);
    clearTimeout(retry);
    socket?.close();
  };
}
