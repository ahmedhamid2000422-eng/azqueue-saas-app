// Supabase Edge Function — sends a professional staff invitation email via Resend.
//
// Deploy:  supabase functions deploy invite-staff
// Secrets: supabase secrets set RESEND_API_KEY=re_...
//
// Body:    { email, displayName, role, branchName, inviterName? }
// Returns: { ok, dryRun?, messageId? }
//
// Without RESEND_API_KEY, logs a dry-run and returns 200 so the invite row
// is still created and the UI doesn't break.
//
// Sender: noreply@azqueue.io (verify azqueue.io in Resend dashboard first)
// Fallback sender: onboarding@resend.dev (works without domain verification)

const FROM_EMAIL  = "AzQueue <noreply@azqueue.io>";
const FALLBACK_FROM = "AzQueue <onboarding@resend.dev>";
const APP_URL     = "https://azqueue.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    email: string;
    displayName: string;
    role: string;
    branchName: string;
    inviterName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { email, displayName, role, branchName, inviterName } = body;

  if (!email || !displayName || !branchName) {
    return new Response(
      JSON.stringify({ error: "email, displayName, and branchName are required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const roleLabel = role === "manager" ? "Manager" : "Staff";
  const signUpUrl = `${APP_URL}/signup`;
  const fromLine  = inviterName ? `${inviterName} from` : "The team at";

  const html = buildEmail({ displayName, branchName, roleLabel, signUpUrl, fromLine });
  const text = buildPlainText({ displayName, branchName, roleLabel, signUpUrl, fromLine });

  const apiKey = Deno.env.get("RESEND_API_KEY");

  // ── Dry-run mode ────────────────────────────────────────────────────────────
  if (!apiKey) {
    console.log(`[invite-staff] dry-run → would send invite to ${email} for ${branchName}`);
    return new Response(
      JSON.stringify({ ok: true, dryRun: true, missing: "RESEND_API_KEY" }),
      { headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // ── Send via Resend ─────────────────────────────────────────────────────────
  let from = FROM_EMAIL;
  let res: Response;
  let data: Record<string, unknown>;

  const sendPayload = (fromAddr: string) =>
    fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    fromAddr,
        to:      [email],
        subject: `You've been invited to join ${branchName} on AzQueue`,
        html,
        text,
      }),
    });

  // Try with verified domain first; fall back to Resend's sandbox domain
  res  = await sendPayload(from);
  data = await res.json() as Record<string, unknown>;

  if (!res.ok && String(data?.message ?? "").toLowerCase().includes("domain")) {
    from = FALLBACK_FROM;
    res  = await sendPayload(from);
    data = await res.json() as Record<string, unknown>;
  }

  if (!res.ok) {
    console.error("[invite-staff] Resend error:", data);
    return new Response(
      JSON.stringify({ ok: false, error: data?.message ?? "Failed to send email" }),
      { status: 500, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, messageId: data?.id }),
    { headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});

// ── Email builders ───────────────────────────────────────────────────────────

function buildEmail({ displayName, branchName, roleLabel, signUpUrl, fromLine }: {
  displayName: string;
  branchName:  string;
  roleLabel:   string;
  signUpUrl:   string;
  fromLine:    string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>You're invited to AzQueue</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 0;">
  <tr><td align="center">

    <!-- Card -->
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

      <!-- Header bar -->
      <tr>
        <td style="background:#0f1a14;padding:28px 40px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:300;color:#c9a86a;letter-spacing:0.12em;">AZ</span><span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:300;color:#e8e2d4;letter-spacing:0.08em;">QUEUE</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:40px 40px 32px;">

          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#c9a86a;letter-spacing:0.12em;text-transform:uppercase;">You're invited</p>
          <h1 style="margin:0 0 24px;font-size:26px;font-weight:300;color:#1a1a1a;line-height:1.3;">
            Join ${branchName}<br/>on AzQueue
          </h1>

          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">
            Hi ${displayName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">
            ${fromLine} <strong>${branchName}</strong> has added you as a <strong>${roleLabel}</strong> on AzQueue — the queue management platform they use to serve customers.
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:#444;line-height:1.6;">
            Create your account with this email address and you'll be automatically connected to the team.
          </p>

          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="background:#0f1a14;border-radius:3px;">
                <a href="${signUpUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:500;color:#c9a86a;text-decoration:none;letter-spacing:0.06em;">
                  Create your account →
                </a>
              </td>
            </tr>
          </table>

          <!-- What to expect -->
          <table cellpadding="0" cellspacing="0" style="background:#f9f8f5;border-left:3px solid #c9a86a;border-radius:2px;margin-bottom:32px;width:100%;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#888;letter-spacing:0.1em;text-transform:uppercase;">What to expect</p>
                <p style="margin:0 0 8px;font-size:14px;color:#555;line-height:1.5;">
                  ✓ &nbsp;Sign up at azqueue.io using <strong>${"{{email}}"}</strong>
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#555;line-height:1.5;">
                  ✓ &nbsp;You'll automatically appear on the ${branchName} team
                </p>
                <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">
                  ✓ &nbsp;Log in to start managing the queue
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9f8f5;border-top:1px solid #eee;padding:20px 40px;">
          <p style="margin:0;font-size:12px;color:#bbb;line-height:1.5;">
            AzQueue · Queue management for modern businesses<br/>
            <a href="${APP_URL}" style="color:#c9a86a;text-decoration:none;">azqueue.io</a>
          </p>
        </td>
      </tr>

    </table>
    <!-- /Card -->

  </td></tr>
</table>

</body>
</html>`;
}

function buildPlainText({ displayName, branchName, roleLabel, signUpUrl, fromLine }: {
  displayName: string;
  branchName:  string;
  roleLabel:   string;
  signUpUrl:   string;
  fromLine:    string;
}): string {
  return `You've been invited to join ${branchName} on AzQueue

Hi ${displayName},

${fromLine} ${branchName} has added you as a ${roleLabel} on AzQueue.

Create your account using this email address and you'll be automatically connected to the team.

Sign up here: ${signUpUrl}

—
AzQueue · azqueue.io
`;
}
