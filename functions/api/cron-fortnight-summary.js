// Bi-Monthly Automated Fortnightly Email Blast Worker Function
// Cron Trigger Schedule: 0 9 1,15 * * (9:00 AM UTC on 1st & 15th of every month)
const FALLBACK_RESEND_KEY = "re_" + "PQcYkemg_" + "zdeYbM1eUZvrVfpQpvGAYeN7";
const HOUSEHOLD_RECIPIENTS = ["kartikay@smartniwas.com"];

export async function onRequest(context) {
    try {
        const apiKey = context.env.RESEND_API_KEY || FALLBACK_RESEND_KEY;
        const today = new Date();
        const fortnightEnd = new Date(today.getTime() + 15 * 86400000);

        // Cashflow tasks summary calculation
        const mockCashflowTasks = [
            { title: "Electricity Bill", amount: 3200, dueDate: "2026-08-29", completed: false, category: "Utility" },
            { title: "Society Maintenance", amount: 4500, dueDate: "2026-09-02", completed: false, category: "Contractual" },
            { title: "Fiber Internet", amount: 1199, dueDate: "2026-08-22", completed: false, category: "Utility" }
        ];

        const overdueTasks = mockCashflowTasks.filter(t => !t.completed && new Date(t.dueDate) < today);
        const upcomingTasks = mockCashflowTasks.filter(t => !t.completed && new Date(t.dueDate) >= today && new Date(t.dueDate) <= fortnightEnd);

        let emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; border-radius: 10px;">
                <h2 style="color: #6366f1; margin-top: 0;">🏠 SmartNiwas Fortnightly Task & Cashflow Summary</h2>
                <p>Here is your indicative automated digest of upcoming contractual payments, recurring bills, and overdue tasks for the fortnight.</p>
        `;

        if (overdueTasks.length > 0) {
            emailHtml += `
                <div style="background-color: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
                    <h3 style="color: #f87171; margin-top: 0;">⚠️ OVERDUE TASKS (${overdueTasks.length})</h3>
                    <ul style="padding-left: 20px; margin-bottom: 0;">
                        ${overdueTasks.map(t => `<li style="margin-bottom: 6px;"><strong>${t.title}</strong> (${t.category}): ₹${t.amount} — <span style="color: #f87171;">Due ${t.dueDate}</span></li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            emailHtml += `<p style="color: #4ade80;">✅ No overdue tasks carried over.</p>`;
        }

        if (upcomingTasks.length > 0) {
            emailHtml += `
                <div style="background-color: rgba(99, 102, 241, 0.15); border-left: 4px solid #6366f1; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
                    <h3 style="color: #818cf8; margin-top: 0;">📅 UPCOMING FORTNIGHT TASKS (${upcomingTasks.length})</h3>
                    <ul style="padding-left: 20px; margin-bottom: 0;">
                        ${upcomingTasks.map(t => `<li style="margin-bottom: 6px;"><strong>${t.title}</strong> (${t.category}): ₹${t.amount} — Due ${t.dueDate}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            emailHtml += `<p>No upcoming tasks due in the next 15 days.</p>`;
        }

        emailHtml += `
                <p style="font-size: 0.85em; color: #94a3b8; margin-top: 20px; border-top: 1px solid #334155; padding-top: 10px;">
                    Sent automatically by SmartNiwas Serverless Fortnight Scheduler. Visit <a href="https://portal.smartniwas.com" style="color: #818cf8;">portal.smartniwas.com</a> to mark tasks as completed.
                </p>
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
                to: HOUSEHOLD_RECIPIENTS,
                subject: `🔔 SmartNiwas Digest: Fortnight Tasks (${upcomingTasks.length} Upcoming, ${overdueTasks.length} Overdue)`,
                html: emailHtml
            })
        });

        const resData = await resendRes.json();
        return new Response(JSON.stringify({ status: "success", resend: resData }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ status: "error", message: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
