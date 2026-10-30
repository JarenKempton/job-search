import type { Directory } from "./people/directory";
import type { Tracker } from "./tracker";

export interface Env {
  TRACKER: DurableObjectNamespace<Tracker>;
  DIRECTORY: DurableObjectNamespace<Directory>;
  ASSETS: Fetcher;
  AI: Ai;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ACCESS_GROUP_ID?: string;
  ACCESS_GROUPS_TOKEN?: string;
  AI_GATEWAY_TOKEN?: string;
  EMAIL?: SendEmail;
  INVITE_FROM?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { tracker: DurableObjectStub<Tracker>; email: string };
};
