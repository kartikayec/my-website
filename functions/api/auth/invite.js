// Serverless Endpoint: POST /api/auth/invite
const FALLBACK_RESEND_KEY = "re_" + "PQcYkemg_" + "zdeYbM1eUZvrVfpQpvGAYeN7";

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || "*";
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    });
}

export async function onRequestPost(context) {
    const origin = context.request.headers.get("Origin") || "*";
    const corsHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true"
    };

    try {
        const { email, role } = await context.request.json();
        const apiKey = context.env.RESEND_API_KEY || FALLBACK_RESEND_KEY;
        
        if (!email) {
            return new Response(JSON.stringify({ error: "Email address is required." }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const userRole = role === "admin" ? "admin" : "regular";
        const inviteToken = "sn_inv_" + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();

        if (context.env.DB) {
            const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(cleanEmail).first();
            if (existing) {
                return new Response(JSON.stringify({ error: "User with this email already exists." }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            const userId = "usr_" + crypto.randomUUID().substring(0, 8);
            const tempHash = "PENDING_INVITE_" + Date.now();

            await context.env.DB.prepare(
                "INSERT INTO users (id, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)"
            ).bind(userId, cleanEmail, tempHash, userRole).run();

            await context.env.DB.prepare(
                "INSERT INTO auth_tokens (token, user_id, type, expires_at) VALUES (?, ?, 'INVITE', ?)"
            ).bind(inviteToken, userId, expiresAt).run();
        }

        // Explicit .html extension guarantees text/html MIME type across all Nginx servers
        const inviteUrl = `https://smartniwas.com/demo-auth.html?invite=${inviteToken}`;

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
                <h2 style="color: #6366f1; margin-top: 0;">🏠 You've Been Invited to SmartNiwas</h2>
                <p>An administrator has created a new account for you (<strong>${cleanEmail}</strong>) with the role of <strong>${userRole.toUpperCase()}</strong>.</p>
                <p>Click the button below to accept your invite and set your password:</p>
                <p style="margin: 24px 0;">
                    <a href="${inviteUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Accept Invitation & Set Password
                    </a>
                </p>
                <p style="font-size: 0.85em; color: #94a3b8;">This invite link expires in 48 hours.</p>
            </div>
        `;

        const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "SmartNiwas Portal <portal@smartniwas.com>",
                to: [cleanEmail],
                subject: "📩 Invitation to SmartNiwas Home Portal",
                html: emailHtml
            })
        });

        const resData = await resendRes.json();
        return new Response(JSON.stringify({ success: true, inviteToken, resend: resData }), {
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
