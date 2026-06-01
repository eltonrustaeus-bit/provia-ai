const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(match => [match[1], match[2].replace(/^['"]|['"]$/g, '')])
  );
}

async function request(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
}

function projectColumns(question) {
  return {
    id: question.id,
    category: question.category,
    question: question.question,
    option_a: question.option_a,
    option_b: question.option_b,
    option_c: question.option_c,
    option_d: question.option_d,
    correct: question.correct,
    explanation: question.explanation,
    difficulty: question.difficulty,
    image_url: question.image_url || null,
    image_description: question.image_description || null
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;
  const env = loadEnv('.env.local');
  const baseUrl = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('Missing Supabase env');

  const selectCols = 'id,category,question,option_a,option_b,option_c,option_d,correct,explanation,difficulty,image_url,image_description';
  const remote = await request(`${baseUrl}/rest/v1/driving_questions?select=${encodeURIComponent(selectCols)}`, key);
  const localQuestions = JSON.parse(fs.readFileSync('final_questions.json', 'utf8')).questions.map(projectColumns);

  fs.mkdirSync(path.join('supabase', 'backups'), { recursive: true });
  const backupPath = path.join('supabase', 'backups', `driving_questions_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(remote, null, 2)}\n`, 'utf8');

  const localIds = new Set(localQuestions.map(q => q.id));
  const remoteIds = new Set(remote.map(q => q.id));
  const deleteIds = remote.filter(q => !localIds.has(q.id)).map(q => q.id);
  const missingIds = localQuestions.filter(q => !remoteIds.has(q.id)).map(q => q.id);

  const summary = {
    dryRun,
    backupPath,
    remoteBefore: remote.length,
    localTarget: localQuestions.length,
    deleteCount: deleteIds.length,
    deleteIds,
    missingBeforeCount: missingIds.length,
    missingBeforeIds: missingIds
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (deleteIds.length) {
    const inList = `(${deleteIds.join(',')})`;
    await request(`${baseUrl}/rest/v1/driving_questions?id=in.${encodeURIComponent(inList)}`, key, {
      method: 'DELETE'
    });
  }

  for (let index = 0; index < localQuestions.length; index += 100) {
    const chunk = localQuestions.slice(index, index + 100);
    await request(`${baseUrl}/rest/v1/driving_questions?on_conflict=id`, key, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(chunk)
    });
  }

  const after = await request(`${baseUrl}/rest/v1/driving_questions?select=${encodeURIComponent(selectCols)}`, key);
  const byAfter = new Map(after.map(q => [q.id, q]));
  const mismatches = [];
  const fields = selectCols.split(',').filter(field => field !== 'id');
  for (const localQuestion of localQuestions) {
    const remoteQuestion = byAfter.get(localQuestion.id);
    if (!remoteQuestion) {
      mismatches.push({ id: localQuestion.id, diff: ['missing'] });
      continue;
    }
    const diff = fields.filter(field => String(localQuestion[field] ?? '') !== String(remoteQuestion[field] ?? ''));
    if (diff.length) mismatches.push({ id: localQuestion.id, diff });
  }
  const extraAfter = after.filter(q => !localIds.has(q.id)).map(q => q.id).sort((a, b) => a - b);

  console.log(JSON.stringify({
    ...summary,
    remoteAfter: after.length,
    extraAfterCount: extraAfter.length,
    extraAfterIds: extraAfter,
    mismatchAfterCount: mismatches.length,
    mismatchAfterSamples: mismatches.slice(0, 20)
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
