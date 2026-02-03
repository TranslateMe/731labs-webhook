const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET || '';

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: '731labs-webhook' });
});

// Calendly webhook endpoint
app.post('/calendly', async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (event === 'invitee.created') {
      const invitee = payload;
      const name = invitee.name || 'Unknown';
      const email = invitee.email || 'N/A';
      const eventName = invitee.scheduled_event?.name || '731 Labs Call';
      const startTime = invitee.scheduled_event?.start_time;
      const timezone = invitee.timezone || '';
      const questions = invitee.questions_and_answers || [];

      // Format date
      let dateStr = 'TBD';
      if (startTime) {
        const d = new Date(startTime);
        dateStr = d.toLocaleString('ru-RU', {
          timeZone: timezone || 'Europe/Moscow',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Build message
      let message = `🔔 <b>Новый букинг Calendly!</b>\n\n`;
      message += `👤 <b>Имя:</b> ${escapeHtml(name)}\n`;
      message += `📧 <b>Email:</b> ${escapeHtml(email)}\n`;
      message += `📅 <b>Встреча:</b> ${escapeHtml(eventName)}\n`;
      message += `🕐 <b>Дата:</b> ${escapeHtml(dateStr)}\n`;

      if (questions.length > 0) {
        message += `\n📝 <b>Дополнительно:</b>\n`;
        for (const q of questions) {
          if (q.answer) {
            message += `• ${escapeHtml(q.answer)}\n`;
          }
        }
      }

      await sendTelegram(message);
      console.log(`✅ Notification sent for: ${name} (${email})`);
    }

    if (event === 'invitee.canceled') {
      const invitee = req.body.payload;
      const name = invitee.name || 'Unknown';
      const email = invitee.email || 'N/A';

      const message = `❌ <b>Букинг отменён</b>\n\n👤 ${escapeHtml(name)}\n📧 ${escapeHtml(email)}`;
      await sendTelegram(message);
      console.log(`❌ Cancellation notification: ${name}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error('Telegram API error:', body);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

app.listen(PORT, () => {
  console.log(`731Labs webhook server running on port ${PORT}`);
});
