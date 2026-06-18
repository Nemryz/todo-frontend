// Vercel Serverless Function — sirve variables de entorno al cliente
// Las keys nunca aparecen hardcodeadas en el código fuente frontend
export default function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const supabaseUrl     = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const youtubeApiKey   = process.env.YOUTUBE_API_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(503).json({ error: "Service configuration unavailable" });
    }

    // apiUrl vacío = mismo origen, todas las llamadas van a /api/* (proxy Vercel)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ supabaseUrl, supabaseAnonKey, apiUrl: "/api", youtubeApiKey });
}
