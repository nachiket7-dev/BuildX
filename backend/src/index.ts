import 'dotenv/config';
import dns from 'dns';
import app from './app';

// Force Node to prefer IPv4 over IPv6 when resolving Supabase database URLs
// This fixes the ENETUNREACH error on networks without IPv6 support (like Render Free)
dns.setDefaultResultOrder('ipv4first');

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`\n⚡ BuildX API running on http://localhost:${PORT}`);
  console.log(`   ENV:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Groq key: ${process.env.GROQ_API_KEY ? '✓ set' : '✗ MISSING — add GROQ_API_KEY to backend/.env'}`);
  console.log(`   Get a free key at https://console.groq.com\n`);
});
