// Serverless Endpoint: POST /api/auth/change-password
export async function onRequestPost(context) {
    try {
        const { currentPassword, newPassword, confirmPassword } = await context.request.json();
        
        const cookieHeader = context.request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/smartniwas_session=([^;]+)/);
        
        if (!match) {
            return new Response(JSON.stringify({ error: "Unauthorized session." }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (!newPassword || !confirmPassword) {
            return new Response(JSON.stringify({ error: "New password and confirmation are required." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (newPassword.length < 10) {
            return new Response(JSON.stringify({ error: "Password must be at least 10 characters long." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (newPassword !== confirmPassword) {
            return new Response(JSON.stringify({ error: "Passwords do not match." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const token = match[1];
        const newHash = await hashPassword(newPassword);

        if (context.env.DB) {
            const tokenRow = await context.env.DB.prepare(
                "SELECT user_id FROM auth_tokens WHERE token = ? AND type = 'SESSION'"
            ).bind(token).first();

            if (!tokenRow) {
                return new Response(JSON.stringify({ error: "Invalid session." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const user = await context.env.DB.prepare("SELECT password_hash, must_change_password FROM users WHERE id = ?").bind(tokenRow.user_id).first();

            // If not forced first-login change, verify current password
            if (user && !user.must_change_password && currentPassword) {
                const valid = await verifyPassword(currentPassword, user.password_hash);
                if (!valid) {
                    return new Response(JSON.stringify({ error: "Current password is incorrect." }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }

            await context.env.DB.prepare(
                "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(newHash, tokenRow.user_id).run();
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Password updated successfully!"
        }), {
            headers: { "Content-Type": "application/json" }
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
