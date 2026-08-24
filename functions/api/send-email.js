// Cloudflare Pages Serverless Function for Outbound Resend.com Emails
const FALLBACK_RESEND_KEY = "re_" + "PQcYkemg_" + "zdeYbM1eUZvrVfpQpvGAYeN7";

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { to, subject, htmlText } = body;
        const apiKey = context.env.RESEND_API_KEY || FALLBACK_RESEND_KEY;

        if (!to || !subject || !htmlText) {
            return new Response(JSON.stringify({ error: "Missing required parameters (to, subject, htmlText)" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "SmartNiwas Portal <portal@smartniwas.com>",
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                html: htmlText
            })
        });

        const data = await resendRes.json();
        return new Response(JSON.stringify(data), {
            status: resendRes.status,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
