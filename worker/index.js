const RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/subscribe' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: cors });
    }

    let body;
    try { body = await request.json(); } catch { return respond({ error: 'Invalid JSON' }, 400, cors); }

    const { playerId, sendAt } = body ?? {};
    if (typeof playerId !== 'string' || !playerId) return respond({ error: 'Invalid playerId' }, 400, cors);

    const deliverAt = new Date(typeof sendAt === 'number' ? sendAt : Date.now() + 6 * 3600 * 1000).toISOString();

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id:                    env.ONESIGNAL_APP_ID,
        include_subscription_ids: [playerId],
        headings: { en: 'Tin nhắn đã bỏ lỡ' },
        contents: { en: 'Phùng Khánh Linh đã nhắn tin cho bạn.' },
        url:      RICKROLL_URL,
        send_after: deliverAt,
        icon:            'https://vlantoy.github.io/assets/icon-192.png',
        chrome_web_icon: 'https://vlantoy.github.io/assets/icon-192.png',
        large_icon:      'https://vlantoy.github.io/assets/icon-192.png',
      }),
    });

    const data = await res.json();
    return respond(res.ok ? { ok: true } : { error: data }, res.ok ? 200 : 502, cors);
  },
};

function respond(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
