// Serverless Endpoint: POST /api/auth/change-password
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
        const { currentPassword, newPassword, confirmPassword } = await context.request.json();
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const sessionToken = parseCookie(cookieHeader, "smartniwas_session");

        if (!newPassword || !confirmPassword) {
            return new Response(JSON.stringify({ error: "New password and confirmation are required." }), {
                status: 400,
                headers: corsHeaders
            });
        }

        if (newPassword.length < 10) {
            return new Response(JSON.stringify({ error: "Password must be at least 10 characters long." }), {
                status: 400,
                headers: corsHeaders
            });
        }

        if (newPassword !== confirmPassword) {
            return new Response(JSON.stringify({ error: "New password and confirmation do not match." }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const passHash = await hashPassword(newPassword);

        if (context.env.DB && sessionToken) {
            const tokenRow = await context.env.DB.prepare(
                "SELECT user_id FROM auth_tokens WHERE token = ? AND type = 'SESSION'"
            ).bind(sessionToken).first();

            if (tokenRow) {
                await context.env.DB.prepare(
                    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                ).bind(passHash, tokenRow.user_id).run();
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Password updated successfully."
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

function parseCookie(cookieHeader, name) {
    const cookies = cookieHeader.split(';');
    for (let c of cookies) {
        const [k, v] = c.trim().split('=');
        if (k === name) return v;
    }
    return null;
}

async function hashPassword(plainText) {
    const msgBuffer = new TextEncoder().encode(plainText + "_sn_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
