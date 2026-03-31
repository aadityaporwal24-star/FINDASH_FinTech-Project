import { useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import gsap from 'gsap'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts'
import { UploadCloud, FileJson, Bot, ShieldCheck, LineChart, UserCircle2, PhoneCall, PhoneOff } from 'lucide-react'
import {
  askFinanceChatbot,
  fetchLatestEmailAttachment,
  fetchRbiGuidelines,
  fetchUserProfile,
  generateAIReport,
  saveUserProfile,
  uploadFinancialDocuments,
} from './api'
import { auth, googleProvider, hasFirebaseConfig } from './firebase'
import './App.css'

const FINANCE_KEYWORDS = [
  'finance',
  'loan',
  'credit',
  'debt',
  'income',
  'expense',
  'bank',
  'tax',
  'investment',
  'cashflow',
  'cash flow',
]
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID || '2ec93a92-2ab2-491f-87de-ee3c32a3a6cc'
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || ''
const i18n = {
  en: {
    portalEyebrow: 'Institution Finance Operating Hub',
    portalTitle: 'Financial Intelligence Portal',
    portalSub: 'Secure onboarding, intelligent document structuring, risk analytics, and a finance-focused assistant in one workspace.',
    getStarted: 'Get Started',
    authRequired: 'Authentication required',
    signIn: 'Sign in',
    continueGoogle: 'Continue with Google',
    useDemo: 'Use Demo Sign-in',
    email: 'Email',
    password: 'Password',
    signInEmail: 'Sign in with Email',
    createAccount: 'Create Account',
    needAccount: 'Need an account?',
    hasAccount: 'Already have an account?',
    firebaseHint: 'Set Firebase keys in `.env` to enable live auth.',
    welcome: 'Welcome',
    signOut: 'Sign out',
    profile: 'Profile',
    documents: 'Documents',
    analytics: 'Analytics',
    chatbot: 'Analyst Agent',
    userProfile: 'User Profile',
    userProfileSub: 'Edit personal and institution details.',
    fullName: 'Full Name',
    institution: 'Institution',
    role: 'Role',
    phone: 'Phone',
    country: 'Country',
    saveProfile: 'Save Profile',
    savingProfile: 'Saving...',
    profileSaved: 'Profile saved to cloud database.',
    profileSaveFailed: 'Failed to save profile.',
    profileLoadFailed: 'Failed to load profile from cloud database.',
    documentStructuring: 'Document Structuring',
    documentStructuringSub: 'Drop files to submit instantly. Processed ZIP output is pulled from your latest matching email attachment.',
    fetchMail: 'Fetch Latest Mail Attachment',
    checkingMail: 'Checking Mail...',
    rawFiles: 'Raw Financial Files',
    rawFilesSub: 'Drag and drop multiple files here or click to submit.',
    processedOutput: 'Processed Output',
    processedOutputSub: 'Download ZIP files imported from the latest matching email.',
    noStructured: 'No structured files yet.',
    analyticsTitle: 'Automated Analytics and Risk',
    analyticsSub: 'Tables, charts, graphs, risk analysis, and loan feasibility based on structured documents.',
    talkToAnalyst: 'Talk to Analyst',
    endAnalystCall: 'End Analyst Call',
    generateReport: 'Generate AI Report',
    generatingReport: 'Generating Report...',
    income: 'Income',
    expense: 'Expense',
    debt: 'Debt',
    assets: 'Assets',
    monthlyCashflow: 'Monthly Cashflow',
    docValue: 'Document Value Distribution',
    balanceTrend: 'Balance Trend (From Report ZIP Excel)',
    coreTable: 'Core Financial Table',
    recentTx: 'Recent Transactions',
    desiredLoan: 'Desired loan amount',
    repayCapacity: 'Estimated repay capacity:',
    easeApproval: 'Ease of approval:',
    aiReport: 'AI Report',
    aiReportPlaceholder: 'Click "Generate AI Report" to create an AI-driven narrative from structured files.',
    latestRbi: 'Latest RBI Rules and Guidelines',
    loadingRbi: 'Loading latest RBI links...',
    unableRbi: 'Unable to load RBI links right now.',
    chatbotTitle: 'Finance Analyst Agent',
    chatbotSub: 'This assistant is focused on finance analysis and can use your structured documents for insights.',
    chatbotPlaceholder: 'Ask about loan risk, debt trends, income anomalies, or financial projections...',
    send: 'Send',
    vgTitle: '3D Analyst Agent',
    vgSub: 'Original 3D analyst experience is embedded below.',
    langEnglish: 'English',
    langHindi: 'हिंदी',
    callLine: 'Lucentrix Analyst Line',
    callProgress: 'Call in Progress',
    callConnecting: 'Connecting Call',
    endCall: 'End Call',
    callBridge: 'Preparing secure audio bridge...',
  },
  hi: {
    portalEyebrow: 'संस्थागत वित्त संचालन हब',
    portalTitle: 'फाइनेंशियल इंटेलिजेंस पोर्टल',
    portalSub: 'सुरक्षित ऑनबोर्डिंग, स्मार्ट डॉक्यूमेंट स्ट्रक्चरिंग, रिस्क एनालिटिक्स और वित्त-केंद्रित सहायक एक ही प्लेटफॉर्म में।',
    getStarted: 'शुरू करें',
    authRequired: 'प्रमाणीकरण आवश्यक है',
    signIn: 'साइन इन',
    continueGoogle: 'Google से जारी रखें',
    useDemo: 'डेमो साइन-इन उपयोग करें',
    email: 'ईमेल',
    password: 'पासवर्ड',
    signInEmail: 'ईमेल से साइन इन',
    createAccount: 'खाता बनाएं',
    needAccount: 'खाता नहीं है?',
    hasAccount: 'पहले से खाता है?',
    firebaseHint: 'लाइव ऑथ के लिए `.env` में Firebase keys सेट करें।',
    welcome: 'स्वागत है',
    signOut: 'साइन आउट',
    profile: 'प्रोफाइल',
    documents: 'दस्तावेज़',
    analytics: 'एनालिटिक्स',
    chatbot: 'विश्लेषक एजेंट',
    userProfile: 'यूज़र प्रोफाइल',
    userProfileSub: 'व्यक्तिगत और संस्थान संबंधी जानकारी संपादित करें।',
    fullName: 'पूरा नाम',
    institution: 'संस्थान',
    role: 'भूमिका',
    phone: 'फोन',
    country: 'देश',
    saveProfile: 'प्रोफाइल सेव करें',
    savingProfile: 'सेव हो रहा है...',
    profileSaved: 'प्रोफाइल क्लाउड डेटाबेस में सेव हो गई।',
    profileSaveFailed: 'प्रोफाइल सेव नहीं हो सकी।',
    profileLoadFailed: 'क्लाउड डेटाबेस से प्रोफाइल लोड नहीं हो सकी।',
    documentStructuring: 'दस्तावेज़ संरचना',
    documentStructuringSub: 'फाइल तुरंत सबमिट करें। प्रोसेस्ड ZIP नवीनतम मिलते-जुलते ईमेल अटैचमेंट से लिया जाता है।',
    fetchMail: 'नवीनतम मेल अटैचमेंट लाएँ',
    checkingMail: 'मेल जांच रहे हैं...',
    rawFiles: 'रॉ वित्तीय फाइलें',
    rawFilesSub: 'एकाधिक फाइलें ड्रैग-ड्रॉप करें या क्लिक करें।',
    processedOutput: 'प्रोसेस्ड आउटपुट',
    processedOutputSub: 'नवीनतम मेल से आयी ZIP फाइल डाउनलोड करें।',
    noStructured: 'अभी कोई structured फाइल नहीं है।',
    analyticsTitle: 'ऑटोमेटेड एनालिटिक्स और रिस्क',
    analyticsSub: 'structured दस्तावेज़ों के आधार पर टेबल, चार्ट, ग्राफ, रिस्क और लोन व्यवहार्यता।',
    talkToAnalyst: 'विश्लेषक से बात करें',
    endAnalystCall: 'विश्लेषक कॉल समाप्त करें',
    generateReport: 'AI रिपोर्ट बनाएं',
    generatingReport: 'रिपोर्ट बन रही है...',
    income: 'आय',
    expense: 'खर्च',
    debt: 'ऋण',
    assets: 'संपत्तियां',
    monthlyCashflow: 'मासिक कैशफ्लो',
    docValue: 'दस्तावेज़ मूल्य वितरण',
    balanceTrend: 'बैलेंस ट्रेंड (रिपोर्ट ZIP Excel से)',
    coreTable: 'मुख्य वित्तीय तालिका',
    recentTx: 'हाल के लेन-देन',
    desiredLoan: 'वांछित लोन राशि',
    repayCapacity: 'अनुमानित पुनर्भुगतान क्षमता:',
    easeApproval: 'स्वीकृति की आसानी:',
    aiReport: 'AI रिपोर्ट',
    aiReportPlaceholder: 'structured फाइलों से AI रिपोर्ट बनाने के लिए "AI रिपोर्ट बनाएं" क्लिक करें।',
    latestRbi: 'नवीनतम RBI नियम और दिशानिर्देश',
    loadingRbi: 'नवीनतम RBI लिंक लोड हो रहे हैं...',
    unableRbi: 'अभी RBI लिंक लोड नहीं हो पा रहे हैं।',
    chatbotTitle: 'फाइनेंस विश्लेषक एजेंट',
    chatbotSub: 'यह सहायक वित्तीय विश्लेषण पर केंद्रित है और आपके structured दस्तावेज़ों का उपयोग कर सकता है।',
    chatbotPlaceholder: 'लोन रिस्क, ऋण रुझान, आय विसंगतियां या वित्तीय प्रोजेक्शन पूछें...',
    send: 'भेजें',
    vgTitle: '3D विश्लेषक एजेंट',
    vgSub: 'नीचे मूल 3D analyst अनुभव एम्बेड किया गया है।',
    langEnglish: 'English',
    langHindi: 'हिंदी',
    callLine: 'Lucentrix विश्लेषक लाइन',
    callProgress: 'कॉल जारी है',
    callConnecting: 'कॉल कनेक्ट हो रही है',
    endCall: 'कॉल समाप्त करें',
    callBridge: 'सुरक्षित ऑडियो ब्रिज तैयार हो रहा है...',
  },
}

function formatCallDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function normalizeUiReport(reportText) {
  const text = String(reportText || '').trim()
  if (!text) return ''
  if (!/[.!?]$/.test(text)) return `${text}.`
  return text
}

function LanguageToggle({ language, onToggle, t }) {
  return (
    <label className="language-toggle" aria-label="Language switch">
      <span className={language === 'en' ? 'active' : ''}>{t('langEnglish')}</span>
      <button type="button" className={`toggle-track ${language === 'hi' ? 'hi' : 'en'}`} onClick={onToggle}>
        <span className="toggle-thumb" />
      </button>
      <span className={language === 'hi' ? 'active' : ''}>{t('langHindi')}</span>
    </label>
  )
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseTransactionDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const dateCode = XLSX.SSF.parse_date_code(value)
    if (!dateCode) return null
    return new Date(dateCode.y, dateCode.m - 1, dateCode.d)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function inferBalanceTimeline(transactions) {
  const balances = transactions
    .map((row) => row.balance)
    .filter((value) => Number.isFinite(value) && value !== 0)
  if (!balances.length) return { minBalance: 0, maxBalance: 0, closingBalance: 0 }

  return {
    minBalance: Math.min(...balances),
    maxBalance: Math.max(...balances),
    closingBalance: balances[balances.length - 1],
  }
}

function buildStructuredFromTransactions(fileName, transactions) {
  const totals = transactions.reduce(
    (acc, row) => {
      const debit = Number(row.debit || 0)
      const credit = Number(row.credit || 0)
      acc.expense += Math.max(0, debit)
      acc.income += Math.max(0, credit)
      return acc
    },
    { income: 0, expense: 0 },
  )

  const debt = Math.max(0, totals.expense * 0.25)
  const balanceStats = inferBalanceTimeline(transactions)
  const netWorth = Math.max(balanceStats.closingBalance, totals.income - totals.expense)

  return {
    fileName,
    extractedAt: new Date().toISOString(),
    summary: {
      parser: 'zip-excel-transaction-parser',
      transactionCount: transactions.length,
      estimatedValue: totals.income + totals.expense,
    },
    totals: {
      income: totals.income,
      expense: totals.expense,
      debt,
      asset: Math.max(0, balanceStats.closingBalance),
      netWorth,
      minBalance: balanceStats.minBalance,
      maxBalance: balanceStats.maxBalance,
      closingBalance: balanceStats.closingBalance,
    },
    transactions,
  }
}

function parseTransactionsFromMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) return []
  const headerRow = matrix[0].map((value) => normalizeHeader(value))

  const dateIdx = headerRow.findIndex((h) => h.includes('date'))
  const descriptionIdx = headerRow.findIndex((h) => h.includes('description') || h.includes('narration') || h.includes('particular'))
  const debitIdx = headerRow.findIndex((h) => h.includes('debit') || h === 'dr')
  const creditIdx = headerRow.findIndex((h) => h.includes('credit') || h === 'cr')
  const balanceIdx = headerRow.findIndex((h) => h.includes('balance'))

  if (dateIdx < 0 || descriptionIdx < 0 || debitIdx < 0 || creditIdx < 0 || balanceIdx < 0) return []

  return matrix
    .slice(1)
    .map((row) => {
      const date = parseTransactionDate(row[dateIdx])
      const debit = parseAmount(row[debitIdx])
      const credit = parseAmount(row[creditIdx])
      const balance = parseAmount(row[balanceIdx])
      const description = String(row[descriptionIdx] || '').trim()
      if (!date || !description || (debit === 0 && credit === 0 && balance === 0)) return null

      return {
        date: date.toISOString(),
        description,
        debit: Math.max(0, debit),
        credit: Math.max(0, credit),
        balance,
      }
    })
    .filter(Boolean)
}

async function parseTransactionsFromZipBlob(zipBlob) {
  try {
    const zipBuffer = await zipBlob.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)
    const excelEntry = Object.values(zip.files).find(
      (file) => !file.dir && /\.(xlsx|xls|csv)$/i.test(file.name),
    )
    if (!excelEntry) return []

    if (/\.csv$/i.test(excelEntry.name)) {
      const csvText = await excelEntry.async('string')
      const wb = XLSX.read(csvText, { type: 'string' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true })
      return parseTransactionsFromMatrix(matrix)
    }

    const excelBuffer = await excelEntry.async('arraybuffer')
    const wb = XLSX.read(excelBuffer, { type: 'array' })
    const firstSheet = wb.Sheets[wb.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true })
    return parseTransactionsFromMatrix(matrix)
  } catch {
    return []
  }
}

function classifyMetric(key) {
  const k = key.toLowerCase()
  if (k.includes('income') || k.includes('revenue') || k.includes('salary')) return 'income'
  if (k.includes('expense') || k.includes('cost') || k.includes('outflow')) return 'expense'
  if (k.includes('debt') || k.includes('liability') || k.includes('loan')) return 'debt'
  if (k.includes('asset') || k.includes('saving') || k.includes('investment')) return 'asset'
  return null
}

function aggregateStructuredFiles(structuredFiles) {
  const totals = { income: 0, expense: 0, debt: 0, asset: 0 }
  const documentBreakdown = []
  const cashflowByMonth = {}
  const transactionRows = []

  const walk = (value, keyHint = '') => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const bucket = classifyMetric(keyHint)
      if (bucket) totals[bucket] += value
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && typeof item === 'object' && item.date && (typeof item.amount === 'number' || typeof item.debit === 'number' || typeof item.credit === 'number')) {
          const month = new Date(item.date).toLocaleString('en-US', { month: 'short' })
          if (!cashflowByMonth[month]) cashflowByMonth[month] = { month, inflow: 0, outflow: 0 }
          if (typeof item.amount === 'number') {
            if (item.amount >= 0) cashflowByMonth[month].inflow += item.amount
            else cashflowByMonth[month].outflow += Math.abs(item.amount)
          } else {
            cashflowByMonth[month].inflow += Number(item.credit || 0)
            cashflowByMonth[month].outflow += Number(item.debit || 0)
          }
        }
        walk(item, keyHint)
      })
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, nestedValue]) => walk(nestedValue, key))
    }
  }

  structuredFiles.forEach((doc) => {
    const structured = doc.structuredData || {}
    const transactions = Array.isArray(doc.transactions) ? doc.transactions : Array.isArray(structured.transactions) ? structured.transactions : []
    if (transactions.length) {
      transactions.forEach((row) => {
        totals.income += Number(row.credit || 0)
        totals.expense += Number(row.debit || 0)
        transactionRows.push({
          ...row,
          sourceFile: doc.fileName,
        })
      })
      walk(transactions, 'transactions')
      const lastBalance = Number(transactions[transactions.length - 1]?.balance || 0)
      totals.asset += Math.max(0, lastBalance)
    } else {
      walk(structured)
    }

    documentBreakdown.push({
      name: doc.fileName,
      value:
        Math.max(
          transactions.reduce((acc, row) => acc + Math.abs(Number(row.debit || 0)) + Math.abs(Number(row.credit || 0)), 0),
          Number(structured?.summary?.estimatedValue) || 0,
          Number(structured?.totals?.netWorth) || 0,
          Number(structured?.totals?.income) || 0,
          1,
        ) || 1,
    })
  })

  let monthlySeries = Object.values(cashflowByMonth)
  if (!monthlySeries.length) {
    monthlySeries = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => ({
      month,
      inflow: Math.max(0, totals.income / 6 + idx * 100),
      outflow: Math.max(0, totals.expense / 6 + idx * 70),
    }))
  }
  if (totals.debt <= 0) totals.debt = totals.expense * 0.25

  return {
    totals,
    documentBreakdown,
    monthlySeries,
    transactionRows,
    netMonthly: Math.max(0, (totals.income - totals.expense) / 12),
  }
}

function getRiskAndLoanInsights(analytics, requestedLoanAmount) {
  const income = analytics.totals.income
  const expense = analytics.totals.expense
  const debt = analytics.totals.debt
  const assets = analytics.totals.asset

  const debtToIncome = debt / Math.max(income, 1)
  const expenseRatio = expense / Math.max(income, 1)
  const assetCoverage = assets / Math.max(debt, 1)

  const riskScore = Math.max(1, Math.min(99, Math.round(78 - debtToIncome * 30 - expenseRatio * 20 + assetCoverage * 14)))
  const riskBand = riskScore > 72 ? 'Low Risk' : riskScore > 45 ? 'Moderate Risk' : 'High Risk'

  const repayCapacity = Math.max(0, analytics.netMonthly * 24 + assets * 0.25 - debt * 0.3)
  const affordability = repayCapacity / Math.max(requestedLoanAmount, 1)
  const ease = affordability > 1.3 ? 'High' : affordability > 0.85 ? 'Medium' : 'Low'

  return { riskScore, riskBand, repayCapacity, ease }
}

function getDetailedLoanEstimator(analytics, options) {
  const loanProfiles = {
    home: { foir: 0.55, ltv: 0.8, riskBuffer: 0.92 },
    personal: { foir: 0.4, ltv: 1, riskBuffer: 0.76 },
    business: { foir: 0.5, ltv: 0.7, riskBuffer: 0.84 },
    vehicle: { foir: 0.48, ltv: 0.85, riskBuffer: 0.88 },
    education: { foir: 0.42, ltv: 0.9, riskBuffer: 0.82 },
  }

  const profile = loanProfiles[options.loanType] || loanProfiles.personal
  const monthlyIncome = Math.max(0, Number(analytics.netMonthly || 0))
  const existingObligations = Math.max(0, Number(options.existingEmi || 0))
  const tenureMonths = Math.max(12, Math.round(Number(options.tenureYears || 1) * 12))
  const annualRate = Math.max(0, Number(options.interestRate || 0))
  const monthlyRate = annualRate / 12 / 100
  const requestedAmount = Math.max(0, Number(options.requestedAmount || 0))
  const collateralValue = Math.max(0, Number(options.collateralValue || 0))
  const employmentFactor = options.employmentType === 'selfEmployed' ? 0.9 : 1

  const maxAffordableEmi = Math.max(0, monthlyIncome * profile.foir * employmentFactor - existingObligations)
  const principalByEmi =
    monthlyRate > 0
      ? maxAffordableEmi * ((1 + monthlyRate) ** tenureMonths - 1) / (monthlyRate * (1 + monthlyRate) ** tenureMonths)
      : maxAffordableEmi * tenureMonths
  const principalByCollateral = profile.ltv >= 1 ? Number.POSITIVE_INFINITY : collateralValue * profile.ltv
  const eligibleBeforeBuffer = Math.min(principalByEmi, principalByCollateral)
  const eligibleAmount = Math.max(0, eligibleBeforeBuffer * profile.riskBuffer)
  const estimatedEmiForRequested =
    monthlyRate > 0
      ? requestedAmount * monthlyRate * (1 + monthlyRate) ** tenureMonths / ((1 + monthlyRate) ** tenureMonths - 1)
      : requestedAmount / tenureMonths
  const approvalRatio = requestedAmount > 0 ? eligibleAmount / requestedAmount : 0

  const approvalSignal = approvalRatio >= 1.15
    ? 'Strong'
    : approvalRatio >= 0.85
      ? 'Borderline'
      : 'Weak'

  const scenarios = [
    { label: 'Conservative', amount: eligibleAmount * 0.85 },
    { label: 'Balanced', amount: eligibleAmount },
    { label: 'Stretch', amount: eligibleAmount * 1.1 },
  ].map((item) => ({
    ...item,
    amount: Math.max(0, item.amount),
  }))

  return {
    monthlyIncome,
    maxAffordableEmi,
    estimatedEmiForRequested,
    eligibleAmount,
    approvalSignal,
    approvalRatio,
    tenureMonths,
    scenarios,
    foirUsed: profile.foir * employmentFactor,
  }
}

function createFallbackFinanceAnswer(question, analytics) {
  const isFinanceQuestion = FINANCE_KEYWORDS.some((keyword) => question.toLowerCase().includes(keyword))
  if (!isFinanceQuestion) {
    return 'I can only answer finance-focused questions. Try asking about loan readiness, risk, cash flow, debt, or income trends.'
  }

  return `Based on your uploaded records, total income is about ${analytics.totals.income.toFixed(2)}, expenses are ${analytics.totals.expense.toFixed(2)}, debt is ${analytics.totals.debt.toFixed(2)}, and assets are ${analytics.totals.asset.toFixed(2)}. Focus on reducing debt-to-income ratio and strengthening monthly surplus to improve loan outcomes.`
}

function App() {
  const shellRef = useRef(null)
  const heroRef = useRef(null)
  const downloadUrlsRef = useRef([])
  const structuredFilesRef = useRef([])
  const [hasEntered, setHasEntered] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [authMode, setAuthMode] = useState('signin')
  const [language, setLanguage] = useState('en')
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [profile, setProfile] = useState({
    fullName: '',
    institution: '',
    role: '',
    phone: '',
    country: 'India',
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [uploadQueue, setUploadQueue] = useState([])
  const [structuredFiles, setStructuredFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [mailSyncing, setMailSyncing] = useState(false)
  const [mailSyncMessage, setMailSyncMessage] = useState('')
  const [lastEmailUid, setLastEmailUid] = useState(0)
  const lastEmailUidRef = useRef(0)
  const autoFetchTimeoutRef = useRef(null)
  const pendingAutoFetchCountRef = useRef(0)
  const autoFetchInFlightRef = useRef(false)

  const [aiReport, setAiReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [requestedLoanAmount, setRequestedLoanAmount] = useState(1500000)
  const [loanType, setLoanType] = useState('home')
  const [tenureYears, setTenureYears] = useState(15)
  const [interestRate, setInterestRate] = useState(9.5)
  const [existingEmi, setExistingEmi] = useState(12000)
  const [collateralValue, setCollateralValue] = useState(3000000)
  const [employmentType, setEmploymentType] = useState('salaried')

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'I am your finance specialist assistant. Ask me about cash flow, risk, loan feasibility, debt, or insights from uploaded documents.',
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)
  const [agentZoomed, setAgentZoomed] = useState(true)
  const [analystCallActive, setAnalystCallActive] = useState(false)
  const [analystCallStatus, setAnalystCallStatus] = useState('')
  const [analystCallOverlayOpen, setAnalystCallOverlayOpen] = useState(false)
  const [analystCallStartedAt, setAnalystCallStartedAt] = useState(0)
  const [analystCallElapsedSec, setAnalystCallElapsedSec] = useState(0)
  const [rbiLinks, setRbiLinks] = useState([])
  const [rbiLoading, setRbiLoading] = useState(false)
  const vapiRef = useRef(null)
  const t = (key) => i18n[language]?.[key] || i18n.en[key] || key
  const toggleLanguage = () => setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'))
  const tabs = [
    { id: 'profile', label: t('profile'), icon: UserCircle2 },
    { id: 'documents', label: t('documents'), icon: UploadCloud },
    { id: 'analytics', label: t('analytics'), icon: LineChart },
    { id: 'chatbot', label: t('chatbot'), icon: Bot },
  ]

  const analytics = useMemo(() => aggregateStructuredFiles(structuredFiles), [structuredFiles])
  const risk = useMemo(() => getRiskAndLoanInsights(analytics, Number(requestedLoanAmount) || 0), [analytics, requestedLoanAmount])
  const loanEstimator = useMemo(
    () =>
      getDetailedLoanEstimator(analytics, {
        loanType,
        tenureYears,
        interestRate,
        existingEmi,
        requestedAmount: requestedLoanAmount,
        collateralValue,
        employmentType,
      }),
    [analytics, loanType, tenureYears, interestRate, existingEmi, requestedLoanAmount, collateralValue, employmentType],
  )
  const riskFactorSeries = useMemo(() => {
    const income = Math.max(1, Number(analytics.totals.income || 0))
    const expense = Math.max(0, Number(analytics.totals.expense || 0))
    const debt = Math.max(0, Number(analytics.totals.debt || 0))
    const assets = Math.max(0, Number(analytics.totals.asset || 0))
    const emiStress = loanEstimator.maxAffordableEmi > 0
      ? Math.min(100, Math.max(0, (loanEstimator.estimatedEmiForRequested / loanEstimator.maxAffordableEmi) * 100))
      : 100

    return [
      { factor: 'Debt Load', score: Math.min(100, (debt / income) * 100) },
      { factor: 'Expense Pressure', score: Math.min(100, (expense / income) * 100) },
      { factor: 'Asset Cushion', score: Math.max(0, 100 - Math.min(100, (debt / Math.max(assets, 1)) * 100)) },
      { factor: 'EMI Stress', score: emiStress },
      { factor: 'Overall Risk', score: risk.riskScore },
    ]
  }, [analytics.totals.income, analytics.totals.expense, analytics.totals.debt, analytics.totals.asset, loanEstimator.maxAffordableEmi, loanEstimator.estimatedEmiForRequested, risk.riskScore])
  const balanceTrend = useMemo(
    () =>
      [...analytics.transactionRows]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-40)
        .map((row) => ({
          date: new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          balance: Number(row.balance || 0),
        })),
    [analytics.transactionRows],
  )

  const buildAttachmentRecord = async (attachment) => {
    const transactions = await parseTransactionsFromZipBlob(attachment.zipBlob)
    const structuredData = buildStructuredFromTransactions(attachment.fileName, transactions)
    const downloadUrl = URL.createObjectURL(attachment.zipBlob)
    downloadUrlsRef.current.push(downloadUrl)
    return {
      ...attachment,
      downloadUrl,
      transactions,
      structuredData,
    }
  }

  useEffect(() => {
    setChatMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== 'assistant') return prev
      return [
        {
          role: 'assistant',
          text:
            language === 'hi'
              ? 'मैं आपका फाइनेंस स्पेशलिस्ट सहायक हूँ। कैश फ्लो, रिस्क, लोन व्यवहार्यता, ऋण या अपलोड दस्तावेज़ों से इनसाइट्स पूछें।'
              : 'I am your finance specialist assistant. Ask me about cash flow, risk, loan feasibility, debt, or insights from uploaded documents.',
        },
      ]
    })
  }, [language])

  useEffect(() => {
    structuredFilesRef.current = structuredFiles
  }, [structuredFiles])

  useEffect(() => {
    return () => {
      downloadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current)
      }
      pendingAutoFetchCountRef.current = 0
      autoFetchInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    lastEmailUidRef.current = lastEmailUid
  }, [lastEmailUid])

  useEffect(() => {
    if (!hasEntered) return undefined

    const ctx = gsap.context(() => {
      if (heroRef.current) {
        gsap.from(heroRef.current, {
          opacity: 0,
          y: -20,
          duration: 0.9,
          ease: 'power2.out',
        })
      }

      gsap.from('.card', {
        opacity: 0,
        y: 20,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.08,
        delay: 0.12,
      })
    }, shellRef)

    return () => ctx.revert()
  }, [hasEntered, activeTab])

  useEffect(() => {
    if (hasEntered) return undefined

    const ctx = gsap.context(() => {
      gsap.from('.landing-brand', {
        opacity: 0,
        y: 22,
        duration: 0.9,
        ease: 'power3.out',
      })
      gsap.from('.landing-quote', {
        opacity: 0,
        y: 16,
        duration: 0.8,
        delay: 0.16,
        ease: 'power3.out',
      })
      gsap.from('.landing-cta', {
        opacity: 0,
        scale: 0.94,
        duration: 0.72,
        delay: 0.3,
        ease: 'back.out(1.5)',
      })
    }, shellRef)

    return () => ctx.revert()
  }, [hasEntered])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return undefined

    const updateGlobalLight = (event) => {
      gsap.to(shell, {
        '--mx': `${event.clientX}px`,
        '--my': `${event.clientY}px`,
        duration: 0.22,
        overwrite: 'auto',
        ease: 'power3.out',
      })

      const pupils = Array.from(document.querySelectorAll('.geo-pupil'))
      pupils.forEach((pupil) => {
        const eye = pupil.parentElement
        if (!eye) return
        const rect = eye.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = event.clientX - cx
        const dy = event.clientY - cy
        const angle = Math.atan2(dy, dx)
        const distance = Math.min(4.8, Math.hypot(dx, dy) / 26)
        const tx = Math.cos(angle) * distance
        const ty = Math.sin(angle) * distance

        gsap.to(pupil, {
          x: tx,
          y: ty,
          duration: 0.16,
          overwrite: 'auto',
          ease: 'power2.out',
        })
      })
    }

    const attachHoverLighting = (element) => {
      element.classList.add('interactive-surface')

      const onMove = (event) => {
        const rect = element.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 100
        const y = ((event.clientY - rect.top) / rect.height) * 100
        gsap.to(element, {
          '--hx': `${x}%`,
          '--hy': `${y}%`,
          '--hover-opacity': 1,
          duration: 0.16,
          overwrite: 'auto',
        })
      }

      const onEnter = () => {
        gsap.to(element, {
          '--hover-opacity': 1,
          duration: 0.2,
          overwrite: 'auto',
        })
      }

      const onLeave = () => {
        gsap.to(element, {
          '--hover-opacity': 0,
          duration: 0.25,
          overwrite: 'auto',
        })
      }

      element.addEventListener('mousemove', onMove)
      element.addEventListener('mouseenter', onEnter)
      element.addEventListener('mouseleave', onLeave)

      return () => {
        element.removeEventListener('mousemove', onMove)
        element.removeEventListener('mouseenter', onEnter)
        element.removeEventListener('mouseleave', onLeave)
      }
    }

    window.addEventListener('mousemove', updateGlobalLight)
    const cleanupFns = Array.from(document.querySelectorAll('.card, .drop-box, .chart-card, .risk-card, button')).map(
      attachHoverLighting,
    )

    return () => {
      window.removeEventListener('mousemove', updateGlobalLight)
      cleanupFns.forEach((fn) => fn())
    }
  }, [user, activeTab, structuredFiles.length, chatMessages.length])

  useEffect(() => {
    return () => {
      if (vapiRef.current?.stop) {
        vapiRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (!analystCallActive || !analystCallStartedAt) return undefined

    const tick = setInterval(() => {
      setAnalystCallElapsedSec(Math.max(0, Math.floor((Date.now() - analystCallStartedAt) / 1000)))
    }, 1000)

    return () => clearInterval(tick)
  }, [analystCallActive, analystCallStartedAt])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadRbi = async () => {
      setRbiLoading(true)
      try {
        const data = await fetchRbiGuidelines()
        if (!cancelled) {
          setRbiLinks(Array.isArray(data?.links) ? data.links : [])
        }
      } catch {
        if (!cancelled) setRbiLinks([])
      } finally {
        if (!cancelled) setRbiLoading(false)
      }
    }

    loadRbi()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false

    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileMessage('')
      try {
        const remoteProfile = await fetchUserProfile(user.uid)
        if (cancelled || !remoteProfile) return
        setProfile((prev) => ({
          ...prev,
          fullName: remoteProfile.fullName || prev.fullName || user.displayName || '',
          institution: remoteProfile.institution || prev.institution,
          role: remoteProfile.role || prev.role,
          phone: remoteProfile.phone || prev.phone,
          country: remoteProfile.country || prev.country || 'India',
        }))
      } catch {
        if (!cancelled) setProfileMessage(t('profileLoadFailed'))
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const handleSyncLatestAttachment = async (afterUidOverride = null) => {
    setMailSyncing(true)
    setUploadError('')
    setMailSyncMessage('')

    try {
      const afterUid = Number.isFinite(afterUidOverride) ? afterUidOverride : lastEmailUidRef.current
      const attachment = await fetchLatestEmailAttachment(afterUid)
      if (!attachment) {
        const latest = structuredFilesRef.current[structuredFilesRef.current.length - 1]
        if (latest) {
          const duplicateIndex = structuredFilesRef.current.filter(
            (item) =>
              item.fileName === latest.fileName &&
              Number(item.emailUid || 0) === Number(latest.emailUid || 0),
          ).length + 1
          const duplicateRecord = {
            ...latest,
            uploadedAt: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            duplicateOfEmailUid: latest.emailUid ?? null,
            duplicateIndex,
          }
          setStructuredFiles((prev) => [...prev, duplicateRecord])
          setMailSyncMessage(`No new attachment found. Reused "${latest.fileName}" (copy ${duplicateIndex}).`)
        } else {
          setMailSyncMessage('No new email attachment found yet.')
        }
        return
      }

      const parsedRecord = await buildAttachmentRecord(attachment)
      setStructuredFiles((prev) => {
        if (prev.some((item) => item.emailUid === parsedRecord.emailUid)) return prev
        return [...prev, parsedRecord]
      })
      setLastEmailUid(parsedRecord.emailUid)
      setMailSyncMessage(`Added attachment "${parsedRecord.fileName}" from latest email.`)
    } catch (error) {
      setUploadError(error?.response?.data?.message || error?.message || 'Failed to fetch latest email attachment.')
    } finally {
      setMailSyncing(false)
    }
  }

  const scheduleAutoFetchIfNeeded = () => {
    if (autoFetchTimeoutRef.current) return
    if (autoFetchInFlightRef.current) return
    if (pendingAutoFetchCountRef.current <= 0) return

    setMailSyncMessage('Fetching...')
    autoFetchTimeoutRef.current = setTimeout(async () => {
      autoFetchTimeoutRef.current = null
      autoFetchInFlightRef.current = true
      try {
        await handleSyncLatestAttachment(lastEmailUidRef.current)
      } finally {
        autoFetchInFlightRef.current = false
        pendingAutoFetchCountRef.current = Math.max(0, pendingAutoFetchCountRef.current - 1)
        if (pendingAutoFetchCountRef.current > 0) {
          setMailSyncMessage('Fetching...')
          scheduleAutoFetchIfNeeded()
        }
      }
    }, 80000)
  }

  const onDrop = async (files) => {
    if (!files.length) return

    setUploadError('')
    setMailSyncMessage('')
    setUploading(true)
    setUploadQueue((prev) => [
      ...prev,
      ...files.map((file) => ({ name: file.name, size: file.size, status: 'Submitting' })),
    ])

    try {
      const result = await uploadFinancialDocuments(files, user?.email || '')
      const submittedCount = Math.max(1, Number(result?.length || 0) || files.length || 1)
      setUploadQueue((prev) =>
        prev.map((item) =>
          result.some((submitted) => submitted.fileName === item.name)
            ? { ...item, status: 'Submitted' }
            : item,
        ),
      )
      pendingAutoFetchCountRef.current += submittedCount
      scheduleAutoFetchIfNeeded()
      setActiveTab('documents')
    } catch (error) {
      const isTimeoutError =
        error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))
      setUploadError(
        error?.response?.data?.message ||
          error?.message ||
          (isTimeoutError
            ? 'Document processing timed out. Increased wait time is configured, but your webhook may still be timing out upstream.'
            : 'Document processing failed. Check API connection and try again.'),
      )
      setUploadQueue((prev) =>
        prev.map((item) =>
          files.some((file) => file.name === item.name)
            ? { ...item, status: 'Failed' }
            : item,
        ),
      )
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  })

  const handleGoogleSignIn = async () => {
    setAuthError('')
    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setAuthError('Firebase is not configured. Add env values or use Demo Sign-in.')
      return
    }

    try {
      const result = await signInWithPopup(auth, googleProvider)
      setUser(result.user)
      setProfile((prev) => ({
        ...prev,
        fullName: result.user.displayName || prev.fullName,
      }))
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleEmailAuth = async (event) => {
    event.preventDefault()
    setAuthError('')

    if (!hasFirebaseConfig || !auth) {
      setAuthError('Firebase is not configured. Add env values or use Demo Sign-in.')
      return
    }

    try {
      const result =
        authMode === 'signin'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password)
      setUser(result.user)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleDemoSignIn = () => {
    setUser({ uid: 'demo-user', email: 'demo@institution.com', displayName: 'Demo Analyst' })
    setProfile((prev) => ({ ...prev, fullName: prev.fullName || 'Demo Analyst' }))
    setAuthError('')
  }

  const handleSignOut = async () => {
    if (auth && user?.uid !== 'demo-user') {
      await signOut(auth)
    }
    setUser(null)
  }

  const handleProfileChange = (field, value) => {
    if (profileMessage) setProfileMessage('')
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    if (!user?.uid) return
    setProfileSaving(true)
    setProfileMessage('')
    try {
      const saved = await saveUserProfile(user.uid, profile, user.email || '')
      setProfile({
        fullName: saved.fullName || '',
        institution: saved.institution || '',
        role: saved.role || '',
        phone: saved.phone || '',
        country: saved.country || 'India',
      })
      setProfileMessage(t('profileSaved'))
    } catch (error) {
      setProfileMessage(error?.response?.data?.message || t('profileSaveFailed'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!structuredFiles.length) {
      setAiReport('Upload and process documents first to generate an AI report.')
      return
    }

    setReportLoading(true)
    try {
      const report = await generateAIReport({
        documents: structuredFiles.map((item) => item.structuredData),
        analytics,
        risk,
        uiContext: {
          activeSection: 'analytics',
          cards: [
            'kpi-grid',
            'monthly-cashflow-chart',
            'document-value-distribution-chart',
            'balance-trend-chart',
            'core-financial-table',
            'recent-transactions',
            'risk-analysis',
            'loan-ease-estimator',
            'rbi-guidelines',
          ],
          requestedLoanAmount: Number(requestedLoanAmount) || 0,
          loanEstimatorOptions: {
            loanType,
            tenureYears: Number(tenureYears),
            interestRate: Number(interestRate),
            existingEmi: Number(existingEmi),
            collateralValue: Number(collateralValue),
            employmentType,
          },
          loanEstimatorOutput: loanEstimator,
          transactionSample: analytics.transactionRows.slice(-20),
        },
      })
      setAiReport(normalizeUiReport(report?.report || report?.summary || JSON.stringify(report, null, 2)))
    } catch {
      setAiReport(
        `Automated finance summary:\n- Income: ${analytics.totals.income.toFixed(2)}\n- Expense: ${analytics.totals.expense.toFixed(2)}\n- Debt: ${analytics.totals.debt.toFixed(2)}\n- Asset: ${analytics.totals.asset.toFixed(2)}\n- Risk: ${risk.riskBand} (${risk.riskScore}/99)\nRecommended action: improve monthly surplus and lower debt ratio before high-ticket borrowing.`,
      )
    } finally {
      setReportLoading(false)
    }
  }

  const handleChatSubmit = async (event) => {
    event.preventDefault()
    if (!chatInput.trim()) return

    const nextUserMessage = { role: 'user', text: chatInput.trim() }
    setChatMessages((prev) => [...prev, nextUserMessage])
    setChatInput('')
    setChatLoading(true)

    const documentLinks = structuredFiles.map((item) => ({
      fileName: item.fileName,
      zipName: item.zipName || '',
      referenceLink: `finance://structured/${encodeURIComponent(item.fileName)}`,
    }))

    try {
      const data = await askFinanceChatbot(nextUserMessage.text, structuredFiles, documentLinks)
      const answer = data?.answer || data?.message || createFallbackFinanceAnswer(nextUserMessage.text, analytics)
      setChatMessages((prev) => [...prev, { role: 'assistant', text: answer }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: createFallbackFinanceAnswer(nextUserMessage.text, analytics) },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleTalkToAnalyst = async () => {
    if (!VAPI_PUBLIC_KEY) {
      setAnalystCallStatus('Set VITE_VAPI_PUBLIC_KEY in frontend .env to enable voice calls.')
      return
    }

    setAnalystCallOverlayOpen(true)
    setAnalystCallStatus('Connecting analyst call...')
    setAnalystCallElapsedSec(0)
    setAnalystCallStartedAt(0)

    try {
      if (!vapiRef.current) {
        const vapiModule = await import('@vapi-ai/web/dist/vapi.js')
        const VapiCtor = vapiModule?.default?.default || vapiModule?.default || vapiModule
        const vapi = new VapiCtor(VAPI_PUBLIC_KEY)

        vapi.on('call-start', () => {
          setAnalystCallActive(true)
          setAnalystCallStatus('Live analyst call started.')
          setAnalystCallStartedAt(Date.now())
          setAnalystCallElapsedSec(0)
        })
        vapi.on('call-end', () => {
          setAnalystCallActive(false)
          setAnalystCallStatus('Call ended.')
          setAnalystCallOverlayOpen(false)
          setAnalystCallStartedAt(0)
          setAnalystCallElapsedSec(0)
        })
        vapi.on('error', () => {
          setAnalystCallActive(false)
          setAnalystCallStatus('Unable to connect call. Check Vapi public key and network.')
          setAnalystCallOverlayOpen(false)
          setAnalystCallStartedAt(0)
          setAnalystCallElapsedSec(0)
        })

        vapiRef.current = vapi
      }

      if (analystCallActive) {
        await vapiRef.current.stop()
        setAnalystCallActive(false)
        setAnalystCallStatus('Call ended.')
        setAnalystCallOverlayOpen(false)
        setAnalystCallStartedAt(0)
        setAnalystCallElapsedSec(0)
        return
      }

      await vapiRef.current.start(VAPI_ASSISTANT_ID)
    } catch {
      setAnalystCallActive(false)
      setAnalystCallStatus('Unable to start call. Verify Vapi setup and retry.')
      setAnalystCallOverlayOpen(false)
      setAnalystCallStartedAt(0)
      setAnalystCallElapsedSec(0)
    }
  }

  const handleEndAnalystCall = async () => {
    try {
      if (vapiRef.current?.stop) {
        await vapiRef.current.stop()
      }
    } catch {
      // Ignore stop errors and close UI anyway.
    } finally {
      setAnalystCallActive(false)
      setAnalystCallOverlayOpen(false)
      setAnalystCallStatus('Call ended.')
      setAnalystCallStartedAt(0)
      setAnalystCallElapsedSec(0)
    }
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {!hasEntered && (
        <section className="landing-screen card">
          <p className="landing-eyebrow">Lucentrix</p>
          <h1 className="landing-brand">LUCENTRIX</h1>
          <p className="landing-quote">“Structure the unstructured.”</p>
          <LanguageToggle language={language} onToggle={toggleLanguage} t={t} />
          <button className="landing-cta" type="button" onClick={() => setHasEntered(true)}>
            {t('getStarted')}
          </button>
        </section>
      )}

      {hasEntered && (
        <>
      {analystCallOverlayOpen && (
        <section className="call-overlay">
          <div className="call-overlay-card">
            <p className="eyebrow">{t('callLine')}</p>
            <h2>{analystCallActive ? t('callProgress') : t('callConnecting')}</h2>
            <p className="call-timer">{formatCallDuration(analystCallElapsedSec)}</p>
            <p className="hint">{analystCallStatus || t('callBridge')}</p>
            <div className="call-actions">
              <button type="button" className="end-call-btn" onClick={handleEndAnalystCall}>
                <PhoneOff size={16} /> {t('endCall')}
              </button>
            </div>
          </div>
        </section>
      )}

      {!user && (
        <>
        <header className="hero" ref={heroRef}>
          <div>
            <p className="eyebrow">{t('portalEyebrow')}</p>
            <h1>{t('portalTitle')}</h1>
            <p>{t('portalSub')}</p>
          </div>
          <div className="auth-status">
            <p>{t('authRequired')}</p>
          </div>
        </header>
        <section className="card auth-card auth-layout">
          <aside className="auth-art">
            <h3 className="art-title">Lucentrix</h3>
            <div className="geo-row">
              <div className="geo geo-rect">
                <div className="geo-eyes">
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                </div>
              </div>
              <div className="geo geo-triangle">
                <div className="geo-eyes">
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                </div>
              </div>
              <div className="geo geo-semicircle">
                <div className="geo-eyes">
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                  <span className="geo-eye"><span className="geo-pupil" /></span>
                </div>
              </div>
            </div>
          </aside>

          <div className="auth-panel">
            <h2>{t('signIn')}</h2>
            <LanguageToggle language={language} onToggle={toggleLanguage} t={t} />
            <div className="auth-row">
              <button type="button" onClick={handleGoogleSignIn}>{t('continueGoogle')}</button>
              <button type="button" className="soft" onClick={handleDemoSignIn}>{t('useDemo')}</button>
            </div>

            <form onSubmit={handleEmailAuth} className="auth-form">
              <label>
                {t('email')}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                {t('password')}
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <div className="auth-row">
                <button type="submit">{authMode === 'signin' ? t('signInEmail') : t('createAccount')}</button>
                <button
                  type="button"
                  className="soft"
                  onClick={() => setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
                >
                  {authMode === 'signin' ? t('needAccount') : t('hasAccount')}
                </button>
              </div>
            </form>

            {authError && <p className="error">{authError}</p>}
            {!hasFirebaseConfig && <p className="hint">{t('firebaseHint')}</p>}
          </div>
        </section>
        </>
      )}

      {user && (
        <>
          <section className="card signed-in-banner">
            <div>
              <p className="eyebrow">{t('welcome')}</p>
              <h2>{user.displayName || user.email}</h2>
            </div>
            <div className="auth-row">
              <LanguageToggle language={language} onToggle={toggleLanguage} t={t} />
              <button type="button" className="soft" onClick={handleSignOut}>{t('signOut')}</button>
            </div>
          </section>
          <nav className="tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={activeTab === id ? 'active' : ''}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          {activeTab === 'profile' && (
            <section className="card grid-2">
              <div>
                <h2>{t('userProfile')}</h2>
                <p>{t('userProfileSub')}</p>
              </div>
              <div className="form-grid">
                <label>{t('fullName')}<input value={profile.fullName} onChange={(e) => handleProfileChange('fullName', e.target.value)} /></label>
                <label>{t('institution')}<input value={profile.institution} onChange={(e) => handleProfileChange('institution', e.target.value)} /></label>
                <label>{t('role')}<input value={profile.role} onChange={(e) => handleProfileChange('role', e.target.value)} /></label>
                <label>{t('phone')}<input value={profile.phone} onChange={(e) => handleProfileChange('phone', e.target.value)} /></label>
                <label>{t('country')}<input value={profile.country} onChange={(e) => handleProfileChange('country', e.target.value)} /></label>
              </div>
              <div className="auth-row" style={{ marginTop: '0.8rem' }}>
                <button type="button" onClick={handleSaveProfile} disabled={profileSaving || profileLoading}>
                  {profileSaving ? t('savingProfile') : t('saveProfile')}
                </button>
                {profileLoading && <p className="hint">Loading profile...</p>}
              </div>
              {profileMessage && <p className={profileMessage.includes('Failed') || profileMessage.includes('नहीं') ? 'error' : 'hint'}>{profileMessage}</p>}
            </section>
          )}

          {activeTab === 'documents' && (
            <section className="card">
              <h2>{t('documentStructuring')}</h2>
              <p>{t('documentStructuringSub')}</p>
              {mailSyncMessage && <p className="hint">{mailSyncMessage}</p>}
              <div className="drop-grid">
                <div {...getRootProps()} className={`drop-box ${isDragActive ? 'drag-active' : ''}`}>
                  <input {...getInputProps()} />
                  <UploadCloud size={36} />
                  <h3>{t('rawFiles')}</h3>
                  <p>{t('rawFilesSub')}</p>
                  {uploading && <p className="hint">Submitting files...</p>}
                  {uploadError && <p className="error">{uploadError}</p>}
                  <ul>
                    {uploadQueue.map((item) => (
                      <li key={`${item.name}-${item.size}`}>{item.name} - {item.status}</li>
                    ))}
                  </ul>
                </div>

                <div className="drop-box output-box">
                  <FileJson size={36} />
                  <h3>{t('processedOutput')}</h3>
                  <p>{t('processedOutputSub')}</p>
                  <div className="json-list">
                    {structuredFiles.map((item) => (
                      <article key={`${item.fileName}-${item.uploadedAt}`}>
                        <h4>{item.fileName}</h4>
                        <a className="download-link" href={item.downloadUrl} download={item.zipName}>
                          Download {item.zipName}
                        </a>
                      </article>
                    ))}
                    {!structuredFiles.length && <p className="hint">{t('noStructured')}</p>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'analytics' && (
            <section className="card analytics">
              <div className="analytics-header">
                <div>
                  <h2>{t('analyticsTitle')}</h2>
                  <p>{t('analyticsSub')}</p>
                </div>
                <div className="analytics-actions">
                  <button type="button" className="soft" onClick={handleTalkToAnalyst}>
                    {analystCallActive ? <PhoneOff size={16} /> : <PhoneCall size={16} />}
                    {analystCallActive ? t('endAnalystCall') : t('talkToAnalyst')}
                  </button>
                  <button type="button" onClick={handleGenerateReport} disabled={reportLoading}>
                    {reportLoading ? t('generatingReport') : t('generateReport')}
                  </button>
                </div>
              </div>
              {analystCallStatus && <p className="hint">{analystCallStatus}</p>}

              <div className="kpi-grid">
                <article><span>{t('income')}</span><strong>{analytics.totals.income.toFixed(2)}</strong></article>
                <article><span>{t('expense')}</span><strong>{analytics.totals.expense.toFixed(2)}</strong></article>
                <article><span>{t('debt')}</span><strong>{analytics.totals.debt.toFixed(2)}</strong></article>
                <article><span>{t('assets')}</span><strong>{analytics.totals.asset.toFixed(2)}</strong></article>
              </div>

              <div className="chart-grid">
                <div className="chart-card">
                  <h3>{t('monthlyCashflow')}</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.monthlySeries}>
                      <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1677ad" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#1677ad" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="inflow" stroke="#1677ad" fill="url(#incomeGradient)" />
                      <Area type="monotone" dataKey="outflow" stroke="#d66c3d" fill="#f4c8b6" fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>{t('docValue')}</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={analytics.documentBreakdown} dataKey="value" nameKey="name" outerRadius={90} label>
                        {analytics.documentBreakdown.map((_, index) => (
                          <Cell key={index} fill={['#1677ad', '#0f9d7e', '#d66c3d', '#1d4c5e', '#87b9d3'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>{t('balanceTrend')}</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={balanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="balance" stroke="#0f9d7e" fill="#bde9dc" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>{t('coreTable')}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { metric: t('income'), value: analytics.totals.income },
                    { metric: t('expense'), value: analytics.totals.expense },
                    { metric: t('debt'), value: analytics.totals.debt },
                    { metric: t('assets'), value: analytics.totals.asset },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1d4c5e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>{t('recentTx')}</h3>
                <div style={{ maxHeight: '260px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Date</th>
                        <th style={{ textAlign: 'left' }}>Description</th>
                        <th style={{ textAlign: 'right' }}>Debit</th>
                        <th style={{ textAlign: 'right' }}>Credit</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.transactionRows
                        .slice(-20)
                        .reverse()
                        .map((row, idx) => (
                          <tr key={`${row.sourceFile}-${row.date}-${idx}`}>
                            <td>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                            <td>{row.description}</td>
                            <td style={{ textAlign: 'right' }}>{Number(row.debit || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(row.credit || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(row.balance || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!analytics.transactionRows.length && <p className="hint">No transaction rows parsed from ZIP Excel yet.</p>}
                </div>
              </div>

              <div className="risk-grid">
                <article className="risk-card">
                  <h3><ShieldCheck size={18} /> Risk Analysis</h3>
                  <p>Risk score: <strong>{risk.riskScore}/99</strong></p>
                  <p>Risk band: <strong>{risk.riskBand}</strong></p>
                  <p>Estimated repay capacity: <strong>{risk.repayCapacity.toFixed(2)}</strong></p>
                  <p>Ease of approval: <strong>{risk.ease}</strong></p>
                </article>
                <article className="risk-card">
                  <h3>Detailed Loan Estimator</h3>
                  <div className="loan-estimator-grid">
                    <label>
                      Loan type
                      <select value={loanType} onChange={(e) => setLoanType(e.target.value)}>
                        <option value="home">Home Loan</option>
                        <option value="personal">Personal Loan</option>
                        <option value="business">Business Loan</option>
                        <option value="vehicle">Vehicle Loan</option>
                        <option value="education">Education Loan</option>
                      </select>
                    </label>
                    <label>
                      Employment profile
                      <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                        <option value="salaried">Salaried</option>
                        <option value="selfEmployed">Self-employed</option>
                      </select>
                    </label>
                    <label>
                      {t('desiredLoan')}
                      <input type="number" min="0" value={requestedLoanAmount} onChange={(e) => setRequestedLoanAmount(e.target.value)} />
                    </label>
                    <label>
                      Tenure (years)
                      <input type="number" min="1" max="35" value={tenureYears} onChange={(e) => setTenureYears(e.target.value)} />
                    </label>
                    <label>
                      Interest rate (% p.a.)
                      <input type="number" min="0" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                    </label>
                    <label>
                      Existing EMI / month
                      <input type="number" min="0" value={existingEmi} onChange={(e) => setExistingEmi(e.target.value)} />
                    </label>
                    <label>
                      Collateral / property value
                      <input type="number" min="0" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} />
                    </label>
                  </div>

                  <div className="loan-estimator-output">
                    <p>Monthly net income used: <strong>{loanEstimator.monthlyIncome.toFixed(2)}</strong></p>
                    <p>FOIR used: <strong>{(loanEstimator.foirUsed * 100).toFixed(1)}%</strong></p>
                    <p>Max affordable EMI: <strong>{loanEstimator.maxAffordableEmi.toFixed(2)}</strong></p>
                    <p>Requested loan EMI (estimate): <strong>{loanEstimator.estimatedEmiForRequested.toFixed(2)}</strong></p>
                    <p>Eligible loan amount: <strong>{loanEstimator.eligibleAmount.toFixed(2)}</strong></p>
                    <p>Approval signal: <strong>{loanEstimator.approvalSignal}</strong></p>
                  </div>

                  <div className="loan-scenarios">
                    {loanEstimator.scenarios.map((scenario) => (
                      <article key={scenario.label}>
                        <span>{scenario.label}</span>
                        <strong>{scenario.amount.toFixed(2)}</strong>
                      </article>
                    ))}
                  </div>
                </article>
                <article className="risk-card">
                  <h3>Risk Factor Graph</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={riskFactorSeries} layout="vertical" margin={{ top: 8, right: 12, left: 6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="factor" width={108} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#5aa8ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </article>
              </div>

              <div className="chart-card">
                <h3>{t('latestRbi')}</h3>
                {rbiLoading && <p className="hint">{t('loadingRbi')}</p>}
                {!rbiLoading && !rbiLinks.length && <p className="hint">{t('unableRbi')}</p>}
                {!!rbiLinks.length && (
                  <ul className="rbi-links">
                    {rbiLinks.map((item, index) => (
                      <li key={`${item.url}-${index}`}>
                        <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                        <span>{item.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="report-box">
                <h3>{t('aiReport')}</h3>
                <pre>{aiReport || t('aiReportPlaceholder')}</pre>
              </div>
            </section>
          )}

          {activeTab === 'chatbot' && (
            <section className="card">
              <h2>{t('vgTitle')}</h2>
              <div className="vg-embed-wrap">
                <iframe
                  title="3D Analyst Agent"
                  src="http://localhost:5174"
                  className="vg-embed"
                  allow="microphone; autoplay"
                />
              </div>
            </section>
          )}
        </>
      )}
      </>
      )}
    </div>
  )
}

export default App
