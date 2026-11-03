import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { FIRST_RETRY_MS, PING_EVERY_MS, watchChanges } from "../src/web/live";

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.OPEN;
  sent: string[] = [];
  constructor(readonly url: string) {
    super();
  }
  send(message: string) {
    this.sent.push(message);
  }
  close() {
    this.readyState = WebSocket.CLOSED;
  }
  receive(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  drop() {
    this.dispatchEvent(new Event("close"));
  }
}

function watch() {
  const sockets: FakeSocket[] = [];
  const onChange = vi.fn();
  const stop = watchChanges(onChange, (url) => {
    const socket = new FakeSocket(url);
    sockets.push(socket);
    return socket as unknown as WebSocket;
  });
  return { sockets, onChange, stop };
}

describe("dashboard live updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("location", new URL("https://job-search.test/applications"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reloads when the server says something changed", () => {
    const { sockets, onChange } = watch();
    expect(sockets[0].url).toBe("wss://job-search.test/api/v1/live");

    sockets[0].receive("pong");
    expect(onChange).not.toHaveBeenCalled();
    sockets[0].receive('{"type":"changed"}');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps the socket alive with pings", () => {
    const { sockets } = watch();
    vi.advanceTimersByTime(PING_EVERY_MS);
    expect(sockets[0].sent).toEqual(["ping"]);
  });

  it("reconnects after a drop and catches up on what it missed", () => {
    const { sockets, onChange } = watch();
    sockets[0].drop();
    vi.advanceTimersByTime(FIRST_RETRY_MS);
    expect(sockets).toHaveLength(2);

    sockets[1].dispatchEvent(new Event("open"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("stops reconnecting once the page is done with it", () => {
    const { sockets, stop } = watch();
    stop();
    sockets[0].drop();
    vi.advanceTimersByTime(FIRST_RETRY_MS * 10);
    expect(sockets).toHaveLength(1);
  });
});
