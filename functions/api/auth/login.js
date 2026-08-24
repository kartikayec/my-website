// Serverless Endpoint: POST /api/auth/login
export async function onRequestPost(context) {
    try {
        const { email, password } = await context.request.json();
        
        if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const sessionToken = "sn_sess_" + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

        const host = context.request.headers.get("Host") || "";
        const domainAttr = host.includes("smartniwas.com") ? "Domain=.smartniwas.com; " : "";

        if (context.env.DB) {
            // 1. Check if users table is empty (First User Auto-Admin Rule)
            const countRow = await context.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();
            const totalUsers = countRow ? countRow.cnt : 0;

            if (totalUsers === 0) {
                // Register first user automatically as ADMIN
                const userId = "usr_" + crypto.randomUUID().substring(0, 8);
                const passHash = await hashPassword(password);
                
                await context.env.DB.prepare(
                    "INSERT INTO users (id, email, password_hash, role, must_change_password) VALUES (?, ?, ?, 'admin', 0)"
                ).bind(userId, cleanEmail, passHash).run();

                await context.env.DB.prepare(
                    "INSERT INTO auth_tokens (token, user_id, type, expires_at) VALUES (?, ?, 'SESSION', ?)"
                ).bind(sessionToken, userId, expiresAt).run();

                const cookieHeader = `smartniwas_session=${sessionToken}; Path=/; ${domainAttr}Secure; HttpOnly; SameSite=Lax; Max-Age=604800`;

                return new Response(JSON.stringify({
                    success: true,
                    user: { id: userId, email: cleanEmail, role: "admin", mustChangePassword: false }
                }), {
                    headers: {
                        "Content-Type": "application/json",
                        "Set-Cookie": cookieHeader
                    }
                });
            }

            // 2. Existing user login lookup
            const user = await context.env.DB.prepare(
                "SELECT id, email, password_hash, role, must_change_password, is_active FROM users WHERE email = ?"
            ).bind(cleanEmail).first();

            if (!user || !user.is_active) {
                return new Response(JSON.stringify({ error: "Invalid email or password." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const valid = await verifyPassword(password, user.password_hash);
            if (!valid) {
                return new Response(JSON.stringify({ error: "Invalid email or password." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Record session token
            await context.env.DB.prepare(
                "INSERT INTO auth_tokens (token, user_id, type, expires_at) VALUES (?, ?, 'SESSION', ?)"
            ).bind(sessionToken, user.id, expiresAt).run();

            const cookieHeader = `smartniwas_session=${sessionToken}; Path=/; ${domainAttr}Secure; HttpOnly; SameSite=Lax; Max-Age=604800`;

            return new Response(JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    mustChangePassword: !!user.must_change_password
                }
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Set-Cookie": cookieHeader
                }
            });
        }

        // Mock / Fallback handling for initial setup
        const isFirstAdmin = cleanEmail === "admin@smartniwas.com" || cleanEmail.includes("kartikay") || cleanEmail.includes("admin");
        const role = isFirstAdmin ? "admin" : "regular";
        const cookieHeader = `smartniwas_session=${sessionToken}; Path=/; ${domainAttr}Secure; HttpOnly; SameSite=Lax; Max-Age=604800`;

        return new Response(JSON.stringify({
            success: true,
            user: { id: "usr_101", email: cleanEmail, role: role, mustChangePassword: false }
        }), {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": cookieHeader
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

async function hashPassword(plainText) {
    const msgBuffer = new TextEncoder().encode(plainText + "_sn_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(plainText, hashHex) {
    const computed = await hashPassword(plainText);
    return computed === hashHex;
}
