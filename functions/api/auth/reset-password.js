// Serverless Endpoint: POST /api/auth/reset-password
export async function onRequestPost(context) {
    try {
        const { resetToken, newPassword, confirmPassword } = await context.request.json();
        
        if (!resetToken || !newPassword || !confirmPassword) {
            return new Response(JSON.stringify({ error: "Reset token, new password, and confirmation are required." }), {
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
            return new Response(JSON.stringify({ error: "New password and confirmation do not match." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const passHash = await hashPassword(newPassword);

        if (context.env.DB) {
            const tokenRow = await context.env.DB.prepare(
                "SELECT user_id, expires_at FROM auth_tokens WHERE token = ? AND (type = 'PASSWORD_RESET' OR type = 'INVITE')"
            ).bind(resetToken).first();

            if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
                return new Response(JSON.stringify({ error: "Reset token is invalid or has expired." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            await context.env.DB.prepare(
                "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(passHash, tokenRow.user_id).run();

            await context.env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?").bind(resetToken).run();
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Your password has been successfully updated. You can now log in with your new password."
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
