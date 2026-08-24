// Serverless Endpoint: GET /api/auth/me
export async function onRequestGet(context) {
    try {
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/smartniwas_session=([^;]+)/);
        
        if (!match) {
            return new Response(JSON.stringify({ authenticated: false }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        const token = match[1];

        // Query Cloudflare D1 DB if bound
        if (context.env.DB) {
            const tokenRow = await context.env.DB.prepare(
                "SELECT user_id, expires_at FROM auth_tokens WHERE token = ? AND type = 'SESSION'"
            ).bind(token).first();

            if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
                return new Response(JSON.stringify({ authenticated: false }), {
                    headers: { "Content-Type": "application/json" }
                });
            }

            const user = await context.env.DB.prepare(
                "SELECT id, email, role, must_change_password FROM users WHERE id = ? AND is_active = 1"
            ).bind(tokenRow.user_id).first();

            if (!user) {
                return new Response(JSON.stringify({ authenticated: false }), {
                    headers: { "Content-Type": "application/json" }
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
                headers: { "Content-Type": "application/json" }
            });
        }

        // Fallback for session validation if D1 DB binding is pending setup
        return new Response(JSON.stringify({
            authenticated: true,
            user: {
                id: "usr_admin",
                email: "admin@smartniwas.com",
                role: "admin",
                mustChangePassword: false
            }
        }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ authenticated: false, error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
