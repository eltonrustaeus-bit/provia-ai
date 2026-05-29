export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { code } = req.body || {};
  const secret = process.env.ACCESS_CODE;

  if (!secret) return res.status(500).json({ error: "Server misconfigured" });
  if (!code || code.trim() !== secret) return res.status(401).json({ error: "Invalid code" });

  return res.status(200).json({ ok: true });
}
