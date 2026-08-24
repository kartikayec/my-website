// Serverless Endpoint: POST /api/auth/logout
export async function onRequestPost(context) {
    try {
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/smartniwas_session=([^;]+)/);
        
        if (match && context.env.DB) {
            const token = match[1];
            await context.env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?").bind(token).run();
        }

        const clearCookie = `smartniwas_session=; Path=/; Domain=.smartniwas.com; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": clearCookie
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
