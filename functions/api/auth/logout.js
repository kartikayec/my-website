// Serverless Endpoint: POST /api/auth/logout
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
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const sessionToken = parseCookie(cookieHeader, "smartniwas_session");

        if (sessionToken && context.env.DB) {
            await context.env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?").bind(sessionToken).run();
        }

        const host = context.request.headers.get("Host") || "";
        const domainAttr = host.includes("smartniwas.com") ? "Domain=.smartniwas.com; " : "";
        const expiredCookie = `smartniwas_session=; Path=/; ${domainAttr}Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                ...corsHeaders,
                "Set-Cookie": expiredCookie
            }
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
