import 'dotenv/config';
import dns from 'dns';
import app from './app';
import { getProviderHealth } from './lib/llm/router';

// Force Node to prefer IPv4 over IPv6 when resolving Supabase database URLs
// This fixes the ENETUNREACH error on networks without IPv6 support (like Render Free)
dns.setDefaultResultOrder('ipv4first');

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  const providers = getProviderHealth();
  console.log(`\n⚡ BuildX API running on http://localhost:${PORT}`);
  console.log(`   ENV:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Groq:     ${providers.groq.configured ? '✓ set' : '✗ missing — add GROQ_API_KEY'}`);
  console.log(`   Gemini:   ${providers.gemini.configured ? '✓ set' : '○ optional — GEMINI_API_KEY'}`);
  console.log(`   NVIDIA:   ${providers.nvidia.configured ? '✓ set' : '○ optional — NVIDIA_API_KEY'}`);
  if (!providers.groq.configured) {
    console.log(`   Get a free Groq key at https://console.groq.com`);
  }
  console.log('');
});
