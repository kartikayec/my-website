// SmartNiwas Cash Flow Serverless Worker (Cloudflare Worker + D1 SQLite)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Helper: SHA-256 hashing for password storage/verification using Web Crypto API
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // 1. Handle CORS Preflight OPTIONS
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 2. Auth: POST /api/auth/login
      if (url.pathname === '/api/auth/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers: CORS_HEADERS });
        }

        const passHash = await sha256(password);
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first();

        // In a serverless D1 environment, if no users exist, allow creating the first admin
        const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
        if (countResult.count === 0) {
          await env.DB.prepare(
            'INSERT INTO users (username, email, password_hash, role, name, password_changed) VALUES (?, ?, ?, "admin", "Admin", 1)'
          ).bind('admin', email.toLowerCase(), passHash).run();

          return new Response(JSON.stringify({ message: 'First Admin account registered successfully! Log in now.' }), { status: 201, headers: CORS_HEADERS });
        }

        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: CORS_HEADERS });
        }

        // If user exists but has no password set (first-login for invited members)
        if (user.password_hash === null || user.password_hash === '' || user.password_changed === 0) {
          await env.DB.prepare('UPDATE users SET password_hash = ?, password_changed = 1 WHERE id = ?')
            .bind(passHash, user.id)
            .run();
          user.password_hash = passHash;
        }

        if (user.password_hash !== passHash) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: CORS_HEADERS });
        }

        // Return a simple session token (for ease we will return a JSON payload with user context)
        return new Response(JSON.stringify({
          token: btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, time: Date.now() })),
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        }), { headers: CORS_HEADERS });
      }

      // Token Auth Middleware for protected endpoints
      let authHeader = request.headers.get('Authorization');
      if (!authHeader && url.searchParams.has('token')) {
        authHeader = `Bearer ${url.searchParams.get('token')}`;
      }
      let currentUser = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const rawToken = atob(authHeader.split(' ')[1]);
          currentUser = JSON.parse(rawToken);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: CORS_HEADERS });
        }
      }

      // Public read capability or strict enforcement (we will enforce token auth for editing/viewing)
      if (!currentUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
      }

      // 3. GET /api/payments
      if (url.pathname === '/api/payments' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT p.*, u.name as assignee_name, u.email as assignee_email FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.next_due_date ASC'
        ).all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 4. POST /api/payments (Create)
      if (url.pathname === '/api/payments' && method === 'POST') {
        const { name, category, amount, frequency, next_due_date, notes, user_id } = await request.json();
        if (!name || !category || !amount || !frequency || !next_due_date) {
          return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers: CORS_HEADERS });
        }

        await env.DB.prepare(
          'INSERT INTO payments (name, category, amount, frequency, next_due_date, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(name, category, parseFloat(amount), frequency, next_due_date, notes || '', user_id || null).run();

        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      // 5. PUT /api/payments/:id (Update)
      if (url.pathname.startsWith('/api/payments/') && method === 'PUT') {
        const id = url.pathname.split('/').pop();
        const { name, category, amount, frequency, next_due_date, status, notes, user_id } = await request.json();

        await env.DB.prepare(
          'UPDATE payments SET name = ?, category = ?, amount = ?, frequency = ?, next_due_date = ?, status = ?, notes = ?, user_id = ? WHERE id = ?'
        ).bind(name, category, parseFloat(amount), frequency, next_due_date, status || 'active', notes || '', user_id || null, id).run();

        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      // 6. DELETE /api/payments/:id
      if (url.pathname.startsWith('/api/payments/') && method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        await env.DB.prepare('DELETE FROM payments WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      // 7. POST /api/payments/:id/rollover (Mark as Paid & Advance next due date)
      if (url.pathname.startsWith('/api/payments/') && url.pathname.endsWith('/rollover') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[parts.length - 2];

        const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first();
        if (!payment) {
          return new Response(JSON.stringify({ error: 'Payment commitment not found' }), { status: 404, headers: CORS_HEADERS });
        }

        // Calculate next due date based on frequency
        const currentDueDate = new Date(payment.next_due_date);
        let nextDueDate = new Date(payment.next_due_date);

        if (payment.frequency === 'monthly') {
          nextDueDate.setMonth(currentDueDate.getMonth() + 1);
        } else if (payment.frequency === 'quarterly') {
          nextDueDate.setMonth(currentDueDate.getMonth() + 3);
        } else if (payment.frequency === 'annual') {
          nextDueDate.setFullYear(currentDueDate.getFullYear() + 1);
        } else {
          // One-time payments get marked as inactive
          await env.DB.prepare("UPDATE payments SET status = 'inactive' WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ success: true, status: 'inactive' }), { headers: CORS_HEADERS });
        }

        const nextDateStr = nextDueDate.toISOString().split('T')[0];
        await env.DB.prepare('UPDATE payments SET next_due_date = ? WHERE id = ?').bind(nextDateStr, id).run();

        return new Response(JSON.stringify({ success: true, next_due_date: nextDateStr }), { headers: CORS_HEADERS });
      }

      // 8. GET /api/logs (Email Logs)
      if (url.pathname === '/api/logs' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 100').all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 9. GET /api/users
      if (url.pathname === '/api/users' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, username, email, name, role FROM users').all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 10. POST /api/users
      if (url.pathname === '/api/users' && method === 'POST') {
        if (currentUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin role required' }), { status: 403, headers: CORS_HEADERS });
        }
        const { email, name, role } = await request.json();
        if (!email || !name) {
          return new Response(JSON.stringify({ error: 'Email and Name are required' }), { status: 400, headers: CORS_HEADERS });
        }

        // Check if user already exists
        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
        if (existingUser) {
          return new Response(JSON.stringify({ error: 'User already exists' }), { status: 400, headers: CORS_HEADERS });
        }

        // Insert user with empty string password hash and password_changed = 0
        await env.DB.prepare(
          "INSERT INTO users (username, email, password_hash, role, name, password_changed) VALUES (?, ?, '', ?, ?, 0)"
        ).bind(email.toLowerCase(), email.toLowerCase(), role || 'user', name).run();

        // Send invitation email via Resend API
        if (env.RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'SmartNiwas <noreply@smartniwas.com>',
                to: [email.toLowerCase()],
                subject: 'Invitation to SmartNiwas Cash Flow Portal',
                html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Welcome to SmartNiwas</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>You have been added to the household **SmartNiwas Cash Flow & Bills** management portal.</p>
                    <p>To access the system and configure your password for the first time, please follow these instructions:</p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6366f1;">
                      <ol style="margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Open the portal: <a href="https://cashflow.smartniwas.com" target="_blank" style="color: #6366f1; font-weight: bold; text-decoration: none;">https://cashflow.smartniwas.com</a></li>
                        <li style="margin-bottom: 8px;">Log in using your email address: <strong>${email.toLowerCase()}</strong></li>
                        <li style="margin-bottom: 0;">Type <strong>any password</strong> of your choice in the password box. This will automatically become your password.</li>
                      </ol>
                    </div>
                    <p style="font-size: 0.9rem; color: #666;">If you have any questions, please contact the household administrator.</p>
                    <p style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px; font-size: 0.85rem; color: #999;">Best regards,<br>SmartNiwas Admin</p>
                  </div>
                `
              })
            });
          } catch (mailErr) {
            console.error('Failed to send invite email:', mailErr);
          }
        }

        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      return new Response(JSON.stringify({ error: 'Route Not Found' }), { status: 404, headers: CORS_HEADERS });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
  },

  // ----------------------------------------------------
  // AUTOMATED CRON RUNNER (Runs daily at 8:00 AM)
  // ----------------------------------------------------
  async scheduled(event, env, ctx) {
    console.log('Starting daily cash flow reminder audit...');

    // Resend configuration validation
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured on the Worker environment.');
      return;
    }

    try {
      // Find default fallback administrator
      const defaultAdmin = await env.DB.prepare("SELECT email, name FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").first();
      const adminEmail = defaultAdmin ? defaultAdmin.email : null;
      const adminName = defaultAdmin ? defaultAdmin.name : 'Administrator';

      if (!adminEmail) {
        console.error('No admin recipient is registered in the database.');
        return;
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Fetch active payments
      const { results: activePayments } = await env.DB.prepare(
        'SELECT p.*, u.name as assignee_name, u.email as assignee_email FROM payments p LEFT JOIN users u ON p.user_id = u.id WHERE p.status = "active"'
      ).all();

      for (const p of activePayments) {
        const dueDate = new Date(p.next_due_date);
        
        // Calculate difference in days
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let shouldSend = false;
        let reason = '';

        if (diffDays < 0) {
          const absDaysPast = Math.abs(diffDays);
          // Overdue schedule: 1, 3, 7, 14 days and every 7 days after
          if (absDaysPast === 1 || absDaysPast === 3 || absDaysPast === 7 || absDaysPast === 14 || (absDaysPast > 0 && absDaysPast % 7 === 0)) {
            shouldSend = true;
            reason = `Overdue by ${absDaysPast} days`;
          }
        } else if (diffDays === 7) {
          shouldSend = true;
          reason = 'Due in 7 days';
        } else if (diffDays === 3) {
          shouldSend = true;
          reason = 'Due in 3 days';
        } else if (diffDays === 0) {
          shouldSend = true;
          reason = 'Due today';
        }

        if (shouldSend) {
          const subject = `Payment Reminder: ${p.name} [${reason}]`;
          const recipientEmail = p.assignee_email || adminEmail;
          const recipientName = p.assignee_name || adminName;

          // Prevent duplicate dispatching today
          const logCheck = await env.DB.prepare(
            'SELECT id FROM email_logs WHERE payment_id = ? AND recipient = ? AND subject = ? AND DATE(sent_at) = ? AND status = "Success"'
          ).bind(p.id, recipientEmail, subject, todayStr).first();

          if (logCheck) {
            console.log(`Skipped duplicate reminder for ${p.name} to ${recipientEmail}`);
            continue;
          }

          const amountFormatted = parseFloat(p.amount).toFixed(2);
          const notesSection = p.notes ? `<p style="background-color:#f3f4f6; padding:10px; border-radius:4px; font-family:monospace; color:#4b5563;"><strong>Reference/Notes:</strong><br>${p.notes}</p>` : '';
          const statusColor = diffDays < 0 ? '#ef4444' : (diffDays <= 3 ? '#f59e0b' : '#3b82f6');

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color:#ffffff;">
                <div style="background-color: #0b0f19; padding: 24px; text-align: center; border-bottom: 2px solid ${statusColor};">
                    <h2 style="color:#ffffff; margin:0; font-size:20px; font-weight:700;">SmartNiwas Reminder</h2>
                </div>
                <div style="padding: 24px; color:#1f2937;">
                    <p style="font-size:16px; margin-top:0;">Hello ${recipientName},</p>
                    <p style="font-size:15px; line-height:1.5;">This is an automated reminder that you have a scheduled recurring payment coming up.</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
                        <table style="width:100%; border-collapse:collapse;">
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Bill Name:</td>
                                <td style="padding: 6px 0; font-size:15px; font-weight:bold;">${p.name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Category:</td>
                                <td style="padding: 6px 0; font-size:15px;">${p.category}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Amount:</td>
                                <td style="padding: 6px 0; font-size:16px; font-weight:bold; color:${statusColor};">₹${amountFormatted}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Frequency:</td>
                                <td style="padding: 6px 0; font-size:15px; text-transform:capitalize;">${p.frequency}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Due Date:</td>
                                <td style="padding: 6px 0; font-size:15px; font-weight:bold;">${p.next_due_date}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size:14px; color:#64748b;">Status:</td>
                                <td style="padding: 6px 0; font-size:14px;"><span style="background-color:#fee2e2; color:#ef4444; padding:2px 8px; border-radius:99px; font-weight:bold; font-size:11px;">${reason}</span></td>
                            </tr>
                        </table>
                    </div>
                    
                    ${notesSection}
                    
                    <p style="font-size:14px; color:#64748b; margin-top:24px;">
                        Once paid, please log in to your SmartNiwas dashboard to mark this payment as paid.
                    </p>
                </div>
                <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color:#64748b;">
                    SmartNiwas Reminders. Sent automatically via Cloudflare Workers Cron.
                </div>
            </div>`;

          // Call Resend REST API
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'SmartNiwas Reminders <reminders@smartniwas.com>',
              to: recipientEmail,
              subject: subject,
              html: emailHtml
            })
          });

          const success = emailResponse.ok;
          const resText = await emailResponse.text();

          await env.DB.prepare('INSERT INTO email_logs (payment_id, recipient, subject, status, error_message) VALUES (?, ?, ?, ?, ?)')
            .bind(p.id, recipientEmail, subject, success ? 'Success' : 'Failed', success ? 'Reminder Sent' : resText)
            .run();
        }
      }

      // ----------------------------------------------------
      // MONTHLY FLOW REPORTS (Dispatched on the 1st of the month)
      // ----------------------------------------------------
      if (today.getDate() === 1) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthYear = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
        
        const { results: allUsers } = await env.DB.prepare('SELECT id, email, name, role FROM users').all();
        const twoMonthsLimit = new Date();
        twoMonthsLimit.setMonth(today.getMonth() + 2);
        const twoMonthsLimitStr = twoMonthsLimit.toISOString().split('T')[0];

        for (const user of allUsers) {
          const reportSubject = `SmartNiwas: Monthly Cash Flow Report - ${monthYear}`;

          // Filter payments due soon that are assigned to user (or all if admin)
          const userPayments = activePayments.filter(p => p.next_due_date <= twoMonthsLimitStr && (user.role === 'admin' || p.user_id === user.id));

          if (userPayments.length === 0 && user.role !== 'admin') {
            continue; // Skip standard users with no tasks
          }

          let activeCount = 0;
          let monthlyFlow = 0.0;
          let tableRowsHtml = '';

          for (const p of userPayments) {
            activeCount++;
            const amount = parseFloat(p.amount);
            let normalized = 0.0;

            if (p.frequency === 'monthly') {
              normalized = amount;
            } else if (p.frequency === 'quarterly') {
              normalized = amount / 3.0;
            } else if (p.frequency === 'annual') {
              normalized = amount / 12.0;
            }

            monthlyFlow += normalized;
            const assigneeCell = user.role === 'admin' ? `<td style="padding: 10px; font-size:13px; color:#64748b;">${p.assignee_name || 'Unassigned'}</td>` : '';

            tableRowsHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-size:14px;"><strong>${p.name}</strong><br><span style="font-size:11px; color:#64748b;">${p.category}</span></td>
                  <td style="padding: 10px; font-size:14px; text-transform:capitalize;">${p.frequency}</td>
                  ${assigneeCell}
                  <td style="padding: 10px; font-size:14px; font-weight:600;">₹${amount.toFixed(2)}</td>
                  <td style="padding: 10px; font-size:14px; font-weight:600; color:#3b82f6;">₹${normalized.toFixed(2)}</td>
                  <td style="padding: 10px; font-size:14px;">${p.next_due_date}</td>
              </tr>`;
          }

          if (activeCount === 0) {
            tableRowsHtml = 'tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">No active payment commitments tracked.</td></tr>';
          }

          const adminHeaderCell = user.role === 'admin' ? '<th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Assignee</th>' : '';

          const reportHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color:#ffffff;">
                <div style="background-color: #0b0f19; padding: 24px; text-align: center;">
                    <h2 style="color:#ffffff; margin:0; font-size:20px; font-weight:700;">Monthly Cash Flow Summary</h2>
                    <p style="color:#94a3b8; margin:5px 0 0 0; font-size:14px;">${monthYear}</p>
                </div>
                <div style="padding: 24px; color:#1f2937;">
                    <p style="font-size:16px;">Hello ${user.name},</p>
                    <p style="font-size:15px;">Here is your cash flow and upcoming recurring expenses report for payments due in the next two months (until ${twoMonthsLimit.toLocaleDateString(undefined, {month: 'short', year: 'numeric', day: 'numeric'})}).</p>
                    
                    <div style="display:flex; margin: 20px 0; gap: 15px;">
                        <div style="flex:1; background-color: #f8fafc; border: 1px solid #e2e8f0; padding:15px; border-radius:6px; text-align:center;">
                            <span style="font-size:12px; color:#64748b; text-transform:uppercase;">Monthly Outflow</span>
                            <div style="font-size:22px; font-weight:bold; color:#2563eb; margin-top:5px;">₹${monthlyFlow.toFixed(2)}</div>
                        </div>
                        <div style="flex:1; background-color: #f8fafc; border: 1px solid #e2e8f0; padding:15px; border-radius:6px; text-align:center;">
                            <span style="font-size:12px; color:#64748b; text-transform:uppercase;">Active Tracked Bills</span>
                            <div style="font-size:22px; font-weight:bold; color:#1f2937; margin-top:5px;">${activeCount}</div>
                        </div>
                    </div>
                    
                    <h3 style="font-size:16px; border-bottom: 2px solid #f1f5f9; padding-bottom:8px; margin-top:30px;">Active Commitments Detail</h3>
                    <table style="width:100%; border-collapse:collapse; margin-top:10px; text-align:left;">
                        <thead>
                            <tr style="background-color:#f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Bill</th>
                                <th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Cycle</th>
                                ${adminHeaderCell}
                                <th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Amount</th>
                                <th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Monthly Cost</th>
                                <th style="padding:10px; font-size:12px; color:#64748b; text-transform:uppercase;">Next Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
                <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color:#64748b;">
                    SmartNiwas Reminders. Sent automatically via Cloudflare Workers Cron.
                </div>
            </div>`;

          const reportResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'SmartNiwas Reminders <reminders@smartniwas.com>',
              to: user.email,
              subject: reportSubject,
              html: reportHtml
            })
          });

          const reportSuccess = reportResponse.ok;
          const reportResText = await reportResponse.text();

          await env.DB.prepare('INSERT INTO email_logs (recipient, subject, status, error_message) VALUES (?, ?, ?, ?)')
            .bind(user.email, reportSubject, reportSuccess ? 'Success' : 'Failed', reportSuccess ? 'Monthly Report Delivered' : reportResText)
            .run();
        }
      }

    } catch (e) {
      console.error('Error during scheduled audit loop:', e.message);
    }
  }
};
