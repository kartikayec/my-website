// Serverless Endpoint: GET /api/auth/me
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

export async function onRequestGet(context) {
    const origin = context.request.headers.get("Origin") || "*";
    const corsHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true"
    };

    try {
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const sessionToken = parseCookie(cookieHeader, "smartniwas_session");

        if (!sessionToken) {
            return new Response(JSON.stringify({ authenticated: false, user: null }), {
                headers: corsHeaders
            });
        }

        if (context.env.DB) {
            const tokenRow = await context.env.DB.prepare(
                "SELECT user_id, expires_at FROM auth_tokens WHERE token = ? AND type = 'SESSION'"
            ).bind(sessionToken).first();

            if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
                return new Response(JSON.stringify({ authenticated: false, user: null }), {
                    headers: corsHeaders
                });
            }

            const user = await context.env.DB.prepare(
                "SELECT id, email, role, must_change_password FROM users WHERE id = ? AND is_active = 1"
            ).bind(tokenRow.user_id).first();

            if (!user) {
                return new Response(JSON.stringify({ authenticated: false, user: null }), {
                    headers: corsHeaders
                });
            }

            return new Response(JSON.stringify({
                authenticated: true,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    mustChangePassword: !!user.must_change_password
                }
            }), {
                headers: corsHeaders
            });
        }

        // Mock response if DB binding is pending
        return new Response(JSON.stringify({
            authenticated: true,
            user: { id: "usr_101", email: "admin@smartniwas.com", role: "admin", mustChangePassword: false }
        }), {
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ authenticated: false, error: err.message }), {
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
