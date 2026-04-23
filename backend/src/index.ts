import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`\n⚡ BuildX API running on http://localhost:${PORT}`);
  console.log(`   ENV:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Groq key: ${process.env.GROQ_API_KEY ? '✓ set' : '✗ MISSING — add GROQ_API_KEY to backend/.env'}`);
  console.log(`   Get a free key at https://console.groq.com\n`);
});
