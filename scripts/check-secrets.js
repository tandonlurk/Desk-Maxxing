// Fails if anything that looks like a Supabase SECRET key is in the repo.
//
// The publishable key (sb_publishable_...) is meant to be public and is fine.
// The secret key (sb_secret_...) or the legacy service_role JWT would give
// anyone full database access, so they must never be committed.
//
// Scans every tracked file plus new files that aren't gitignored.
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const checks = [
  {
    name: 'Supabase secret key (sb_secret_...)',
    regex: /sb_secret_[A-Za-z0-9_-]{16,}/g,
  },
  {
    name: 'Secret / service role key assignment',
    regex: /(SERVICE_ROLE|SECRET)_KEY\s*[:=]\s*['"]?[A-Za-z0-9_.-]{20,}/g,
  },
  {
    // Legacy keys are JWTs. Only flag ones whose payload says service_role;
    // the legacy anon key is public like the publishable key.
    name: 'Legacy service_role JWT',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g,
    isMatch: (match) => {
      try {
        const payload = Buffer.from(match[1], 'base64url').toString('utf8')
        return payload.includes('service_role')
      } catch {
        return false
      }
    },
  },
]

function listFiles() {
  const tracked = execSync('git ls-files -z', { encoding: 'utf8' })
  const untracked = execSync('git ls-files -z --others --exclude-standard', { encoding: 'utf8' })
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))]
}

const problems = []

for (const file of listFiles()) {
  // .env files hold local overrides and must stay out of git entirely.
  const base = file.split('/').pop()
  if (base.startsWith('.env') && base !== '.env.example') {
    problems.push(`${file}: .env files must not be committed (they're gitignored)`)
  }

  let text
  try {
    if (statSync(file).size > 5_000_000) continue
    text = readFileSync(file, 'utf8')
  } catch {
    continue // deleted or unreadable
  }
  if (text.includes('\0')) continue // binary file

  for (const check of checks) {
    for (const match of text.matchAll(check.regex)) {
      if (check.isMatch && !check.isMatch(match)) continue
      const line = text.slice(0, match.index).split('\n').length
      problems.push(`${file}:${line}: looks like a ${check.name}`)
    }
  }
}

if (problems.length > 0) {
  console.error('\ncheck-secrets FAILED. Remove these before committing:\n')
  for (const problem of problems) console.error('  ' + problem)
  console.error('\nIf a real secret key was ever committed, rotate it in the Supabase dashboard.\n')
  process.exit(1)
}

console.log('check-secrets: no secret keys found.')
