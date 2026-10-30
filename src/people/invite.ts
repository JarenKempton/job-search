import type { Env } from "../env";

export async function sendInvite(
  env: Env,
  {
    to,
    name,
    invitedBy,
    origin,
  }: { to: string; name: string | null; invitedBy: string; origin: string },
) {
  if (!env.EMAIL || !env.INVITE_FROM) return false;
  try {
    await env.EMAIL.send({
      to,
      from: { email: env.INVITE_FROM, name: "Job Search" },
      replyTo: invitedBy,
      subject: "You're invited to Job Search",
      text: `Hi${name ? ` ${name.split(" ")[0]}` : ""},

${invitedBy} added you to Job Search, a private tracker for your job applications. Your jobs, resume and notes are visible only to you.

1. Open ${origin} and sign in with ${to}.
2. Optional: on the Connect page, link ChatGPT, Claude or Grok so your AI can track applications from your email and find jobs that fit your resume.

Reply to this email if you have questions.`,
    });
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        inviteError: (error as { code?: string }).code ?? String(error),
      }),
    );
    return false;
  }
}
