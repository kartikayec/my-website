export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Target backend URL of the serverless Worker
  const backendBase = 'https://smartniwas-cashflow-api.kartikayec.workers.dev';

  // Construct target URL matching the pathname and search queries
  const targetUrl = new URL(url.pathname + url.search, backendBase);

  try {
    // Forward the request to the Worker backend
    const response = await fetch(new Request(targetUrl, request));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Backend Gateway Error', 
      details: err.message 
    }), {
      status: 502,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
