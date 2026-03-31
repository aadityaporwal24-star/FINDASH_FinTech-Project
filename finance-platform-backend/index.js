const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3000);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 15 * 60 * 1000);
const headersTimeoutMs = Number(process.env.HEADERS_TIMEOUT_MS || 16 * 60 * 1000);
const uploadForwardTimeoutMs = Number(process.env.UPLOAD_FORWARD_TIMEOUT_MS || 15 * 60 * 1000);
const n8nUploadWebhook =
  process.env.N8N_UPLOAD_WEBHOOK ||
  'https://codexgod.app.n8n.cloud/webhook/6e464e58-e18d-42fc-8059-99ba23c7c086';
const n8nEmailNotifyWebhook =
  process.env.N8N_EMAIL_NOTIFY_WEBHOOK ||
  'https://codexgod.app.n8n.cloud/webhook-test/9f2832c9-cd0a-46ac-92ff-69e5d8e6debe';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 60000);

const emailImapHost = process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
const emailImapPort = Number(process.env.EMAIL_IMAP_PORT || 993);
const emailImapSecure = String(process.env.EMAIL_IMAP_SECURE || 'true').toLowerCase() !== 'false';
const emailUser = process.env.EMAIL_USER || 'nitinkumarbaranawal@gmail.com';
const emailPass = process.env.EMAIL_PASS || '';
const emailInboxMailbox = process.env.EMAIL_INBOX_MAILBOX || 'INBOX';
const emailSenderAddress = process.env.EMAIL_SENDER_ADDRESS || 'nitinbaranawal24@gmail.com';
const emailDebug = String(process.env.EMAIL_DEBUG || 'false').toLowerCase() === 'true';
const profileDbUrl = process.env.PROFILE_DATABASE_URL || process.env.DATABASE_URL || '';

const uploadJobs = new Map();
let profileTableReady = false;

const profileDbPool = profileDbUrl
  ? new Pool({
      connectionString: profileDbUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

async function ensureProfileTable() {
  if (!profileDbPool || profileTableReady) return;
  const existingTable = await profileDbPool.query(`SELECT to_regclass('public.user_profiles') AS reg`);
  if (existingTable.rows?.[0]?.reg) {
    profileTableReady = true;
    return;
  }

  const orphanType = await profileDbPool.query(`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_profiles'
  `);
  if (orphanType.rows?.length) {
    await profileDbPool.query('DROP TYPE IF EXISTS public.user_profiles CASCADE');
  }

  await profileDbPool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      institution TEXT,
      role_title TEXT,
      phone TEXT,
      country TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  profileTableReady = true;
}

function sanitizeProfilePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    fullName: String(src.fullName || '').trim(),
    institution: String(src.institution || '').trim(),
    role: String(src.role || '').trim(),
    phone: String(src.phone || '').trim(),
    country: String(src.country || '').trim(),
  };
}

async function getUserProfile(userId) {
  if (!profileDbPool) {
    const err = new Error('PostgreSQL is not configured. Set PROFILE_DATABASE_URL (or DATABASE_URL).');
    err.statusCode = 500;
    throw err;
  }
  await ensureProfileTable();
  const result = await profileDbPool.query(
    `SELECT user_id, email, full_name, institution, role_title, phone, country, updated_at
     FROM user_profiles
     WHERE user_id = $1`,
    [userId],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    userId: row.user_id,
    email: row.email || '',
    fullName: row.full_name || '',
    institution: row.institution || '',
    role: row.role_title || '',
    phone: row.phone || '',
    country: row.country || '',
    updatedAt: row.updated_at,
  };
}

async function upsertUserProfile(userId, email, payload) {
  if (!profileDbPool) {
    const err = new Error('PostgreSQL is not configured. Set PROFILE_DATABASE_URL (or DATABASE_URL).');
    err.statusCode = 500;
    throw err;
  }
  await ensureProfileTable();
  const profile = sanitizeProfilePayload(payload);
  const result = await profileDbPool.query(
    `INSERT INTO user_profiles (
      user_id, email, full_name, institution, role_title, phone, country, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      institution = EXCLUDED.institution,
      role_title = EXCLUDED.role_title,
      phone = EXCLUDED.phone,
      country = EXCLUDED.country,
      updated_at = NOW()
    RETURNING user_id, email, full_name, institution, role_title, phone, country, updated_at`,
    [userId, email || null, profile.fullName, profile.institution, profile.role, profile.phone, profile.country],
  );
  const row = result.rows[0];
  return {
    userId: row.user_id,
    email: row.email || '',
    fullName: row.full_name || '',
    institution: row.institution || '',
    role: row.role_title || '',
    phone: row.phone || '',
    country: row.country || '',
    updatedAt: row.updated_at,
  };
}

function getWebhookCandidates(url) {
  if (typeof url !== 'string' || !url.trim()) return [];
  if (!url.includes('/webhook-test/')) return [url];
  return [url, url.replace('/webhook-test/', '/webhook/')];
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function extractFileNameFromDisposition(disposition, fallbackName) {
  const match = String(disposition || '').match(/filename="?([^"]+)"?/);
  return match?.[1] || fallbackName;
}

function getAttachmentFileName(attachment, fallbackName) {
  const candidate = attachment?.filename || attachment?.name;
  return candidate || fallbackName;
}

function toEmailAddressList(addresses) {
  if (!Array.isArray(addresses)) return [];
  return addresses.map((entry) => entry?.address).filter(Boolean);
}

function buildEmailErrorDetails(error, context) {
  return {
    stage: context?.stage || 'unknown',
    mailbox: context?.mailbox || emailInboxMailbox,
    host: emailImapHost,
    port: emailImapPort,
    secure: emailImapSecure,
    code: error?.code || null,
    command: error?.command || null,
    responseStatus: error?.responseStatus || null,
    responseText: error?.responseText || null,
    serverResponseCode: error?.serverResponseCode || null,
    message: error?.message || 'Unknown email error',
    stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'),
  };
}

function parseNumbersFromText(text) {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function buildStructuredData(fileName, text) {
  const lower = text.toLowerCase();
  const numbers = parseNumbersFromText(text);

  const income = numbers
    .filter((n, idx) => /income|salary|revenue/.test(lower.slice(Math.max(0, idx - 40), idx + 40)))
    .reduce((a, b) => a + Math.max(0, b), 0);

  const expense = numbers
    .filter((n, idx) => /expense|cost|outflow/.test(lower.slice(Math.max(0, idx - 40), idx + 40)))
    .reduce((a, b) => a + Math.max(0, b), 0);

  const debt = numbers
    .filter((n, idx) => /debt|loan|emi|liability/.test(lower.slice(Math.max(0, idx - 40), idx + 40)))
    .reduce((a, b) => a + Math.max(0, b), 0);

  const fallbackSum = numbers.reduce((a, b) => a + Math.abs(b), 0);

  return {
    fileName,
    extractedAt: new Date().toISOString(),
    summary: {
      numericFieldsDetected: numbers.length,
      estimatedValue: fallbackSum,
      parser: 'basic-text-parser',
    },
    totals: {
      income: income || Math.round(fallbackSum * 0.45),
      expense: expense || Math.round(fallbackSum * 0.28),
      debt: debt || Math.round(fallbackSum * 0.2),
      netWorth: Math.round(fallbackSum * 0.52),
    },
  };
}

function buildAnalytics(documents) {
  const totals = documents.reduce(
    (acc, doc) => {
      const t = doc?.totals || {};
      acc.income += Number(t.income || 0);
      acc.expense += Number(t.expense || 0);
      acc.debt += Number(t.debt || 0);
      acc.netWorth += Number(t.netWorth || 0);
      return acc;
    },
    { income: 0, expense: 0, debt: 0, netWorth: 0 },
  );

  const debtToIncome = totals.debt / Math.max(totals.income, 1);
  const expenseRatio = totals.expense / Math.max(totals.income, 1);
  const riskScore = Math.max(1, Math.min(99, Math.round(80 - debtToIncome * 30 - expenseRatio * 20)));

  return {
    totals,
    riskScore,
    riskBand: riskScore > 70 ? 'Low Risk' : riskScore > 45 ? 'Moderate Risk' : 'High Risk',
    generatedAt: new Date().toISOString(),
  };
}

function isFinanceQuestion(question) {
  const q = String(question || '').toLowerCase();
  const keywords = ['finance', 'loan', 'credit', 'debt', 'income', 'expense', 'bank', 'tax', 'investment'];
  return keywords.some((k) => q.includes(k));
}

async function fetchDuckDuckGoContext(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    const items = [];
    if (data?.AbstractText && data?.AbstractURL) {
      items.push({
        source: 'DuckDuckGo',
        title: data?.Heading || 'DuckDuckGo Summary',
        snippet: data.AbstractText,
        url: data.AbstractURL,
      });
    }

    const related = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
    for (const topic of related) {
      if (items.length >= 5) break;
      if (topic?.Text && topic?.FirstURL) {
        items.push({
          source: 'DuckDuckGo',
          title: topic.Text.split(' - ')[0]?.slice(0, 120) || 'Related Topic',
          snippet: topic.Text,
          url: topic.FirstURL,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchWikipediaContext(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'finance-platform-backend/1.0' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data?.query?.search) ? data.query.search : [];

    return rows.slice(0, 5).map((row) => ({
      source: 'Wikipedia',
      title: row?.title || 'Wikipedia Result',
      snippet: String(row?.snippet || '').replace(/<[^>]*>/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(row?.title || '').replace(/\s+/g, '_'))}`,
    }));
  } catch {
    return [];
  }
}

async function fetchInternetFinanceContext(question) {
  const q = String(question || '').trim();
  if (!q) return [];
  const [ddg, wiki] = await Promise.all([fetchDuckDuckGoContext(q), fetchWikipediaContext(q)]);

  const seen = new Set();
  const merged = [...ddg, ...wiki].filter((item) => {
    const key = `${item?.title || ''}|${item?.url || ''}`;
    if (!item?.snippet || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.slice(0, 8);
}

function sanitizeHtmlText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRbiLink(href) {
  try {
    return new URL(href, 'https://www.rbi.org.in').toString();
  } catch {
    return null;
  }
}

function extractRbiGuidelineLinks(html, sourcePage) {
  const anchors = [];
  const pattern = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const href = normalizeRbiLink(match[1]);
    if (!href || !href.includes('rbi.org.in')) continue;
    if (href.endsWith('/#') || href.endsWith('#')) continue;
    if (!/\/scripts\//i.test(href)) continue;
    const title = sanitizeHtmlText(match[2]);
    if (!title || title.length < 8) continue;
    if (!/(guideline|master direction|circular|notification|framework|compliance|prudential|policy|bank|rbi)/i.test(title)) continue;
    anchors.push({ title, url: href, source: sourcePage });
  }

  const seen = new Set();
  const deduped = [];
  for (const item of anchors) {
    const key = `${item.title.toLowerCase()}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 12) break;
  }
  return deduped;
}

async function fetchRbiGuidelines() {
  const pages = [
    { name: 'RBI Notifications', url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx' },
    { name: 'RBI Press Releases', url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx' },
    { name: 'RBI Master Directions', url: 'https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx' },
    { name: 'RBI Circular Index', url: 'https://www.rbi.org.in/Scripts/BS_ViewMasCirculardetails.aspx' },
  ];

  const responses = await Promise.all(
    pages.map(async (page) => {
      try {
        const response = await fetch(page.url);
        if (!response.ok) return [];
        const html = await response.text();
        return extractRbiGuidelineLinks(html, page.name);
      } catch {
        return [];
      }
    }),
  );

  const merged = responses.flat();
  const seen = new Set();
  const items = [];
  for (const link of merged) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    items.push(link);
    if (items.length >= 12) break;
  }

  return items;
}

function buildGeminiFinancePrompt(question, documents, analytics, internetContext, documentLinks = []) {
  const docsJson = JSON.stringify(documents, null, 2);
  const analyticsJson = JSON.stringify(analytics, null, 2);
  const webJson = JSON.stringify(internetContext, null, 2);
  const linksJson = JSON.stringify(documentLinks, null, 2);

  return [
    'You are a Senior Finance Analyst with deep expertise in retail banking statements, credit, debt, liquidity, risk, and loan feasibility.',
    'You can answer finance questions using both the provided structured data and the internet context provided below.',
    'Be precise, analytical, practical, and policy-aware. Show assumptions and calculations when possible.',
    'If data is missing, explicitly state what is missing and provide the best estimate range instead of guessing.',
    '',
    'Formatting requirements (MANDATORY):',
    '- Output plain text only (NOT markdown).',
    '- Do NOT use markdown markers like **, ##, *, _, or numbered markdown.',
    '- Use this exact heading structure in plain text:',
    '  Direct Answer:',
    '  Key Insights:',
    '  Risk View:',
    '  Action Plan:',
    '  Schemes / Rules / Policy Notes:',
    '  Sources:',
    '- Under each heading, use bullet points starting with "- ".',
    '- Keep each section concise but useful.',
    '- In Sources section, include bullet links from internet context used.',
    '',
    `User question: ${String(question || '')}`,
    '',
    `Structured analytics summary:\n${analyticsJson}`,
    '',
    `All structured documents data:\n${docsJson}`,
    '',
    `Structured document links (for reference in your answer):\n${linksJson}`,
    '',
    `Internet context (curated web snippets with links):\n${webJson}`,
  ].join('\n');
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
  }
  return out;
}

function sanitizeBulletText(line) {
  return String(line || '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]+\s*/g, '')
    .replace(/^(Direct Answer|Key Insights|Risk View|Action Plan|Schemes\s*\/\s*Rules\s*\/\s*Policy Notes|Sources)\s*:\s*/i, '')
    .replace(/^\s*[-*]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBullets(lines, fallback) {
  const usable = dedupeLines(lines.map(sanitizeBulletText).filter(Boolean)).slice(0, 6);
  if (!usable.length) return [`- ${fallback}`];
  return usable.map((line) => (line.startsWith('- ') ? line : `- ${line}`));
}

function formatAnswerAsPoints(answer, internetContext = []) {
  const cleaned = String(answer || '')
    .replace(/\*\*/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .trim();
  const sentences = splitSentences(cleaned);

  const riskLines = sentences.filter((s) => /risk|debt|cash flow|liquidity|default|exposure/i.test(s));
  const actionLines = sentences.filter((s) => /recommend|should|improve|reduce|increase|action|next step|plan/i.test(s));
  const schemeLines = sentences.filter((s) => /scheme|policy|rule|government|regulation|eligibility|tax|rbi|sebi/i.test(s));

  const direct = toBullets(sentences.slice(0, 2), 'Insufficient data for a precise direct conclusion.');
  const insights = toBullets(sentences.slice(2, 8), 'No additional data-driven insights available.');
  const risks = toBullets(riskLines, 'Risk cannot be fully assessed due to limited structured inputs.');
  const actions = toBullets(actionLines, 'Share additional transaction-level data for actionable planning.');
  const schemes = toBullets(schemeLines, 'No specific scheme/rule detail found in available context.');
  const sources = toBullets(
    internetContext.map((item) => `${item?.title || 'Source'} - ${item?.url || ''}`),
    'No external source links available.',
  );

  return [
    'Direct Answer:',
    ...direct,
    '',
    'Key Insights:',
    ...insights,
    '',
    'Risk View:',
    ...risks,
    '',
    'Action Plan:',
    ...actions,
    '',
    'Schemes / Rules / Policy Notes:',
    ...schemes,
    '',
    'Sources:',
    ...sources,
  ].join('\n');
}

async function callGeminiWithPrompt(prompt, maxOutputTokens = 2048) {
  if (!geminiApiKey) {
    const err = new Error('Gemini API key is missing. Set GEMINI_API_KEY in backend .env.');
    err.statusCode = 500;
    throw err;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), geminiTimeoutMs);

  const modelsToTry = [geminiModel, 'gemini-flash-latest', 'gemini-2.0-flash'];
  let lastError = null;

  try {
    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              topP: 0.9,
              maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          const err = new Error(`Gemini request failed (${response.status}).`);
          err.statusCode = response.status;
          err.details = text.slice(0, 500);
          // Try fallback model on 404 model not found.
          if (response.status === 404) {
            lastError = err;
            continue;
          }
          throw err;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const answer = parts.map((p) => p?.text).filter(Boolean).join('\n').trim();
        if (!answer) {
          throw new Error('Gemini returned an empty response.');
        }
        return answer;
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError') {
          const timeoutErr = new Error('Gemini request timed out.');
          timeoutErr.statusCode = 504;
          throw timeoutErr;
        }
      }
    }

    throw lastError || new Error('Gemini call failed.');
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function callGeminiFlash(question, documents, analytics, internetContext, documentLinks = []) {
  const prompt = buildGeminiFinancePrompt(question, documents, analytics, internetContext, documentLinks);
  return callGeminiWithPrompt(prompt, 2048);
}

function buildAnalystReportPrompt(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const analytics = payload?.analytics || {};
  const risk = payload?.risk || {};
  const uiContext = payload?.uiContext || {};

  return [
    'You are a senior finance analyst writing a highly practical report for an analytics dashboard.',
    'Use all provided structured document data, analytics aggregates, risk model outputs, and UI context.',
    'Give a clear, decision-oriented report in plain text.',
    '',
    'Formatting rules:',
    '- Plain text only.',
    '- No markdown symbols (** ## *).',
    '- Use these exact headings:',
    '  Executive Summary:',
    '  Data Signals:',
    '  Risk and Loan Readiness:',
    '  RBI / Regulatory Alignment:',
    '  Recommended Actions (30/60/90 days):',
    '',
    `Analytics UI context:\n${JSON.stringify(uiContext, null, 2)}`,
    '',
    `Computed analytics:\n${JSON.stringify(analytics, null, 2)}`,
    '',
    `Risk outputs:\n${JSON.stringify(risk, null, 2)}`,
    '',
    `Structured documents:\n${JSON.stringify(documents, null, 2)}`,
  ].join('\n');
}

function isReportLikelyIncomplete(reportText) {
  const text = String(reportText || '').trim();
  if (!text || text.length < 180) return true;

  const requiredHeadings = [
    'Executive Summary:',
    'Data Signals:',
    'Risk and Loan Readiness:',
    'RBI / Regulatory Alignment:',
    'Recommended Actions (30/60/90 days):',
  ];
  const headingCount = requiredHeadings.filter((h) => text.includes(h)).length;
  if (headingCount < 4) return true;
  if (/:\s*$/.test(text)) return true;
  if (!/[.!?]$/.test(text) && text.length > 350) return true;
  return false;
}

function normalizeAnalystReport(reportText, analytics, risk) {
  const text = String(reportText || '').trim();
  const safe = text || '';

  const sections = [
    ['Executive Summary:', 'Provide a concise performance summary using current totals and risk posture.'],
    ['Data Signals:', `Income ${Number(analytics?.totals?.income || 0).toFixed(2)}, expense ${Number(analytics?.totals?.expense || 0).toFixed(2)}, debt ${Number(analytics?.totals?.debt || 0).toFixed(2)}.`],
    ['Risk and Loan Readiness:', `Current risk band is ${risk?.riskBand || 'Unknown'} with score ${risk?.riskScore || 'N/A'}.`],
    ['RBI / Regulatory Alignment:', 'Review latest RBI circulars and applicable compliance directions before final credit decision.'],
    ['Recommended Actions (30/60/90 days):', 'Define a staged plan to improve surplus cash flow, lower debt ratio, and strengthen repayment profile.'],
  ];

  let normalized = safe;
  for (const [heading, fallbackLine] of sections) {
    if (!normalized.includes(heading)) {
      normalized = `${normalized}\n\n${heading}\n- ${fallbackLine}`;
    }
  }

  if (!/[.!?]$/.test(normalized.trim())) {
    normalized = `${normalized.trim()}.`;
  }
  return normalized.trim();
}

async function callGeminiAnalystReport(payload) {
  const basePrompt = buildAnalystReportPrompt(payload);
  const followupPrompt = [
    basePrompt,
    '',
    'Important retry instruction:',
    'Your previous answer was incomplete. Regenerate the full report with all required headings and complete sentences.',
  ].join('\n');

  let finalText = await callGeminiWithPrompt(basePrompt, 3000);
  if (isReportLikelyIncomplete(finalText)) {
    finalText = await callGeminiWithPrompt(followupPrompt, 3200);
  }
  return normalizeAnalystReport(finalText, payload?.analytics, payload?.risk);
}

async function forwardFileToWebhook(file) {
  const candidates = getWebhookCandidates(n8nUploadWebhook);
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const webhookUrl = candidates[i];
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), uploadForwardTimeoutMs);

    try {
      const form = new FormData();
      const fileBlob = new Blob([file.buffer], {
        type: file.mimetype || 'application/octet-stream',
      });
      form.append('file', fileBlob, file.originalname);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const error = new Error(`Upstream webhook failed with status ${response.status}.`);
        error.statusCode = response.status;
        error.details = responseText.slice(0, 300);

        // When n8n test webhook isn't listening, retry production webhook once.
        if (response.status === 404 && i < candidates.length - 1) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const outputFileName = extractFileNameFromDisposition(
        response.headers.get('content-disposition'),
        `${file.originalname.replace(/\.[^/.]+$/, '')}-structured.zip`,
      );

      return {
        buffer,
        outputFileName,
        contentType: response.headers.get('content-type') || 'application/zip',
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Upstream webhook timed out while processing this file.');
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      lastError = error;
      if (i === candidates.length - 1) throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError || new Error('Unable to forward file to webhook.');
}

async function notifySubmissionEmail(payload) {
  if (!n8nEmailNotifyWebhook) return;
  try {
    await fetch(n8nEmailNotifyWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[notify-email-webhook-error]', error?.message || 'Unknown notify webhook error');
  }
}

async function fetchLatestMailAttachment(afterUid) {
  if (!emailUser || !emailPass) {
    const err = new Error('Email credentials are missing. Configure EMAIL_USER and EMAIL_PASS.');
    err.statusCode = 500;
    throw err;
  }

  const client = new ImapFlow({
    host: emailImapHost,
    port: emailImapPort,
    secure: emailImapSecure,
    auth: { user: emailUser, pass: emailPass },
    logger: false,
  });

  let lock;
  let stage = 'connect';
  try {
    stage = 'connect';
    await client.connect();
    stage = 'mailbox_lock';
    lock = await client.getMailboxLock(emailInboxMailbox);

    const searchQuery = {};
    if (emailSenderAddress) searchQuery.from = emailSenderAddress;

    stage = 'search';
    const uids = await client.search(searchQuery, { uid: true });
    if (!uids.length) return null;

    for (let i = uids.length - 1; i >= 0; i -= 1) {
      const uid = Number(uids[i]);
      if (Number.isFinite(afterUid) && afterUid > 0 && uid <= afterUid) return null;

      let message = null;
      stage = 'fetch';
      for await (const row of client.fetch(String(uid), { uid: true, envelope: true, internalDate: true, source: true }, { uid: true })) {
        message = row;
      }
      if (!message?.source) continue;

      stage = 'parse';
      const parsed = await simpleParser(message.source);
      const attachment = parsed.attachments?.find((item) => item?.content?.length);
      if (!attachment) continue;

      return {
        uid,
        fileName: getAttachmentFileName(attachment, `structured-${uid}.zip`),
        mimeType: attachment.contentType || 'application/octet-stream',
        base64Content: attachment.content.toString('base64'),
        subject: message.envelope?.subject || '',
        from: toEmailAddressList(message.envelope?.from),
        to: toEmailAddressList(message.envelope?.to),
        sentAt: message.internalDate || new Date(),
      };
    }

    return null;
  } catch (error) {
    const wrapped = new Error(`Email fetch failed at stage "${stage}": ${error?.message || 'Unknown failure'}`);
    wrapped.statusCode = error?.statusCode || 502;
    wrapped.details = buildEmailErrorDetails(error, { stage, mailbox: emailInboxMailbox });
    throw wrapped;
  } finally {
    if (lock) lock.release();
    try {
      await client.logout();
    } catch {
      // Ignore logout issues.
    }
  }
}

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'finance-platform-backend' });
});

app.get('/profiles/:userId', async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  try {
    const profile = await getUserProfile(userId);
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    return res.json(profile);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Failed to fetch profile.',
    });
  }
});

app.put('/profiles/:userId', async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  try {
    const saved = await upsertUserProfile(userId, req.body?.email, req.body);
    return res.json(saved);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Failed to save profile.',
    });
  }
});

app.post('/documents/submit', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded. Use multipart with field name "file".' });
  }

  const file = {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    buffer: Buffer.from(req.file.buffer),
  };
  const userEmail = String(req.body?.userEmail || '').trim();

  const jobId = randomUUID();
  uploadJobs.set(jobId, {
    id: jobId,
    fileName: file.originalname,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  void notifySubmissionEmail({
    email: userEmail || null,
    fileName: file.originalname,
    jobId,
    submittedAt: new Date().toISOString(),
    source: 'finance-platform',
  });

  void (async () => {
    const job = uploadJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.updatedAt = new Date().toISOString();

    try {
      await forwardFileToWebhook(file);
      job.status = 'submitted';
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.status = 'failed';
      job.error = error?.message || 'Unknown upload error';
      job.updatedAt = new Date().toISOString();
    }
  })();

  return res.status(202).json({
    accepted: true,
    jobId,
    fileName: file.originalname,
    message: 'File accepted and sent for asynchronous processing.',
  });
});

app.get('/documents/jobs/:jobId', (req, res) => {
  const job = uploadJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found.' });
  return res.json(job);
});

app.post('/documents/structure', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded. Use multipart with field name "file".' });
  }

  try {
    const forwarded = await forwardFileToWebhook(req.file);
    res.setHeader('Content-Type', forwarded.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${forwarded.outputFileName}"`);
    return res.status(200).send(forwarded.buffer);
  } catch (error) {
    const statusCode = error?.statusCode === 504 ? 504 : 502;
    return res.status(statusCode).json({
      message: error?.message || 'Unable to reach upstream webhook for document processing.',
      details: error?.details || undefined,
    });
  }
});

app.get('/documents/latest-email-attachment', async (req, res) => {
  const afterUid = Number(req.query.afterUid || 0);

  try {
    const result = await fetchLatestMailAttachment(afterUid);
    if (!result) return res.status(204).send();

    return res.json({
      uid: result.uid,
      fileName: result.fileName,
      mimeType: result.mimeType,
      base64Content: result.base64Content,
      subject: result.subject,
      from: result.from,
      to: result.to,
      sentAt: result.sentAt,
    });
  } catch (error) {
    const details = error?.details || buildEmailErrorDetails(error, { stage: 'route_handler' });
    console.error('[email-fetch-error]', details);
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Unable to read attachment from email.',
      details: emailDebug ? details : undefined,
    });
  }
});

app.post('/analytics/report', async (req, res) => {
  const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
  const analyticsFromClient = req.body?.analytics;
  const computedAnalytics = buildAnalytics(documents);
  const analytics = analyticsFromClient && typeof analyticsFromClient === 'object'
    ? { ...computedAnalytics, ...analyticsFromClient }
    : computedAnalytics;
  const risk = req.body?.risk && typeof req.body?.risk === 'object' ? req.body.risk : {
    riskScore: computedAnalytics.riskScore,
    riskBand: computedAnalytics.riskBand,
  };
  const uiContext = req.body?.uiContext && typeof req.body?.uiContext === 'object' ? req.body.uiContext : {};

  try {
    const report = await callGeminiAnalystReport({ documents, analytics, risk, uiContext });
    return res.json({ report, analytics });
  } catch (error) {
    const fallback = [
      `Financial report generated on ${new Date().toLocaleString()}.`,
      `Income: ${Number(analytics?.totals?.income || 0).toFixed(2)} | Expense: ${Number(analytics?.totals?.expense || 0).toFixed(2)} | Debt: ${Number(analytics?.totals?.debt || 0).toFixed(2)}.`,
      `Risk classification: ${risk?.riskBand || computedAnalytics.riskBand} (score ${risk?.riskScore || computedAnalytics.riskScore}/99).`,
      'Recommendation: improve monthly surplus and reduce debt burden before seeking higher-ticket borrowing.',
    ].join(' ');
    return res.json({ report: fallback, analytics });
  }
});

app.get('/rbi/latest-guidelines', async (_, res) => {
  try {
    const links = await fetchRbiGuidelines();
    return res.json({
      generatedAt: new Date().toISOString(),
      links,
      source: 'rbi.org.in',
    });
  } catch (error) {
    return res.status(502).json({
      message: error?.message || 'Unable to fetch RBI guideline links.',
      links: [],
    });
  }
});

app.post('/chat', async (req, res) => {
  const question = req.body?.question || req.body?.message || '';
  const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
  const documentLinks = Array.isArray(req.body?.documentLinks) ? req.body.documentLinks : [];
  const analytics = buildAnalytics(documents);

  try {
    const internetContext = await fetchInternetFinanceContext(question);
    const answer = await callGeminiFlash(question, documents, analytics, internetContext, documentLinks);
    const formattedAnswer = formatAnswerAsPoints(answer, internetContext);
    return res.json({ answer: formattedAnswer, analytics, model: geminiModel, internetContext, documentLinks });
  } catch (error) {
    console.error('[chat-gemini-error]', {
      message: error?.message,
      statusCode: error?.statusCode,
      details: error?.details,
    });
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Failed to generate chatbot response.',
      analytics,
    });
  }
});

const server = app.listen(port, () => {
  console.log(`Finance backend listening on http://localhost:${port}`);
});

server.requestTimeout = requestTimeoutMs;
server.headersTimeout = headersTimeoutMs;
