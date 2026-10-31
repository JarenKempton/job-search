import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export type Visits = Record<string, { firstSeen: string; lastSeen: string }>;

const VISITS = "visits";
const NAMES = "names";
const CEILING = "ceiling";

export type CeilingPlan = { standard: number | null; raisedOn: string | null };

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

  names(): Record<string, string> {
    return this.ctx.storage.kv.get<Record<string, string>>(NAMES) ?? {};
  }

  ceilingPlan(): CeilingPlan {
    return (
      this.ctx.storage.kv.get<CeilingPlan>(CEILING) ?? {
        standard: null,
        raisedOn: null,
      }
    );
  }

  saveCeilingPlan(plan: CeilingPlan) {
    this.ctx.storage.kv.put(CEILING, plan);
  }

  rename(email: string, name: string | null) {
    const names = this.names();
    if (name) names[email] = name;
    else delete names[email];
    this.ctx.storage.kv.put(NAMES, names);
  }
}

export const directory = (env: Env) =>
  env.DIRECTORY.get(env.DIRECTORY.idFromName("all"));
