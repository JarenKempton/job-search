import { reset } from "cloudflare:test";
import { afterEach } from "vite-plus/test";

afterEach(async () => {
  await reset();
});
