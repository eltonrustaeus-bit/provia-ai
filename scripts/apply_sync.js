// Wrapper — same logic as sync_supabase_questions.js, different filename
const path = require('path');
process.chdir(path.join(__dirname, '..'));
process.argv.push('--apply');
require('./sync_supabase_questions.js');
