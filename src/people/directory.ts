import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export type Visits = Record<string, { firstSeen: string; lastSeen: string }>;

const VISITS = "visits";

export class Directory extends DurableObject<Env> {
  seen(email: string, day: string) {
    const visits = this.visits();
    const current = visits[email];
    if (current?.lastSeen === day) return;
    visits[email] = { firstSeen: current?.firstSeen ?? day, lastSeen: day };
    this.ctx.storage.kv.put(VISITS, visits);
  }

  visits(): Visits {
    return this.ctx.storage.kv.get<Visits>(VISITS) ?? {};
  }
}

export const directory = (env: Env) =>
  env.DIRECTORY.get(env.DIRECTORY.idFromName("all"));
