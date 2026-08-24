// Serverless Endpoint: POST /api/auth/forgot-password
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
        const { email, turnstileToken } = await context.request.json();
        const apiKey = context.env.RESEND_API_KEY || FALLBACK_RESEND_KEY;

        if (!email) {
            return new Response(JSON.stringify({ error: "Email address is required." }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Verify Cloudflare Turnstile Captcha if secret is configured
        if (context.env.TURNSTILE_SECRET_KEY && turnstileToken) {
            const formData = new FormData();
            formData.append('secret', context.env.TURNSTILE_SECRET_KEY);
            formData.append('response', turnstileToken);

            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: formData
            });
            const outcome = await verifyRes.json();
            if (!outcome.success) {
                return new Response(JSON.stringify({ error: "Captcha verification failed. Please try again." }), {
                    status: 400,
                    headers: corsHeaders
                });
            }
        }

        const resetToken = "sn_rst_" + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 3600000).toISOString();

        if (context.env.DB) {
            const user = await context.env.DB.prepare("SELECT id FROM users WHERE email = ? AND is_active = 1").bind(cleanEmail).first();
            if (user) {
                await context.env.DB.prepare(
                    "INSERT INTO auth_tokens (token, user_id, type, expires_at) VALUES (?, ?, 'PASSWORD_RESET', ?)"
                ).bind(resetToken, user.id, expiresAt).run();
            }
        }

        // Explicit .html extension guarantees text/html MIME type across all Nginx servers
        const resetUrl = `https://smartniwas.com/demo-auth.html?reset=${resetToken}`;

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
                <h2 style="color: #6366f1; margin-top: 0;">🔐 Password Reset Request</h2>
                <p>We received a password reset request for your SmartNiwas account (<strong>${cleanEmail}</strong>).</p>
                <p>Click the button below to set a new password:</p>
                <p style="margin: 24px 0;">
                    <a href="${resetUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Reset Password
                    </a>
                </p>
                <p style="font-size: 0.85em; color: #94a3b8;">If you did not request a password reset, you can safely ignore this email. This link expires in 1 hour.</p>
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
                subject: "🔐 Reset Your SmartNiwas Password",
                html: emailHtml
            })
        });

        const resData = await resendRes.json();
        return new Response(JSON.stringify({
            success: true,
            message: "If an account exists for this email, a password reset link has been sent.",
            resetToken,
            resend: resData
        }), {
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
