/**
 * المنطق البرمجي لتطبيق "ميزانية العائلة" - نظام الأظرفة الـ 23
 * متوافق 100% مع الصفحات الأربعة:
 * 1. الأظرفة الموحدة (الخطة المرجعية المحدثة - قراءة فقط)
 * 2. المصاريف اليومية (إضافة / تعديل / حذف)
 * 3. استلاف الأظرفة (إضافة سلفة أو تحويل / تسديد المبلغ المرجع / مسح، مع الحفاظ على معادلات العمودين H و J)
 * 4. تغذية الأظرفة (تغذية وتعديل الدورات الشهرية ومنح المردودية في العمود D والأعمدة H:AD فقط)
 */

const STORAGE_KEYS = {
  DATA: 'family_budget_sheet_data_v10',
  SCRIPT_URL: 'family_budget_script_url_v2'
};

// خريطة الأشهر المعتمدة في جدول "تغذية الأظرفة"
const MONTH_NAME_TO_NUM = {
  'جانفي': '01',
  'فيفري': '02',
  'مارس': '03',
  'أفريل': '04',
  'ماي': '05',
  'جوان': '06',
  'جويلية': '07',
  'أوت': '08',
  'سبتمبر': '09',
  'أكتوبر': '10',
  'نوفمبر': '11',
  'ديسمبر': '12'
};

// ألوان مميزة للأظرفة الـ 23 للرسوم البيانية
const ENVELOPE_COLORS = [
  '#10b981', '#059669', '#ef4444', '#f59e0b', '#3b82f6', '#6366f1', '#14b8a6',
  '#8b5cf6', '#ec4899', '#d946ef', '#0ea5e9', '#2563eb', '#4f46e5',
  '#eab308', '#84cc16', '#f97316', '#a855f7', '#06b6d4', '#3b82f6', '#10b981',
  '#f43f5e', '#14b8a6', '#64748b'
];

// خريطة التصنيفات المعتمدة في شيت "الأظرفة الموحدة" (أساسيات، كماليات، استثمار وادخار، احتياطي وتدوير)
const MAJOR_CATEGORY_MAP = {
  'ريفيطيمة': 'أساسيات',
  'خضر وفواكه': 'أساسيات',
  'لحوم ودجاج وبيض': 'أساسيات',
  'خبز وحليب وإضافات': 'أساسيات',
  'فواتير اتصالات': 'أساسيات',
  'ليسانس وحضري': 'أساسيات',
  'التنظيف': 'أساسيات',
  'دروس خصوصية': 'أساسيات',
  'ملابس': 'أساسيات',
  'كهرباء': 'أساسيات',
  'أدوات مدرسية': 'أساسيات',
  'صيانة منزلية': 'أساسيات',
  'أثاث منزلي': 'أساسيات',
  'فاتورة الهاتف': 'أساسيات',
  'عناية جسدية': 'كماليات',
  'كتب': 'كماليات',
  'إلكترونيات': 'كماليات',
  'سفر': 'كماليات',
  'ملابس موسمية': 'كماليات',
  'بشير': 'استثمار وادخار',
  'موطو': 'استثمار وادخار',
  'إدخار': 'استثمار وادخار',
  'فائض / طوارئ': 'احتياطي وتدوير'
};

// خريطة نوع الحساب المرتبط بكل ظرف كما في جدول "الأظرفة الموحدة" الرسمي
const ENVELOPE_ACCOUNT_MAP = {
  'ريفيطيمة': 'كاش',
  'خضر وفواكه': 'كاش',
  'لحوم ودجاج وبيض': 'كاش',
  'خبز وحليب وإضافات': 'كاش',
  'فواتير اتصالات': 'حساب جاري',
  'ليسانس وحضري': 'كاش',
  'التنظيف': 'كاش',
  'دروس خصوصية': 'كاش',
  'ملابس': 'كاش',
  'كهرباء': 'حساب جاري',
  'أدوات مدرسية': 'كاش',
  'صيانة منزلية': 'كاش',
  'أثاث منزلي': 'حساب جاري',
  'فاتورة الهاتف': 'حساب جاري',
  'عناية جسدية': 'كاش',
  'كتب': 'حساب جاري',
  'إلكترونيات': 'حساب جاري',
  'سفر': 'حساب جاري',
  'ملابس موسمية': 'حساب جاري',
  'بشير': 'حساب جاري',
  'موطو': 'حساب جاري',
  'إدخار': 'حساب جاري',
  'فائض / طوارئ': 'حساب جاري'
};

// الحالة العامة للتطبيق
let state = {
  scriptUrl: localStorage.getItem(STORAGE_KEYS.SCRIPT_URL) || '',
  selectedPeriod: '2026-11', // 'YYYY-MM' أو 'ALL'
  currentTab: 'dashboard', // 'dashboard' | 'expenses' | 'loans' | 'feeding'
  envelopeGroupFilter: 'ALL', // 'ALL' | 'الصرف الدوري' | 'الإدخار والتراكم'
  envelopeDesign: localStorage.getItem('family_budget_env_design') || 'cards', // 'cards' | 'circular' | 'grouped' | 'wallet' | 'table'
  feedingRefCategoryFilter: 'ALL', // 'ALL' | 'أساسيات' | 'كماليات' | 'إدخار'
  loanTypeFilter: 'ALL', // 'ALL' | 'سلفة مؤقتة' | 'تحويل للادخار'
  pieChartFilter: 'ALL', // 'ALL' | 'CAT_ESSENTIALS' | 'CAT_LUXURIES' | 'CAT_SAVINGS' | 'GRP_SPENDING' | 'GRP_SAVINGS'
  pieChartMetric: 'SPENT', // 'SPENT' | 'ALLOCATED' | 'NET_BALANCE'
  editingCycleRowIndex: null,
  expandedEnvelopes: new Set(),
  data: null
};

// مراجع الرسوم البيانية
let charts = {
  budgetVsActual: null,
  categoryPie: null,
  timeline: null,
  paymentMethod: null
};

// نسخة مطابقة تماماً لجدول "الأظرفة الموحدة" الرسمي في ملف Google Sheet
function getInitialSheetSnapshot() {
  const envelopesMeta = [
    // أساسيات (14 ظرفاً)
    { colIndex: 8,  name: 'ريفيطيمة',         majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 20000, bonusRef: 5100,  novAlloc: 20000, accumulationMonths: 0 },
    { colIndex: 9,  name: 'خضر وفواكه',       majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 10000, bonusRef: 2430,  novAlloc: 10000, accumulationMonths: 0 },
    { colIndex: 10, name: 'لحوم ودجاج وبيض',  majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 10000, bonusRef: 2460,  novAlloc: 10000, accumulationMonths: 0 },
    { colIndex: 11, name: 'خبز وحليب وإضافات', majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 4000,  bonusRef: 960,   novAlloc: 4000,  accumulationMonths: 0 },
    { colIndex: 12, name: 'فواتير اتصالات',   majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'حساب جاري', salaryRef: 3900,  bonusRef: 0,     novAlloc: 3900,  accumulationMonths: 0 },
    { colIndex: 13, name: 'ليسانس وحضري',     majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 1600,  bonusRef: 0,     novAlloc: 1600,  accumulationMonths: 0 },
    { colIndex: 14, name: 'التنظيف',          majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 1500,  bonusRef: 0,     novAlloc: 1500,  accumulationMonths: 0 },
    { colIndex: 15, name: 'دروس خصوصية',      majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 5000,  bonusRef: 0,     novAlloc: 5000,  accumulationMonths: 0 },
    { colIndex: 16, name: 'ملابس',            majorCategory: 'أساسيات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 4000,  bonusRef: 0,     novAlloc: 4000,  accumulationMonths: 0 },
    { colIndex: 20, name: 'كهرباء',           majorCategory: 'أساسيات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 2000,  bonusRef: 0,     novAlloc: 2000, accumulationMonths: 3 },
    { colIndex: 21, name: 'أدوات مدرسية',     majorCategory: 'أساسيات', group: 'الإدخار والتراكم', accountType: 'كاش',       salaryRef: 1400,  bonusRef: 0,     novAlloc: 1400, accumulationMonths: 12 },
    { colIndex: 22, name: 'صيانة منزلية',     majorCategory: 'أساسيات', group: 'الإدخار والتراكم', accountType: 'كاش',       salaryRef: 3000,  bonusRef: 0,     novAlloc: 3000, accumulationMonths: 12 },
    { colIndex: 23, name: 'أثاث منزلي',       majorCategory: 'أساسيات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 1800,  bonusRef: 0,     novAlloc: 1800, accumulationMonths: 12 },
    { colIndex: 24, name: 'فاتورة الهاتف',     majorCategory: 'أساسيات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 300,   bonusRef: 0,     novAlloc: 300,  accumulationMonths: 2 },
    // كماليات (5 أظرفة)
    { colIndex: 17, name: 'عناية جسدية',      majorCategory: 'كماليات', group: 'الصرف الدوري',     accountType: 'كاش',       salaryRef: 5000,  bonusRef: 0,     novAlloc: 5000,  accumulationMonths: 0 },
    { colIndex: 25, name: 'كتب',              majorCategory: 'كماليات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 1000,  bonusRef: 0,     novAlloc: 1000, accumulationMonths: 6 },
    { colIndex: 26, name: 'إلكترونيات',       majorCategory: 'كماليات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 5000,  bonusRef: 0,     novAlloc: 5000, accumulationMonths: 12 },
    { colIndex: 27, name: 'سفر',              majorCategory: 'كماليات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 0,     bonusRef: 27000, novAlloc: 0,    accumulationMonths: 12 },
    { colIndex: 28, name: 'ملابس موسمية',     majorCategory: 'كماليات', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 5000,  bonusRef: 0,     novAlloc: 5000, accumulationMonths: 6 },
    // استثمار وادخار (3 أظرفة)
    { colIndex: 18, name: 'بشير',             majorCategory: 'استثمار وادخار', group: 'الصرف الدوري',     accountType: 'حساب جاري', salaryRef: 5000,  bonusRef: 0,     novAlloc: 5000,  accumulationMonths: 0 },
    { colIndex: 19, name: 'موطو',             majorCategory: 'استثمار وادخار', group: 'الصرف الدوري',     accountType: 'حساب جاري', salaryRef: 6900,  bonusRef: 0,     novAlloc: 6900,  accumulationMonths: 0 },
    { colIndex: 29, name: 'إدخار',            majorCategory: 'استثمار وادخار', group: 'الإدخار والتراكم', accountType: 'حساب جاري', salaryRef: 7800,  bonusRef: 14400, novAlloc: 7800, accumulationMonths: 12 },
    // احتياطي وتدوير (ظرف 1)
    { colIndex: 30, name: 'فائض / طوارئ',     majorCategory: 'احتياطي وتدوير', group: 'احتياطي وتدوير',   accountType: 'حساب جاري', salaryRef: 0,     bonusRef: 0,     novAlloc: 0,    accumulationMonths: 12 }
  ];

  const novAllocations = {};
  const emptyAllocations = {};
  envelopesMeta.forEach(e => {
    novAllocations[e.name] = e.novAlloc;
    emptyAllocations[e.name] = '';
  });

  const cycleDefs = [
    { rowIndex: 12, monthName: 'نوفمبر', year: 2026, incomeType: 'راتب شهري', receivedAmount: 104200, allocations: { ...novAllocations } },
    { rowIndex: 13, monthName: 'ديسمبر', year: 2026, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 14, monthName: 'ديسمبر', year: 2026, incomeType: 'مردودية',   receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 15, monthName: 'جانفي',  year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 16, monthName: 'فيفري',  year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 17, monthName: 'مارس',   year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 18, monthName: 'مارس',   year: 2027, incomeType: 'مردودية',   receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 19, monthName: 'أفريل',  year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 20, monthName: 'ماي',    year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 21, monthName: 'جوان',   year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 22, monthName: 'جوان',   year: 2027, incomeType: 'مردودية',   receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 23, monthName: 'جويلية', year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 24, monthName: 'أوت',    year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 25, monthName: 'سبتمبر', year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 26, monthName: 'سبتمبر', year: 2027, incomeType: 'مردودية',   receivedAmount: '',     allocations: { ...emptyAllocations } },
    { rowIndex: 27, monthName: 'أكتوبر', year: 2027, incomeType: 'راتب شهري', receivedAmount: '',     allocations: { ...emptyAllocations } }
  ];

  const snapshot = {
    overview: {
      monthlySalary: 104200,
      quarterlyBonusMonthlyAvg: 17450,
      quarterlyBonusTotal: 52350,
      weightedMonthlyAvg: 121650,
      essentialsTotal: 72150,
      luxuriesTotal: 25000,
      savingsTotal: 24500,
      contingencyTotal: 0,
      cashTotal: 69150,
      currentAccountTotal: 52500,
      totalEnvelopesCount: 23,
      spendingEnvelopesCount: 12,
      savingsEnvelopesCount: 11,
      totalEnvelopesText: '23 ظرفاً'
    },
    accounts: {
      ccp: { key: 'ccp', name: 'حساب CCP', fullName: 'حساب بريدي جاري (CCP)', balance: 54138, totalIn: 104200, totalOut: 50062, currency: 'دج' },
      cash: { key: 'cash', name: 'كاش', fullName: 'كاش (نقدي)', balance: 50000, totalIn: 50000, totalOut: 0, currency: 'دج' },
      euro: { key: 'euro', name: 'حساب أورو', fullName: 'حساب يورو (EURO)', balance: 0, totalIn: 0, totalOut: 0, currency: '€' },
      usdt: { key: 'usdt', name: 'حساب USDT', fullName: 'حساب دولار رقمي (USDT)', balance: 0, totalIn: 0, totalOut: 0, currency: '$' }
    },
    transfers: [
      {
        rowIndex: 4,
        date: '2026-11-01',
        fromAccount: 'حساب CCP',
        toAccount: 'كاش',
        amount: 50062,
        fromCurrency: 'دج',
        exchangeRate: 1,
        fee: 62,
        netReceived: 50000,
        toCurrency: 'دج',
        note: 'سحب سيولة نقدية لتغذية المصاريف والأظرفة'
      }
    ],
    accountInflows: [
      {
        rowIndex: 10,
        date: '2026-11-01',
        statement: 'الراتب الشهري (نوفمبر)',
        incomeType: 'راتب شهري',
        toAccount: 'حساب CCP',
        amount: 104200,
        currency: 'دج',
        note: 'تحويل الراتب الشهري الثابت'
      }
    ],
    envelopes: envelopesMeta.map((e, i) => {
      const bonusMonthlyRef = Math.round((e.bonusRef || 0) / 3);
      const totalMonthlyAlloc = e.salaryRef + bonusMonthlyRef;
      const accumulationMonths = e.accumulationMonths || 0;
      const targetAmount = accumulationMonths > 0 ? (totalMonthlyAlloc * accumulationMonths) : 0;
      return {
        colIndex: e.colIndex,
        keyIndex: i,
        name: e.name,
        group: e.group,
        majorCategory: e.majorCategory || MAJOR_CATEGORY_MAP[e.name] || 'أساسيات',
        accountType: e.accountType || ENVELOPE_ACCOUNT_MAP[e.name] || 'كاش',
        salaryRef: e.salaryRef,
        bonusMonthlyRef: bonusMonthlyRef,
        totalMonthlyAllocated: totalMonthlyAlloc,
        bonusRef: e.bonusRef,
        annualFed: e.novAlloc,
        netBalance: e.novAlloc,
        accumulationMonths: accumulationMonths,
        targetAmount: targetAmount
      };
    }),
    feedingCycles: cycleDefs,
    expenses: [],
    loans: []
  };

  recalculateSheetFormulasLocally(snapshot);
  return snapshot;
}

// نسخة معطيات تجريبية واقعية غنية لمحاكاة التطبيق وقت العمل الفعلي بكافة تفاصيله
function getDemoWorkingSnapshot() {
  const base = getInitialSheetSnapshot();
  
  // 1. تغذية دورتين واقعيتين: راتب نوفمبر 2026 + راتب ومنحة مردودية ديسمبر 2026
  const decSalaryAlloc = {};
  const decBonusAlloc = {};
  base.envelopes.forEach(e => {
    decSalaryAlloc[e.name] = e.salaryRef;
    decBonusAlloc[e.name] = e.bonusRef;
  });

  base.feedingCycles.forEach(cycle => {
    if (cycle.monthName === 'نوفمبر' && cycle.year === 2026) {
      cycle.receivedAmount = 104000;
    } else if (cycle.monthName === 'ديسمبر' && cycle.year === 2026 && cycle.incomeType === 'راتب شهري') {
      cycle.receivedAmount = 104200;
      cycle.allocations = { ...decSalaryAlloc };
    } else if (cycle.monthName === 'ديسمبر' && cycle.year === 2026 && cycle.incomeType === 'مردودية') {
      cycle.receivedAmount = 52350;
      cycle.allocations = { ...decBonusAlloc };
    }
  });

  // 2. قائمة مصاريف يومية غنية وواقعية تغطي مختلف الأظرفة وطرق الدفع (كاش وبريدي موب)
  base.expenses = [
    {
      rowIndex: 2,
      date: '2026-10-30',
      envelope: 'خضر وفواكه',
      statement: 'شراء خضار وفواكه أسبوعية',
      amount: 2500,
      paymentMethod: 'كاش',
      note: 'مشتريات السوق الأسبوعي'
    },
    {
      rowIndex: 3,
      date: '2026-10-30',
      envelope: 'فواتير اتصالات',
      statement: 'تعبئة اشتراك إنترنت 4G',
      amount: 1500,
      paymentMethod: 'بريدي موب',
      note: 'دفع إلكتروني'
    },
    {
      rowIndex: 4,
      date: '2026-11-02',
      envelope: 'ريفيطيمة',
      statement: 'تموين غذائي شهري (زيت، سكر، سميد، قهوة، عجائن)',
      amount: 7200,
      paymentMethod: 'كاش',
      note: 'سوبرماركت البركة'
    },
    {
      rowIndex: 5,
      date: '2026-11-03',
      envelope: 'خبز وحليب وإضافات',
      statement: 'خبز طازج، حليب ولبن',
      amount: 450,
      paymentMethod: 'كاش',
      note: 'مخبزة النور'
    },
    {
      rowIndex: 6,
      date: '2026-11-04',
      envelope: 'لحوم ودجاج وبيض',
      statement: 'شراء دجاج وصفيحة بيض ولحم مفروم',
      amount: 3200,
      paymentMethod: 'كاش',
      note: 'الجزار'
    },
    {
      rowIndex: 7,
      date: '2026-11-05',
      envelope: 'ليسانس وحضري',
      statement: 'تعبئة بنزين للسيارة',
      amount: 1100,
      paymentMethod: 'كاش',
      note: 'محطة نفطال'
    },
    {
      rowIndex: 8,
      date: '2026-11-06',
      envelope: 'التنظيف',
      statement: 'مسحوق غسيل، معقم ومستلزمات نظافة منزلية',
      amount: 850,
      paymentMethod: 'كاش',
      note: 'محل المنظفات'
    },
    {
      rowIndex: 9,
      date: '2026-11-08',
      envelope: 'خضر وفواكه',
      statement: 'بطاطا، طماطم، بصل وفواكه متنوعة',
      amount: 2200,
      paymentMethod: 'كاش',
      note: 'سوق الخضر'
    },
    {
      rowIndex: 10,
      date: '2026-11-10',
      envelope: 'دروس خصوصية',
      statement: 'مستحقات الدروس الخصوصية (رياضيات وفيزياء)',
      amount: 2500,
      paymentMethod: 'كاش',
      note: 'قسط شهر نوفمبر'
    },
    {
      rowIndex: 11,
      date: '2026-11-11',
      envelope: 'فواتير اتصالات',
      statement: 'دفع فاتورة الهاتف الثابت والإنترنت المنزلي فايبر',
      amount: 2000,
      paymentMethod: 'بريدي موب',
      note: 'تطبيق بريدي موب'
    },
    {
      rowIndex: 12,
      date: '2026-11-12',
      envelope: 'عناية جسدية',
      statement: 'حلاقة ومستحضرات عناية شخصية',
      amount: 1700,
      paymentMethod: 'كاش',
      note: 'صالون الحلاقة'
    },
    {
      rowIndex: 13,
      date: '2026-11-13',
      envelope: 'خبز وحليب وإضافات',
      statement: 'أجبان، حليب، ياغورت وكرواسون',
      amount: 700,
      paymentMethod: 'كاش',
      note: 'بقالة الحي'
    },
    {
      rowIndex: 14,
      date: '2026-11-15',
      envelope: 'لحوم ودجاج وبيض',
      statement: 'سمك طازج وقطع دجاج',
      amount: 2800,
      paymentMethod: 'كاش',
      note: 'سوق السمك'
    },
    {
      rowIndex: 15,
      date: '2026-11-16',
      envelope: 'ملابس',
      statement: 'شراء كنزة وحذاء شتوي دافئ',
      amount: 3400,
      paymentMethod: 'بريدي موب',
      note: 'محل الألبسة'
    },
    {
      rowIndex: 16,
      date: '2026-11-17',
      envelope: 'صيانة منزلية',
      statement: 'تغيير قفل الباب وشراء شريط عازل للأنابيب',
      amount: 1300,
      paymentMethod: 'كاش',
      note: 'محل الخردوات'
    },
    {
      rowIndex: 17,
      date: '2026-11-18',
      envelope: 'كتب',
      statement: 'كتب تمارين مدرسية مساعدة وقواميس',
      amount: 850,
      paymentMethod: 'كاش',
      note: 'المكتبة المركزية'
    },
    {
      rowIndex: 18,
      date: '2026-11-19',
      envelope: 'أدوات مدرسية',
      statement: 'كراريس، أقلام، غراء وأوراق رسم',
      amount: 600,
      paymentMethod: 'كاش',
      note: 'مكتبة المدرسة'
    },
    {
      rowIndex: 19,
      date: '2026-11-20',
      envelope: 'موطو',
      statement: 'تغيير زيت المحرك وشمعة الإشعال للدراجة',
      amount: 2100,
      paymentMethod: 'كاش',
      note: 'ميكانيكي الدراجات'
    },
    {
      rowIndex: 20,
      date: '2026-11-21',
      envelope: 'فاتورة الهاتف',
      statement: 'تسديد فاتورة اشتراك الهاتف النقال',
      amount: 300,
      paymentMethod: 'بريدي موب',
      note: 'دفع إلكتروني'
    },
    {
      rowIndex: 21,
      date: '2026-11-21',
      envelope: 'بشير',
      statement: 'مصروف شخصي نصف شهري بشير',
      amount: 2500,
      paymentMethod: 'كاش',
      note: 'منحة الجيب'
    },
    {
      rowIndex: 22,
      date: '2026-11-23',
      envelope: 'كهرباء',
      statement: 'تسديد شطر فاتورة سونلغاز (الكهرباء والغاز)',
      amount: 1800,
      paymentMethod: 'بريدي موب',
      note: 'الدفع الإلكتروني لسونلغاز'
    },
    {
      rowIndex: 23,
      date: '2026-11-25',
      envelope: 'خضر وفواكه',
      statement: 'مشتريات الخضار الأسبوعية',
      amount: 2100,
      paymentMethod: 'كاش',
      note: 'سوق الخضر'
    },
    {
      rowIndex: 24,
      date: '2026-11-26',
      envelope: 'خبز وحليب وإضافات',
      statement: 'خبز وحليب يومي',
      amount: 500,
      paymentMethod: 'كاش',
      note: 'المخبزة'
    },
    {
      rowIndex: 25,
      date: '2026-11-27',
      envelope: 'لحوم ودجاج وبيض',
      statement: 'دجاج وطبق بيض',
      amount: 2200,
      paymentMethod: 'كاش',
      note: 'محل الدواجن'
    },
    {
      rowIndex: 26,
      date: '2026-11-28',
      envelope: 'إلكترونيات',
      statement: 'شاحن هاتف أصلي وكابل وبطارية خارجية',
      amount: 2300,
      paymentMethod: 'بريدي موب',
      note: 'متجر الإلكترونيات'
    },
    {
      rowIndex: 27,
      date: '2026-11-29',
      envelope: 'ريفيطيمة',
      statement: 'مشتريات إضافية وتكملة مستلزمات المطبخ',
      amount: 3800,
      paymentMethod: 'كاش',
      note: 'ميني ماركت'
    },
    {
      rowIndex: 28,
      date: '2026-11-20',
      envelope: 'سفر',
      statement: 'عربون حجز رحلة عائلية لمنتجع حموي',
      amount: 3000,
      paymentMethod: 'بريدي موب',
      note: 'حجز إلكتروني'
    },
    {
      rowIndex: 29,
      date: '2026-11-16',
      envelope: 'ملابس موسمية',
      statement: 'شراء ألبسة شتوية للأولاد ومعاطف',
      amount: 3500,
      paymentMethod: 'كاش',
      note: 'متجر ملابس'
    },
    {
      rowIndex: 30,
      date: '2026-11-12',
      envelope: 'كتب',
      statement: 'اقتناء كتب علمية ومراجع تعليمية',
      amount: 1000,
      paymentMethod: 'كاش',
      note: 'المكتبة'
    },
    {
      rowIndex: 31,
      date: '2026-11-08',
      envelope: 'أدوات مدرسية',
      statement: 'شراء كراريس وأقلام وأغلفة',
      amount: 900,
      paymentMethod: 'كاش',
      note: 'مكتبة الحي'
    },
    {
      rowIndex: 32,
      date: '2026-11-18',
      envelope: 'صيانة منزلية',
      statement: 'قطع غيار ولوازم سباكة للحمام',
      amount: 1200,
      paymentMethod: 'كاش',
      note: 'محل العقاقير'
    },
    {
      rowIndex: 33,
      date: '2026-12-04',
      envelope: 'سفر',
      statement: 'عربون حجز فندق لعطلة نهاية الأسبوع العائلية (من رصيد المردودية)',
      amount: 6000,
      paymentMethod: 'بريدي موب',
      note: 'حجز إلكتروني'
    }
  ];

  // 3. عمليات استلاف وتحويل واقعية بين الأظرفة (تم الإرجاع، مسترجع جزئياً، وتحويل للادخار)
  base.loans = [
    {
      rowIndex: 2,
      date: '2026-10-25',
      type: 'سلفة مؤقتة',
      fromEnvelope: 'صيانة منزلية',
      toEnvelope: 'ليسانس وحضري',
      amount: 1000,
      reason: 'وقود طارئ',
      dueDate: '2026-11-05',
      status: 'تم الإرجاع',
      repaidAmount: 1000,
      remainingAmount: 0,
      note: 'تم إرجاع المبلغ كاملاً'
    },
    {
      rowIndex: 3,
      date: '2026-11-14',
      type: 'سلفة مؤقتة',
      fromEnvelope: 'صيانة منزلية',
      toEnvelope: 'ملابس',
      amount: 1500,
      reason: 'استكمال ثمن معطف شتوي',
      dueDate: '2026-12-10',
      status: 'مسترجع جزئياً',
      repaidAmount: 500,
      remainingAmount: 1000,
      note: 'أرجع 500 دج ومتبقي 1000 دج'
    },
    {
      rowIndex: 4,
      date: '2026-11-22',
      type: 'تحويل للادخار',
      fromEnvelope: 'بشير',
      toEnvelope: 'إدخار',
      amount: 1500,
      reason: 'توفير فائض المصروف الشخصي في حصالة الادخار',
      dueDate: '',
      status: 'تم التحويل',
      repaidAmount: 0,
      remainingAmount: 0,
      note: 'تحويل دائم للادخار'
    }
  ];

  recalculateSheetFormulasLocally(base);
  return base;
}

// محاكاة معادلات Google Sheets محلياً (نفس معادلات الصف 10 و 11 في تغذية الأظرفة ومعادلات H و J في استلاف الأظرفة)
function recalculateSheetFormulasLocally(data) {
  if (!data) return;

  // 1. حساب معادلات استلاف الأظرفة (العمود H الحالة والعمود J المتبقي)
  data.loans.forEach(loan => {
    const E = Number(loan.amount) || 0;
    const I = Number(loan.repaidAmount) || 0;
    const B = loan.type || 'سلفة مؤقتة';

    if (B === 'تحويل للادخار') {
      loan.remainingAmount = 0;
      loan.status = 'تم التحويل';
    } else {
      loan.remainingAmount = E - I;
      if (I > E) loan.status = 'خطأ';
      else if (I === 0) loan.status = 'معلق';
      else if (loan.remainingAmount <= 0) loan.status = 'تم الإرجاع';
      else loan.status = 'مسترجع جزئياً';
    }
  });

  // 2. حساب معادلات دورات التغذية (الأعمدة E, F, G في الصفوف 12..27)
  data.feedingCycles.forEach(cycle => {
    const vals = Object.values(cycle.allocations || {}).filter(v => v !== '' && v !== null && !isNaN(Number(v)));
    const hasAlloc = vals.length > 0;
    const sumAlloc = vals.reduce((s, v) => s + Number(v), 0);
    const hasReceived = cycle.receivedAmount !== '' && cycle.receivedAmount !== null;
    const D = Number(cycle.receivedAmount) || 0;

    cycle.distributedTotal = hasAlloc ? sumAlloc : 0;
    cycle.remainingBalance = (!hasReceived && !hasAlloc) ? 0 : (D - cycle.distributedTotal);

    if (!hasReceived && !hasAlloc) {
      cycle.status = '⚪ غير مسجل';
    } else if (!hasReceived) {
      cycle.status = '⚠️ بدون دخل مسجل';
    } else if (cycle.remainingBalance === 0) {
      cycle.status = '✅ متوازنة 100%';
    } else if (cycle.remainingBalance > 0) {
      cycle.status = '⚠️ يوجد فائض';
    } else {
      cycle.status = '❌ عجز مالي';
    }
  });

  // 3. حساب الصف 10 (إجمالي التغذية السنوية) والصف 11 (صافي رصيد كل ظرف) + الرصيد الإجمالي المخصص شهرياً (الراتب + حصة المردودية)
  data.envelopes.forEach(env => {
    const name = env.name;
    env.majorCategory = MAJOR_CATEGORY_MAP[name] || env.majorCategory || 'أساسيات';
    const salaryRef = Number(env.salaryRef) || 0;
    const bonusRef = Number(env.bonusRef) || 0;
    env.bonusMonthlyRef = Math.round(bonusRef / 3);
    env.totalMonthlyAllocated = salaryRef + env.bonusMonthlyRef;

    // حساب شهور التراكم والهدف المالي لحصالة الإدخار (الأظرفة التي أشهر تراكمها 0 هي أظرفة صرف دوري وليس لها هدف)
    const accMonths = (env.accumulationMonths !== undefined && env.accumulationMonths !== null && env.accumulationMonths !== '')
      ? Number(env.accumulationMonths)
      : (SAVINGS_ACCUMULATION_MAP[name] !== undefined ? SAVINGS_ACCUMULATION_MAP[name] : 0);
    env.accumulationMonths = accMonths;
    if (accMonths <= 0) {
      env.group = 'الصرف الدوري';
      env.targetAmount = 0;
    } else {
      env.group = 'الإدخار والتراكم';
      env.targetAmount = env.totalMonthlyAllocated * accMonths;
    }

    // الصف 10: مجموع تغذيات الظرف في كافة الدورات
    const annualFed = data.feedingCycles.reduce((sum, c) => {
      const v = c.allocations ? c.allocations[name] : '';
      return sum + (v === '' || v === null ? 0 : (Number(v) || 0));
    }, 0);
    env.annualFed = annualFed;

    // مجموع المصاريف اليومية من هذا الظرف
    const spent = data.expenses
      .filter(e => e.envelope === name)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // الاستلاف الوارد للظرف (سلفة مؤقتة: المتبقي J | تحويل للادخار: المبلغ E)
    const loanInTemp = data.loans
      .filter(l => l.toEnvelope === name && l.type === 'سلفة مؤقتة')
      .reduce((s, l) => s + (Number(l.remainingAmount) || 0), 0);
    const transferInPerm = data.loans
      .filter(l => l.toEnvelope === name && l.type === 'تحويل للادخار')
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);

    // الاستلاف الصادر من الظرف
    const loanOutTemp = data.loans
      .filter(l => l.fromEnvelope === name && l.type === 'سلفة مؤقتة')
      .reduce((s, l) => s + (Number(l.remainingAmount) || 0), 0);
    const transferOutPerm = data.loans
      .filter(l => l.fromEnvelope === name && l.type === 'تحويل للادخار')
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);

    env.netBalance = annualFed - spent + loanInTemp + transferInPerm - loanOutTemp - transferOutPerm;
  });
}

// التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  // مسح أي كاش قديم في المتصفح لضمان عمل أحدث إصدار من الكود دائماً
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.update());
    }).catch(() => {});
  }

  const saved = localStorage.getItem(STORAGE_KEYS.DATA);
  state.data = saved ? JSON.parse(saved) : getInitialSheetSnapshot();

  recalculateSheetFormulasLocally(state.data);

  populateMonthSelector();
  updateConnectionStatusUI();
  renderAll();

  if (state.scriptUrl) {
    syncWithGoogleSheets(true);
  }
});

function saveToLocal() {
  recalculateSheetFormulasLocally(state.data);
  localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(state.data));
}

// تعبئة قائمة اختيار الشهر في الشريط العلوي
function populateMonthSelector() {
  const sel = document.getElementById('monthSelector');
  if (!sel) return;

  // استخراج الأشهر من دورات التغذية + أشهر المصاريف المسجلة
  const monthOptionsMap = new Map();
  monthOptionsMap.set('ALL', '📊 كل الفترات (إجمالي التغذية والمصاريف)');

  // إضافة أشهر المصاريف إن لم تكن في الدورات (مثل أكتوبر 2026)
  state.data.expenses.forEach(e => {
    const ym = String(e.date || '').slice(0, 7);
    if (ym === '2026-10') {
      monthOptionsMap.set('2026-10', '📅 أكتوبر 2026');
    }
  });

  state.data.feedingCycles.forEach(c => {
    const mNum = MONTH_NAME_TO_NUM[c.monthName] || '11';
    const ym = `${c.year}-${mNum}`;
    const isFed = (Number(c.receivedAmount) > 0 || Number(c.distributedTotal) > 0);
    const prevLabel = monthOptionsMap.get(ym);
    const label = `${isFed ? '🟢' : '⚪'} ${c.monthName} ${c.year}`;
    if (!prevLabel || isFed) {
      monthOptionsMap.set(ym, label);
    }
  });

  sel.innerHTML = Array.from(monthOptionsMap.entries())
    .map(([val, label]) => `<option value="${val}">${label}</option>`)
    .join('');

  if (monthOptionsMap.has(state.selectedPeriod)) {
    sel.value = state.selectedPeriod;
  } else {
    state.selectedPeriod = 'ALL';
    sel.value = 'ALL';
  }
}

function onMonthChange(val) {
  state.selectedPeriod = val;
  renderAll();
}

function cycleEnvelopeCategoryFilter() {
  const current = state.envelopeGroupFilter || 'ALL';
  const sequence = ['أساسيات', 'إدخار', 'كماليات', 'ALL'];
  let currentIdx = sequence.indexOf(current);
  let nextIdx = currentIdx + 1;
  if (nextIdx >= sequence.length || nextIdx < 0) {
    nextIdx = 0;
  }
  const nextFilter = sequence[nextIdx];
  setEnvelopeGroupFilter(nextFilter);
  updateFloatingFilterBtnUI(nextFilter, true);
}

// تحديث مظهر زر تصفية الأظرفة (أيقونات فقط بدون نصوص)
function updateFloatingFilterBtnUI(filterVal, showToastNotification = false) {
  const btn = document.getElementById('floatingFilterBtn');
  const icon = document.getElementById('floatingFilterIcon');
  if (!btn || !icon) return;

  const config = {
    'أساسيات': { icon: 'fa-basket-shopping', bg: 'bg-emerald-600', text: 'text-white', msg: '🟢 عرض أظرفة الأساسيات فقط' },
    'إدخار': { icon: 'fa-piggy-bank', bg: 'bg-indigo-600', text: 'text-white', msg: '🔵 عرض أظرفة الإدخار فقط' },
    'كماليات': { icon: 'fa-gamepad', bg: 'bg-amber-600', text: 'text-white', msg: '🟠 عرض أظرفة الكماليات فقط' },
    'ALL': { icon: 'fa-layer-group', bg: 'bg-slate-800', text: 'text-emerald-400', msg: '📊 عرض جميع الأظرفة' }
  };

  const item = config[filterVal] || config['ALL'];
  btn.className = `${item.bg} hover:opacity-90 active:scale-90 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition border border-white/20`;
  icon.className = `fa-solid ${item.icon} text-lg ${item.text}`;

  if (showToastNotification) {
    showToast(item.msg);
  }
}

// تصفية عمليات التحويل والاستلاف في صفحة الاستلاف (سلفة مؤقتة / تحويل للادخار / الجميع)
function cycleLoanTypeFilter() {
  const current = state.loanTypeFilter || 'ALL';
  const sequence = ['سلفة مؤقتة', 'تحويل للادخار', 'ALL'];
  let currentIdx = sequence.indexOf(current);
  let nextIdx = currentIdx + 1;
  if (nextIdx >= sequence.length || nextIdx < 0) {
    nextIdx = 0;
  }
  const nextFilter = sequence[nextIdx];
  state.loanTypeFilter = nextFilter;
  updateFloatingLoanFilterBtnUI(nextFilter, true);
  renderLoansList();
}

// تحديث مظهر زر تصفية الاستلاف (أيقونة فقط بدون نصوص)
function updateFloatingLoanFilterBtnUI(filterVal, showToastNotification = false) {
  const btn = document.getElementById('floatingLoanFilterBtn');
  const icon = document.getElementById('floatingLoanFilterIcon');
  if (!btn || !icon) return;

  const config = {
    'سلفة مؤقتة': { icon: 'fa-hand-holding-dollar', bg: 'bg-blue-600', text: 'text-white', msg: '🔄 عرض: الإستلاف المؤقت فقط' },
    'تحويل للادخار': { icon: 'fa-vault', bg: 'bg-purple-600', text: 'text-white', msg: '🏦 عرض: التصفية الدائمة (تحويل للادخار) فقط' },
    'ALL': { icon: 'fa-arrows-rotate', bg: 'bg-slate-800', text: 'text-blue-400', msg: '📊 عرض: جميع التحويلات والاستلافات' }
  };

  const item = config[filterVal] || config['ALL'];
  btn.className = `${item.bg} hover:opacity-90 active:scale-90 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition border border-white/20`;
  icon.className = `fa-solid ${item.icon} text-lg ${item.text}`;

  if (showToastNotification) {
    showToast(item.msg);
  }
}

// التحكم في ظهور واختفاء الأزرار العائمة حسب الصفحة النشطة
function updateFloatingButtonsVisibility(tabName) {
  const container = document.getElementById('floatingActionsContainer');
  const envFilterBtn = document.getElementById('floatingFilterBtn');
  const loanFilterBtn = document.getElementById('floatingLoanFilterBtn');
  if (!container) return;

  if (tabName === 'feeding') {
    // 4. في صفحة تغذية الأظرفة: لا تظهر أي أيقونة إطلاقاً
    container.classList.add('hidden');
    if (envFilterBtn) envFilterBtn.classList.add('hidden');
    if (loanFilterBtn) loanFilterBtn.classList.add('hidden');
  } else {
    container.classList.remove('hidden');

    if (tabName === 'dashboard') {
      // 1. في صفحة المؤشرات: تظهر فقط أيقونة فلترة الأظرفة (فوق زر +)
      if (envFilterBtn) envFilterBtn.classList.remove('hidden');
      if (loanFilterBtn) loanFilterBtn.classList.add('hidden');
    } else if (tabName === 'expenses') {
      // 2. في صفحة المصاريف: لا تظهر أي أيقونة إضافية فوق زر (+)
      if (envFilterBtn) envFilterBtn.classList.add('hidden');
      if (loanFilterBtn) loanFilterBtn.classList.add('hidden');
    } else if (tabName === 'loans') {
      // 3. في صفحة سجل التحويلات والاستلاف: تظهر فقط أيقونة فلتر أنواع التحويلات
      if (envFilterBtn) envFilterBtn.classList.add('hidden');
      if (loanFilterBtn) loanFilterBtn.classList.remove('hidden');
    } else {
      if (envFilterBtn) envFilterBtn.classList.add('hidden');
      if (loanFilterBtn) loanFilterBtn.classList.add('hidden');
    }
  }
}

// التعامل مع زر الإضافة السريع (+) حسب الصفحة النشطة
function handleFloatingAddClick() {
  const currentTab = state.currentTab || 'dashboard';
  if (currentTab === 'loans') {
    openLoanModal();
  } else {
    openExpenseModal();
  }
}

function setEnvelopeGroupFilter(grp) {
  state.envelopeGroupFilter = grp;
  ['ALL', 'أساسيات', 'كماليات', 'إدخار', 'الصرف الدوري', 'الإدخار والتراكم'].forEach(g => {
    const btn = document.getElementById(`grpBtn-${g}`);
    if (!btn) return;
    if (g === grp) {
      btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-2xs transition';
    } else {
      btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
    }
  });
  updateFloatingFilterBtnUI(grp, false);
  renderDashboardEnvelopesGrid();
  renderCharts();
}

// خريطة افتراضية لشهور التراكم (فقط الأظرفة ذات أهداف التراكم > 0)
const SAVINGS_ACCUMULATION_MAP = {
  'كهرباء': 3,
  'أدوات مدرسية': 12,
  'صيانة منزلية': 12,
  'أثاث منزلي': 12,
  'فاتورة الهاتف': 2,
  'كتب': 6,
  'إلكترونيات': 12,
  'سفر': 12,
  'ملابس موسمية': 6,
  'إدخار': 12,
  'فائض / طوارئ': 12
};

function getDurationBadge(months) {
  if (months === 2) return 'تراكم شهرين';
  if (months === 3) return 'تراكم فصلي (3 أشهر)';
  if (months === 5) return 'تراكم 5 أشهر';
  if (months === 6) return 'تراكم نصف سنوي (6 أشهر)';
  if (months === 12) return 'تراكم سنوي (12 شهراً)';
  return `تراكم ${months} أشهر`;
}

// الحصول على تغذية كل ظرف ومصاريف كل ظرف حسب الشهر المحدد (كما طلب المستخدم: مقارنة تغذية الشهر المحدد مع مصاريف ذلك الشهر فقط)
function getPeriodEnvelopeStats() {
  const period = state.selectedPeriod; // مثال: '2026-11' أو 'ALL'

  // الدورات المطابقة للشهر المحدد
  const matchingCycles = period === 'ALL'
    ? state.data.feedingCycles
    : state.data.feedingCycles.filter(c => {
        const mNum = MONTH_NAME_TO_NUM[c.monthName] || '';
        return `${c.year}-${mNum}` === period;
      });

  // المصاريف المطابقة للشهر المحدد
  const matchingExpenses = period === 'ALL'
    ? state.data.expenses
    : state.data.expenses.filter(e => String(e.date || '').startsWith(period));

  const envStats = state.data.envelopes.map((env, idx) => {
    const fedInPeriod = matchingCycles.reduce((sum, c) => {
      const val = c.allocations ? c.allocations[env.name] : '';
      return sum + (val === '' || val === null ? 0 : (Number(val) || 0));
    }, 0);

    const spentInPeriod = matchingExpenses
      .filter(e => e.envelope === env.name)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // الأظرفة التي أشهر تراكمها 0 هي أظرفة صرف دوري وليس لها هدف
    const accMonths = (env.accumulationMonths !== undefined && env.accumulationMonths !== null && env.accumulationMonths !== '')
      ? Number(env.accumulationMonths)
      : (SAVINGS_ACCUMULATION_MAP[env.name] !== undefined ? SAVINGS_ACCUMULATION_MAP[env.name] : 0);
    const totalMonthlyAlloc = env.totalMonthlyAllocated || ((env.salaryRef || 0) + (env.bonusMonthlyRef || 0));
    const tgtAmount = accMonths > 0 ? (totalMonthlyAlloc * accMonths) : 0;
    const finalGroup = accMonths > 0 ? 'الإدخار والتراكم' : 'الصرف الدوري';

    return {
      ...env,
      group: finalGroup,
      accumulationMonths: accMonths,
      targetAmount: tgtAmount,
      totalMonthlyAllocated: totalMonthlyAlloc,
      color: ENVELOPE_COLORS[idx % ENVELOPE_COLORS.length],
      periodFed: fedInPeriod,
      periodSpent: spentInPeriod,
      periodRemaining: fedInPeriod - spentInPeriod
    };
  });

  return {
    matchingCycles,
    matchingExpenses,
    envStats
  };
}

function formatDZD(num) {
  const val = Number(num) || 0;
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' دج';
}

function updateConnectionStatusUI() {
  const dot = document.getElementById('connectionDot');
  const text = document.getElementById('connectionStatusText');
  if (state.scriptUrl) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    text.textContent = 'متصل مباشرة بملف "ميزانية العائلة"';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    text.textContent = 'بيانات ملفك جاهزة (اضغط ربط الشيت للمزامنة الحية)';
  }
}

// التبديل بين البيانات التجريبية وبيانات الشيت الأصلية
function toggleDemoData() {
  const isDemo = state.data && state.data.expenses && state.data.expenses.length > 5;
  if (isDemo) {
    if (!confirm('هل تريد العودة إلى نسخة البيانات الأصلية لملف الشيت؟')) return;
    state.data = getInitialSheetSnapshot();
    saveToLocal();
    populateMonthSelector();
    updateDemoButtonUI();
    renderAll();
    showToast('تمت استعادة نسخة بيانات ملفك الأصلية');
  } else {
    state.data = getDemoWorkingSnapshot();
    saveToLocal();
    populateMonthSelector();
    updateDemoButtonUI();
    renderAll();
    showToast('تم تحميل بيانات تجريبية واقعية تحاكي العمل اليومي');
  }
}

function updateDemoButtonUI() {
  const btn = document.getElementById('btnToggleDemo');
  const text = document.getElementById('btnToggleDemoText');
  if (!btn || !text) return;
  const isDemo = state.data && state.data.expenses && state.data.expenses.length > 5;
  if (isDemo) {
    btn.className = 'bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition';
    text.textContent = 'بيانات محاكاة نشطة';
    btn.title = 'البيانات التجريبية مفعلة حالياً - اضغط للعودة إلى بيانات الشيت الأصلية';
  } else {
    btn.className = 'bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition';
    text.textContent = 'ملء بيانات تجريبية';
    btn.title = 'اضغط لتعبئة بيانات تجريبية واقعية لمحاكاة العمل';
  }
}

// ==================== تحديث كافة عناصر الواجهة ====================
function renderAll() {
  updateDemoButtonUI();
  populateEnvelopeSelects();
  renderAccountCards();
  renderSummaryCards();
  renderDashboardEnvelopesGrid();
  renderCharts();
  renderExpensesList();
  renderLoansList();
  renderFeedingView();
  updateSweepCardSummary();
  updateFloatingButtonsVisibility(state.currentTab || 'dashboard');
  updateFloatingFilterBtnUI(state.envelopeGroupFilter || 'ALL', false);
  updateFloatingLoanFilterBtnUI(state.loanTypeFilter || 'ALL', false);
}

// عرض أرصدة الحسابات الأربعة ومحافظ السيولة (CCP، كاش، أورو، USDT)
function renderAccountCards() {
  const accounts = (state.data && state.data.accounts) || {
    ccp: { balance: 54138, totalIn: 104200, totalOut: 50062, currency: 'دج' },
    cash: { balance: 50000, totalIn: 50000, totalOut: 0, currency: 'دج' },
    euro: { balance: 0, totalIn: 0, totalOut: 0, currency: '€' },
    usdt: { balance: 0, totalIn: 0, totalOut: 0, currency: '$' }
  };

  const fmt = (val, cur) => {
    if (cur === '€') return `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    if (cur === '$') return `${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    return `${Number(val || 0).toLocaleString('fr-FR')} دج`;
  };

  const ccp = accounts.ccp || {};
  const cash = accounts.cash || {};
  const euro = accounts.euro || {};
  const usdt = accounts.usdt || {};

  const elBalCcp = document.getElementById('accBalance-ccp');
  const elInCcp = document.getElementById('accIn-ccp');
  const elOutCcp = document.getElementById('accOut-ccp');
  if (elBalCcp) elBalCcp.textContent = fmt(ccp.balance, 'دج');
  if (elInCcp) elInCcp.textContent = fmt(ccp.totalIn, 'دج');
  if (elOutCcp) elOutCcp.textContent = fmt(ccp.totalOut, 'دج');

  const elBalCash = document.getElementById('accBalance-cash');
  const elInCash = document.getElementById('accIn-cash');
  const elOutCash = document.getElementById('accOut-cash');
  if (elBalCash) elBalCash.textContent = fmt(cash.balance, 'دج');
  if (elInCash) elInCash.textContent = fmt(cash.totalIn, 'دج');
  if (elOutCash) elOutCash.textContent = fmt(cash.totalOut, 'دج');

  const elBalEuro = document.getElementById('accBalance-euro');
  const elInEuro = document.getElementById('accIn-euro');
  const elOutEuro = document.getElementById('accOut-euro');
  if (elBalEuro) elBalEuro.textContent = fmt(euro.balance, '€');
  if (elInEuro) elInEuro.textContent = fmt(euro.totalIn, '€');
  if (elOutEuro) elOutEuro.textContent = fmt(euro.totalOut, '€');

  const elBalUsdt = document.getElementById('accBalance-usdt');
  const elInUsdt = document.getElementById('accIn-usdt');
  const elOutUsdt = document.getElementById('accOut-usdt');
  if (elBalUsdt) elBalUsdt.textContent = fmt(usdt.balance, '$');
  if (elInUsdt) elInUsdt.textContent = fmt(usdt.totalIn, '$');
  if (elOutUsdt) elOutUsdt.textContent = fmt(usdt.totalOut, '$');
}

function populateEnvelopeSelects() {
  const buildOptionsHtml = (markEmpty = false) => ['الصرف الدوري', 'الإدخار والتراكم', 'احتياطي وتدوير'].map(groupName => {
    const items = state.data.envelopes.filter(e => e.group === groupName);
    const options = items.map(e => {
      const bal = Number(e.netBalance) || 0;
      const prefix = (markEmpty && bal <= 0) ? '🚫 ' : '';
      const suffix = (markEmpty && bal <= 0) ? ' - رصيد غير كافٍ' : '';
      return `<option value="${escapeHtml(e.name)}">${prefix}${escapeHtml(e.name)} (المتاح: ${formatDZD(bal)}${suffix})</option>`;
    }).join('');
    return `<optgroup label="${groupName}">${options}</optgroup>`;
  }).join('');

  const expEnv = document.getElementById('expEnvelope');
  const loanFrom = document.getElementById('loanFromEnvelope');
  const loanTo = document.getElementById('loanToEnvelope');
  const filterEnv = document.getElementById('filterEnvelopeSelect');

  if (expEnv) expEnv.innerHTML = buildOptionsHtml(true);
  if (loanFrom) loanFrom.innerHTML = buildOptionsHtml(true);
  if (loanTo) loanTo.innerHTML = buildOptionsHtml(false);

  if (filterEnv) {
    const prev = filterEnv.value || 'ALL';
    filterEnv.innerHTML = `<option value="ALL">كل الأظرفة (23)</option>` +
      state.data.envelopes.map(e => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)}</option>`).join('');
    filterEnv.value = prev;
  }
}

function renderSummaryCards() {
  const { matchingCycles, matchingExpenses, envStats } = getPeriodEnvelopeStats();

  const totalMonthlyAllocatedSum = envStats.reduce((s, e) => s + (Number(e.totalMonthlyAllocated) || 0), 0);
  const totalPeriodFed = envStats.reduce((s, e) => s + e.periodFed, 0);
  const totalPeriodSpent = matchingExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const periodRem = totalMonthlyAllocatedSum - totalPeriodSpent;
  const pct = totalMonthlyAllocatedSum > 0 ? Math.round((totalPeriodSpent / totalMonthlyAllocatedSum) * 100) : 0;

  const cashSpent = matchingExpenses
    .filter(e => e.paymentMethod === 'كاش')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const baridiSpent = matchingExpenses
    .filter(e => e.paymentMethod === 'بريدي موب')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const totalNetAvailable = state.data.envelopes.reduce((s, e) => s + (Number(e.netBalance) || 0), 0);
  const totalPendingLoans = state.data.loans
    .filter(l => l.type === 'سلفة مؤقتة')
    .reduce((s, l) => s + (Number(l.remainingAmount) || 0), 0);

  document.getElementById('statMonthFed').textContent = formatDZD(totalMonthlyAllocatedSum);
  document.getElementById('statMonthFedSub').textContent = `تغذية الشهر المسجلة: ${formatDZD(totalPeriodFed)}`;

  document.getElementById('statMonthSpent').textContent = formatDZD(totalPeriodSpent);
  document.getElementById('statMonthPaymentSplit').textContent = `كاش: ${formatDZD(cashSpent)} | بريدي: ${formatDZD(baridiSpent)}`;

  const remEl = document.getElementById('statMonthRemaining');
  remEl.textContent = formatDZD(periodRem);
  remEl.className = `text-lg sm:text-2xl font-extrabold ${periodRem < 0 ? 'text-red-600' : 'text-emerald-600'}`;

  const remPct = totalMonthlyAllocatedSum > 0 ? Math.max(0, Math.min(100, Math.round((periodRem / totalMonthlyAllocatedSum) * 100))) : 0;
  const progBar = document.getElementById('statProgressBar');
  progBar.style.width = `${remPct}%`;
  progBar.className = `h-full rounded-full transition-all duration-500 ${remPct > 50 ? 'bg-emerald-500' : remPct > 20 ? 'bg-amber-500' : 'bg-red-500'}`;

  document.getElementById('statTotalNetAvailable').textContent = formatDZD(totalNetAvailable);
  document.getElementById('statPendingLoansNote').textContent = `سلف مؤقتة معلقة: ${formatDZD(totalPendingLoans)}`;

  // فحص الأظرفة التي أصبح رصيدها الصافي سالباً (عجز مالي حقيقي فقط)
  // الأظرفة المغطاة بالرصيد المتاح (سواء عبر التراكم السابق أو الاستلاف) لا يظهر فيها تحذير طالما رصيدها موجب
  const alerts = [];
  envStats.forEach(e => {
    const netBal = Number(e.netBalance) || 0;
    if (netBal < 0) {
      alerts.push(`${e.name} (عجز مالي في الرصيد: ${formatDZD(netBal)})`);
    }
  });

  const banner = document.getElementById('overBudgetBanner');
  const bannerText = document.getElementById('overBudgetText');
  if (alerts.length > 0) {
    banner.classList.remove('hidden');
    bannerText.textContent = alerts.join(' ، ');
  } else {
    banner.classList.add('hidden');
  }
}

function toggleEnvelopeExpand(envName, event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (!state.expandedEnvelopes) {
    state.expandedEnvelopes = new Set();
  }
  const wasExpanded = state.expandedEnvelopes.has(envName);
  // إغلاق تفاصيل كافة الأظرفة الأخرى دائماً
  state.expandedEnvelopes.clear();
  if (!wasExpanded) {
    // فتح تفاصيل هذا الظرف فقط
    state.expandedEnvelopes.add(envName);
  }
  renderDashboardEnvelopesGrid();
}

// عرض الأظرفة الـ 23 في لوحة التحكم مقسمة حسب الفئات المعتمدة في "الأظرفة الموحدة"
function renderDashboardEnvelopesGrid() {
  const container = document.getElementById('dashboardEnvelopesGrid');
  const { envStats } = getPeriodEnvelopeStats();

  const isCategoryMatch = (envCat, f) => {
    if (f === 'ALL') return true;
    if (f === 'إدخار' || f === 'استثمار وادخار') {
      return envCat === 'إدخار' || envCat === 'استثمار وادخار';
    }
    return envCat === f;
  };

  const filterVal = state.envelopeGroupFilter || 'ALL';
  const filtered = filterVal === 'ALL'
    ? envStats
    : ['أساسيات', 'كماليات', 'إدخار', 'استثمار وادخار', 'احتياطي وتدوير'].includes(filterVal)
    ? envStats.filter(e => isCategoryMatch(e.majorCategory || MAJOR_CATEGORY_MAP[e.name], filterVal))
    : filterVal === 'الصرف الدوري'
    ? envStats.filter(e => Number(e.accumulationMonths) <= 0 || e.group === 'الصرف الدوري')
    : filterVal === 'الإدخار والتراكم'
    ? envStats.filter(e => Number(e.accumulationMonths) > 0)
    : envStats.filter(e => e.group === filterVal);

  container.className = 'space-y-5';
  const majorCats = ['أساسيات', 'كماليات', 'استثمار وادخار', 'احتياطي وتدوير'];

  container.innerHTML = majorCats.map(majorCat => {
    const catEnvs = filtered.filter(e => {
      const cat = e.majorCategory || MAJOR_CATEGORY_MAP[e.name] || 'أساسيات';
      if (majorCat === 'استثمار وادخار') return cat === 'استثمار وادخار' || cat === 'إدخار';
      return cat === majorCat;
    });
    if (catEnvs.length === 0) return '';

    const catAlloc = catEnvs.reduce((s, e) => s + e.totalMonthlyAllocated, 0);
    const catFed = catEnvs.reduce((s, e) => s + e.periodFed, 0);
    const catSpent = catEnvs.reduce((s, e) => s + e.periodSpent, 0);
    const catNet = catEnvs.reduce((s, e) => s + (Number(e.netBalance) || 0), 0);
    const catPct = catAlloc > 0 ? Math.round((catSpent / catAlloc) * 100) : 0;

    const headerStyle = majorCat === 'أساسيات'
      ? 'bg-emerald-900 text-white'
      : majorCat === 'كماليات'
      ? 'bg-amber-800 text-white'
      : majorCat === 'استثمار وادخار'
      ? 'bg-indigo-900 text-white'
      : 'bg-purple-900 text-white';

    const icon = majorCat === 'أساسيات' ? '🟢' : majorCat === 'كماليات' ? '🟠' : majorCat === 'استثمار وادخار' ? '🔵' : '🟣';

    return `
      <div class="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
        <!-- شريط عنوان التصنيف الكبير وإجمالياته -->
        <div class="${headerStyle} px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">${icon}</span>
            <span class="font-extrabold text-sm sm:text-base">تصنيف: ${majorCat} (${catEnvs.length} أظرفة)</span>
          </div>
          <div class="hidden lg:flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span class="bg-white/15 px-2.5 py-1 rounded-lg">المخصص: <b>${formatDZD(catAlloc)}</b></span>
            <span class="bg-white/15 px-2.5 py-1 rounded-lg">تغذية الشهر: <b>${formatDZD(catFed)}</b></span>
            <span class="bg-white/15 px-2.5 py-1 rounded-lg">مصروف الشهر: <b>${formatDZD(catSpent)} (${catPct}%)</b></span>
            <span class="bg-emerald-400/25 border border-emerald-300/40 px-2.5 py-1 rounded-lg font-extrabold">صافي المتاح: ${formatDZD(catNet)}</span>
          </div>
        </div>

        <!-- شبكة أظرفة هذا التصنيف -->
        <div class="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${catEnvs.map(env => {
            // الأظرفة التي أشهر تراكمها 0 هي أظرفة صرف دوري وليس لها هدف (فقط الأظرفة ذات التراكم > 0 تعتبر حصالات تراكمية)
            const isSavingsGoal = Number(env.accumulationMonths) > 0;
            const isExpanded = state.expandedEnvelopes && state.expandedEnvelopes.has(env.name);
            const accType = env.accountType || ENVELOPE_ACCOUNT_MAP[env.name] || 'كاش';
            const accBadge = accType === 'كاش'
              ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">💵 كاش</span>'
              : (accType.includes('USDT') || accType.includes('$'))
              ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">🌐 USDT</span>'
              : (accType.includes('أورو') || accType.includes('يورو') || accType.includes('€'))
              ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">💶 يورو</span>'
              : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">🏦 حساب CCP</span>';

            // إذا كان الظرف من نوع حصالة ادخار وتراكم موسمي (شهور التراكم من شيت الأظرفة الموحدة)
            if (isSavingsGoal) {
              const accMonths = Number(env.accumulationMonths);
              const target = env.targetAmount || (env.totalMonthlyAllocated * accMonths);
              const currentSaved = Math.max(0, Number(env.netBalance) || 0);
              const goalPct = target > 0 ? Math.round((currentSaved / target) * 100) : 0;
              const remainingDZD = Math.max(0, target - currentSaved);
              const remainingMonths = env.totalMonthlyAllocated > 0 ? Math.ceil(remainingDZD / env.totalMonthlyAllocated) : 0;
              const isGoalMet = currentSaved >= target && target > 0;

              return `
                <div
                  onclick="toggleEnvelopeExpand('${escapeHtml(env.name)}', event)"
                  class="bg-white p-3 rounded-xl border border-indigo-200/90 hover:border-indigo-400 cursor-pointer transition shadow-2xs space-y-2 select-none group"
                >
                  <!-- سطر 1: الاسم والرصيد الحالي وأيقونة التوسيع -->
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-base shrink-0">🏦</span>
                      <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">${escapeHtml(env.name)}</h3>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span class="text-xs sm:text-sm font-extrabold text-indigo-950 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 whitespace-nowrap">
                        المجمّع: ${formatDZD(env.netBalance)}
                      </span>
                      <i class="fa-solid fa-chevron-down text-indigo-400 text-[11px] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-700' : ''}"></i>
                    </div>
                  </div>

                  <!-- سطر 2: شريط التقدم ونسبة بلوغ الهدف -->
                  <div class="space-y-1">
                    <div class="flex justify-between items-center text-[10px]">
                      <span class="text-slate-600 font-medium truncate">
                        ${isGoalMet
                          ? '<span class="text-emerald-700 font-extrabold">🎉 تم بلوغ الهدف!</span>'
                          : `باقي: <b class="text-slate-800">${formatDZD(remainingDZD)}</b> <span class="text-slate-400 text-[9px]">(${remainingMonths} ${remainingMonths === 1 ? 'شهر' : 'أشهر'})</span>`}
                      </span>
                      <span class="font-black ${isGoalMet ? 'text-emerald-600' : 'text-indigo-700'} shrink-0">${goalPct}%</span>
                    </div>
                    <div class="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200/70 shadow-inner">
                      <div
                        class="h-full rounded-full transition-all duration-500 ${isGoalMet ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600'}"
                        style="width: ${Math.min(goalPct, 100)}%"
                      ></div>
                    </div>
                  </div>

                  <!-- التفاصيل الموسعة تظهر فقط عند النقر -->
                  ${isExpanded ? `
                    <div class="pt-2.5 border-t border-indigo-100 space-y-2.5" onclick="event.stopPropagation()">
                      <div class="flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          ${accBadge}
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            🎯 ${getDurationBadge(accMonths)}
                          </span>
                          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                            قسط: ${formatDZD(env.totalMonthlyAllocated)}/ش
                          </span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <button
                            type="button"
                            onclick="openEnvelopeExpenses('${escapeHtml(env.name)}', event)"
                            class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-slate-200 transition active:scale-95"
                            title="عرض قائمة المصاريف المفلترة حسب هذا الظرف"
                          >
                            <i class="fa-solid fa-receipt text-[10px] text-indigo-600"></i>
                            <span>سجل المصاريف</span>
                          </button>
                          <button
                            type="button"
                            onclick="event.stopPropagation(); openExpenseModal(null, '${escapeHtml(env.name)}')"
                            class="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs transition active:scale-95"
                          >
                            <i class="fa-solid fa-plus text-[10px]"></i>
                            <span>تسجيل مصروف</span>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-3 gap-1 text-center text-[11px] bg-indigo-50/40 rounded-lg p-1.5 border border-indigo-100/60">
                        <div>
                          <span class="text-slate-400 block text-[10px]">الهدف المالي</span>
                          <b class="text-indigo-950 font-extrabold">${formatDZD(target)}</b>
                        </div>
                        <div>
                          <span class="text-slate-400 block text-[10px]">القسط الشهري</span>
                          <b class="text-blue-700 font-bold">${formatDZD(env.totalMonthlyAllocated)}</b>
                        </div>
                        <div>
                          <span class="text-slate-400 block text-[10px]">مصروف الشهر</span>
                          <b class="text-rose-600 font-bold">${formatDZD(env.periodSpent)}</b>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }

            // التصميم القياسي لأظرفة الصرف الدوري: شريط الرصيد المتبقي (يبدأ ممتلئ 100% ويتناقص عند الصرف حتى ينعدم)
            const alloc = env.totalMonthlyAllocated || 0;
            const currentBal = Math.max(0, Number(env.netBalance) || 0);
            const remPct = alloc > 0 ? Math.min(100, Math.round((currentBal / alloc) * 100)) : (currentBal > 0 ? 100 : 0);
            const barColor = remPct > 50
              ? 'bg-emerald-500'
              : remPct > 20
              ? 'bg-amber-500'
              : 'bg-rose-500';

            const groupBadge = env.group === 'الصرف الدوري'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-slate-100 text-slate-600';

            return `
              <div
                onclick="toggleEnvelopeExpand('${escapeHtml(env.name)}', event)"
                class="bg-white p-3 rounded-xl border border-slate-200/90 hover:border-emerald-400 cursor-pointer transition shadow-2xs space-y-2 select-none group"
              >
                <!-- سطر 1: الاسم والرصيد الحالي وأيقونة التوسيع -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${env.color}"></span>
                    <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">${escapeHtml(env.name)}</h3>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-xs sm:text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 whitespace-nowrap">
                      المتاح: ${formatDZD(env.netBalance)}
                    </span>
                    <i class="fa-solid fa-chevron-down text-slate-400 text-[11px] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-emerald-600' : ''}"></i>
                  </div>
                </div>

                <!-- سطر 2: شريط الرصيد المتبقي (يبدأ ممتلئاً ويتناقص مع الصرف حتى ينعدم) -->
                <div class="space-y-1">
                  <div class="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>المتبقي من المخصص</span>
                    <span class="font-bold ${remPct > 20 ? 'text-emerald-700' : 'text-rose-600'}">${remPct}%</span>
                  </div>
                  <div class="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
                    <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${remPct}%"></div>
                  </div>
                </div>

                <!-- التفاصيل الموسعة تظهر فقط عند النقر -->
                ${isExpanded ? `
                  <div class="pt-2.5 border-t border-slate-100 space-y-2.5" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${accBadge}
                        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${groupBadge} shrink-0">
                          ${escapeHtml(env.group)}
                        </span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          onclick="openEnvelopeExpenses('${escapeHtml(env.name)}', event)"
                          class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-slate-200 transition active:scale-95"
                          title="عرض قائمة المصاريف المفلترة حسب هذا الظرف"
                        >
                          <i class="fa-solid fa-receipt text-[10px] text-emerald-600"></i>
                          <span>سجل المصاريف</span>
                        </button>
                        <button
                          type="button"
                          onclick="event.stopPropagation(); openExpenseModal(null, '${escapeHtml(env.name)}')"
                          class="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs transition active:scale-95"
                        >
                          <i class="fa-solid fa-plus text-[10px]"></i>
                          <span>تسجيل مصروف</span>
                        </button>
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-1 text-center text-[11px] bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                      <div>
                        <span class="text-slate-400 block text-[10px]">المخصص</span>
                        <b class="text-blue-700">${formatDZD(env.totalMonthlyAllocated)}</b>
                      </div>
                      <div>
                        <span class="text-slate-400 block text-[10px]">تغذية الشهر</span>
                        <b class="text-slate-700">${formatDZD(env.periodFed)}</b>
                      </div>
                      <div>
                        <span class="text-slate-400 block text-[10px]">مصاريف الشهر</span>
                        <b class="text-rose-600">${formatDZD(env.periodSpent)}</b>
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// رسم المخططات الأربعة
function renderCharts() {
  const { matchingExpenses, envStats } = getPeriodEnvelopeStats();
  Chart.defaults.font.family = 'Cairo, sans-serif';

  const filterVal = state.envelopeGroupFilter || 'ALL';
  const filteredEnvs = filterVal === 'ALL'
    ? envStats
    : ['أساسيات', 'كماليات', 'إدخار'].includes(filterVal)
    ? envStats.filter(e => (e.majorCategory || MAJOR_CATEGORY_MAP[e.name]) === filterVal)
    : envStats.filter(e => e.group === filterVal);

  // 1. مخطط الأعمدة: الميزانية المخصصة (الراتب + المردودية) مقابل مصاريف الشهر لكل ظرف
  const labels = filteredEnvs.map(e => e.name);
  const allocatedData = filteredEnvs.map(e => e.totalMonthlyAllocated);
  const spentData = filteredEnvs.map(e => e.periodSpent);

  const ctxBar = document.getElementById('budgetVsActualChart').getContext('2d');
  if (charts.budgetVsActual) charts.budgetVsActual.destroy();
  charts.budgetVsActual = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'الميزانية المخصصة (الراتب + المردودية)',
          data: allocatedData,
          backgroundColor: '#3b82f6',
          borderRadius: 5
        },
        {
          label: 'مصاريف الشهر',
          data: spentData,
          backgroundColor: '#f43f5e',
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 2. المخطط الدائري: توزيع المصاريف / الميزانية حسب الظرف مع فلترة مرنة
  const pieSelect = document.getElementById('pieChartFilter');
  if (pieSelect) {
    pieSelect.value = state.pieChartFilter || 'ALL';
  }

  const metricSelect = document.getElementById('pieChartMetric');
  if (metricSelect) {
    metricSelect.value = state.pieChartMetric || 'SPENT';
  }

  const metric = state.pieChartMetric || 'SPENT';
  const pieTitle = document.getElementById('pieChartTitle');
  if (pieTitle) {
    pieTitle.textContent = metric === 'ALLOCATED'
      ? 'توزيع الميزانية المخصصة حسب الظرف'
      : metric === 'NET_BALANCE'
      ? 'توزيع الرصيد المتاح حسب الظرف'
      : 'توزيع المصاريف حسب الظرف';
  }

  let filteredForPie = envStats;
  const pieFilter = state.pieChartFilter || 'ALL';

  if (pieFilter === 'CAT_ESSENTIALS' || pieFilter === 'أساسيات') {
    filteredForPie = envStats.filter(e => (e.majorCategory || MAJOR_CATEGORY_MAP[e.name]) === 'أساسيات');
  } else if (pieFilter === 'CAT_LUXURIES' || pieFilter === 'كماليات') {
    filteredForPie = envStats.filter(e => (e.majorCategory || MAJOR_CATEGORY_MAP[e.name]) === 'كماليات');
  } else if (pieFilter === 'CAT_SAVINGS' || pieFilter === 'إدخار' || pieFilter === 'ادخار' || pieFilter === 'استثمار وادخار') {
    filteredForPie = envStats.filter(e => {
      const cat = e.majorCategory || MAJOR_CATEGORY_MAP[e.name];
      return cat === 'إدخار' || cat === 'استثمار وادخار';
    });
  } else if (pieFilter === 'GRP_SPENDING' || pieFilter === 'أظرفة الصرف') {
    filteredForPie = envStats.filter(e => e.group === 'الصرف الدوري');
  } else if (pieFilter === 'GRP_SAVINGS' || pieFilter === 'أظرفة الادخار') {
    filteredForPie = envStats.filter(e => e.group === 'الإدخار والتراكم');
  }

  // استخراج القيمة للظرف بناءً على نوع المقياس المختار (مصاريف | ميزانية مخصصة | رصيد متاح)
  const getEnvVal = (e) => {
    if (metric === 'ALLOCATED') return e.totalMonthlyAllocated || 0;
    if (metric === 'NET_BALANCE') return Math.max(0, Number(e.netBalance) || 0);
    return e.periodSpent || 0;
  };

  const chartEnvs = filteredForPie.filter(e => getEnvVal(e) > 0);
  const totalPieSum = chartEnvs.reduce((sum, e) => sum + getEnvVal(e), 0);

  const ctxPie = document.getElementById('categoryPieChart').getContext('2d');
  if (charts.categoryPie) charts.categoryPie.destroy();
  charts.categoryPie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: chartEnvs.length ? chartEnvs.map(e => e.name) : ['لا توجد مبالغ مسجلة لهذا الفلتر'],
      datasets: [{
        data: chartEnvs.length ? chartEnvs.map(e => getEnvVal(e)) : [1],
        backgroundColor: chartEnvs.length ? chartEnvs.map(e => e.color) : ['#e2e8f0'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (!chartEnvs.length) return ' لا توجد بيانات';
              const val = ctx.raw || 0;
              const pct = totalPieSum > 0 ? Math.round((val / totalPieSum) * 100) : 0;
              return ` ${ctx.label}: ${formatDZD(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // 3. المخطط الخطي: تطور المصاريف اليومية
  const dailyMap = {};
  matchingExpenses.forEach(e => {
    const d = e.date || 'غير محدد';
    dailyMap[d] = (dailyMap[d] || 0) + (Number(e.amount) || 0);
  });
  const sortedDates = Object.keys(dailyMap).sort();
  const dailyVals = sortedDates.map(d => dailyMap[d]);

  const ctxLine = document.getElementById('timelineChart').getContext('2d');
  if (charts.timeline) charts.timeline.destroy();
  charts.timeline = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: sortedDates.length ? sortedDates : ['لا توجد عمليات'],
      datasets: [{
        label: 'إجمالي المصروف اليومي (دج)',
        data: dailyVals.length ? dailyVals : [0],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 4. مخطط طريقة الدفع (كاش مقابل بريدي موب)
  const cashSum = matchingExpenses.filter(e => e.paymentMethod === 'كاش').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const baridiSum = matchingExpenses.filter(e => e.paymentMethod === 'بريدي موب').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const ctxPay = document.getElementById('paymentMethodChart').getContext('2d');
  if (charts.paymentMethod) charts.paymentMethod.destroy();
  charts.paymentMethod = new Chart(ctxPay, {
    type: 'doughnut',
    data: {
      labels: ['💵 كاش', '📱 بريدي موب'],
      datasets: [{
        data: (cashSum + baridiSum) > 0 ? [cashSum, baridiSum] : [1, 0],
        backgroundColor: (cashSum + baridiSum) > 0 ? ['#10b981', '#3b82f6'] : ['#e2e8f0', '#e2e8f0'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function onPieChartFilterChange(val) {
  state.pieChartFilter = val;
  renderCharts();
}

function onPieChartMetricChange(val) {
  state.pieChartMetric = val;
  renderCharts();
}

// ==================== عرض وإدارة "المصاريف اليومية" ====================
function renderExpensesList() {
  const container = document.getElementById('expensesListContainer');
  const query = (document.getElementById('searchExpenseInput')?.value || '').trim().toLowerCase();
  const envFilter = document.getElementById('filterEnvelopeSelect')?.value || 'ALL';
  const payFilter = document.getElementById('filterPaymentSelect')?.value || 'ALL';

  let list = state.selectedPeriod === 'ALL'
    ? [...state.data.expenses]
    : state.data.expenses.filter(e => String(e.date || '').startsWith(state.selectedPeriod));

  if (envFilter !== 'ALL') {
    list = list.filter(e => e.envelope === envFilter);
  }
  if (payFilter !== 'ALL') {
    list = list.filter(e => e.paymentMethod === payFilter);
  }
  if (query) {
    list = list.filter(e =>
      String(e.statement || '').toLowerCase().includes(query) ||
      String(e.note || '').toLowerCase().includes(query) ||
      String(e.envelope || '').toLowerCase().includes(query)
    );
  }

  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const statsContainer = document.getElementById('expensesFilteredStats');
  if (statsContainer) {
    if (list.length === 0) {
      statsContainer.innerHTML = '';
    } else {
      const totalAmount = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const cashAmount = list.filter(e => e.paymentMethod === 'كاش').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const baridiAmount = totalAmount - cashAmount;

      // حساب تكرار البنود (البيان) وإجمالي كل بند
      const itemMap = {};
      list.forEach(e => {
        const rawName = String(e.statement || e.envelope || 'غير محدد').trim();
        const key = rawName.toLowerCase();
        if (!itemMap[key]) {
          itemMap[key] = { name: rawName, count: 0, total: 0 };
        }
        itemMap[key].count += 1;
        itemMap[key].total += (Number(e.amount) || 0);
      });

      const itemsArr = Object.values(itemMap);
      itemsArr.sort((a, b) => (b.count - a.count) || (b.total - a.total));
      const topFreqItem = itemsArr[0];

      const byTotalArr = [...itemsArr].sort((a, b) => (b.total - a.total) || (b.count - a.count));
      const topSpentItem = byTotalArr[0];

      const countWord = (n) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : `${n} مرات`);
      const opWord = (n) => (n === 1 ? 'عملية' : n === 2 ? 'عمليتين' : `${n} عمليات`);

      statsContainer.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <!-- 1. إجمالي القائمة المفلترة وعدد العمليات -->
          <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/70 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] font-bold text-slate-400">إجمالي القائمة (${opWord(list.length)})</div>
              <div class="text-base sm:text-lg font-extrabold text-rose-600 mt-0.5 truncate">${formatDZD(totalAmount)}</div>
              <div class="text-[10px] text-slate-500 mt-0.5 truncate">كاش: ${formatDZD(cashAmount)} | بريدي: ${formatDZD(baridiAmount)}</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-calculator text-sm"></i>
            </div>
          </div>

          <!-- 2. أكثر بند متكرر وعدد مصاريفه -->
          <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-amber-200/80 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] font-bold text-amber-700">🔁 أكثر بند متكرر</div>
              <div class="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5 truncate" title="${escapeHtml(topFreqItem.name)}">
                ${escapeHtml(topFreqItem.name)}
              </div>
              <div class="text-[11px] font-bold text-amber-600 mt-0.5 truncate">
                عدد مصاريفه: ${countWord(topFreqItem.count)} • (${formatDZD(topFreqItem.total)})
              </div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-amber-200">
              ×${topFreqItem.count}
            </div>
          </div>

          <!-- 3. الأعلى تكلفة في القائمة -->
          <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-indigo-200/80 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] font-bold text-indigo-700">🔥 الأعلى تكلفة</div>
              <div class="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5 truncate" title="${escapeHtml(topSpentItem.name)}">
                ${escapeHtml(topSpentItem.name)}
              </div>
              <div class="text-[11px] font-bold text-indigo-600 mt-0.5 truncate">
                إجمالي: ${formatDZD(topSpentItem.total)} (${opWord(topSpentItem.count)})
              </div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
              <i class="fa-solid fa-arrow-trend-up text-sm"></i>
            </div>
          </div>
        </div>
      `;
    }
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center border border-slate-200/70">
        <i class="fa-solid fa-receipt text-3xl text-slate-300 mb-2"></i>
        <p class="text-sm text-slate-600 font-bold">لا توجد مصاريف مسجلة في هذه الفترة</p>
        <p class="text-xs text-slate-400 mt-1">يمكنك تغيير الشهر من القائمة العلوية (مثلاً: أكتوبر 2026 أو كل الفترات) أو إضافة مصروف جديد</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(exp => {
    const isCash = exp.paymentMethod === 'كاش';
    const payBadge = isCash
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';

    return `
      <div class="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/70 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <i class="fa-solid fa-bag-shopping"></i>
          </div>
          <div class="min-w-0">
            <div class="font-bold text-slate-800 text-sm sm:text-base truncate">${escapeHtml(exp.statement || exp.envelope)}</div>
            <div class="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">${escapeHtml(exp.envelope)}</span>
              <span class="px-2 py-0.5 rounded-md border font-semibold ${payBadge}">${isCash ? '💵 كاش' : '📱 بريدي موب'}</span>
              <span dir="ltr" class="text-slate-400"><i class="fa-regular fa-calendar ml-1"></i>${escapeHtml(exp.date)}</span>
              ${exp.note ? `<span class="text-slate-400">• ${escapeHtml(exp.note)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="text-base sm:text-lg font-extrabold text-rose-600">${formatDZD(exp.amount)}</span>
          <div class="flex items-center gap-1">
            <button
              onclick="openExpenseModal(${exp.rowIndex})"
              class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition"
              title="تعديل"
            >
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button
              onclick="handleDeleteExpense(${exp.rowIndex})"
              class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition"
              title="حذف"
            >
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getAvailableBalanceForExpense(envName, editingRowIndex = null) {
  const env = state.data.envelopes.find(e => e.name === envName);
  if (!env) return 0;
  let available = Number(env.netBalance) || 0;

  if (editingRowIndex) {
    const oldExp = state.data.expenses.find(e => Number(e.rowIndex) === Number(editingRowIndex));
    if (oldExp && oldExp.envelope === envName) {
      available += (Number(oldExp.amount) || 0);
    }
  }
  return available;
}

function validateExpenseModalLive() {
  const rowIndexInput = document.getElementById('expRowIndex')?.value || null;
  const envName = document.getElementById('expEnvelope')?.value || '';
  const amountVal = Number(document.getElementById('expAmount')?.value) || 0;

  const hintBox = document.getElementById('expenseBalanceHintBox');
  const hintText = document.getElementById('expenseBalanceHintText');
  const maxBadge = document.getElementById('expenseBalanceMaxBadge');
  if (!hintBox || !hintText || !maxBadge) return true;

  const available = getAvailableBalanceForExpense(envName, rowIndexInput);

  if (available <= 0) {
    hintBox.className = 'rounded-xl p-3 text-xs border bg-red-50 border-red-300 text-red-700 flex items-center justify-between';
    hintText.innerHTML = `<i class="fa-solid fa-ban ml-1"></i> ظرف <b>"${escapeHtml(envName)}"</b> رصيده الفعلي 0 دج (يجب تغذيته أو الاستلاف له أولاً)`;
    maxBadge.textContent = `المتاح: ${formatDZD(available)}`;
    return false;
  }

  if (amountVal > available) {
    hintBox.className = 'rounded-xl p-3 text-xs border bg-red-50 border-red-300 text-red-700 flex items-center justify-between';
    hintText.innerHTML = `<i class="fa-solid fa-ban ml-1"></i> <b>مرفوض:</b> المبلغ أكبر من الرصيد الموجود في ظرف <b>"${escapeHtml(envName)}"</b> ولا يمكن أن يصبح الظرف سالباً!`;
    maxBadge.textContent = `الحد الأقصى: ${formatDZD(available)}`;
    return false;
  }

  hintBox.className = 'rounded-xl p-3 text-xs border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center justify-between';
  hintText.innerHTML = `<i class="fa-solid fa-circle-check ml-1 text-emerald-600"></i> الرصيد المتاح في <b>"${escapeHtml(envName)}"</b> كافٍ${amountVal > 0 ? ` (المتبقي بعد الصرف: <b>${formatDZD(available - amountVal)}</b>)` : ''}`;
  maxBadge.textContent = `المتاح: ${formatDZD(available)}`;
  return true;
}

function openExpenseModal(rowIndex = null, preselectedEnvelope = null) {
  populateEnvelopeSelects();
  const modal = document.getElementById('expenseModal');
  const title = document.getElementById('expenseModalTitle');

  if (rowIndex) {
    const exp = state.data.expenses.find(e => Number(e.rowIndex) === Number(rowIndex));
    if (!exp) return;
    title.textContent = `تعديل المصروف (صف #${exp.rowIndex})`;
    document.getElementById('expRowIndex').value = exp.rowIndex;
    document.getElementById('expAmount').value = exp.amount;
    document.getElementById('expPaymentMethod').value = exp.paymentMethod || 'كاش';
    document.getElementById('expEnvelope').value = exp.envelope;
    document.getElementById('expDate').value = exp.date;
    document.getElementById('expStatement').value = exp.statement || '';
    document.getElementById('expNote').value = exp.note || '';
  } else {
    title.textContent = 'تسجيل مصروف يومي جديد';
    document.getElementById('expRowIndex').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expStatement').value = '';
    document.getElementById('expNote').value = '';
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];

    const targetEnv = preselectedEnvelope || (state.data.envelopes && state.data.envelopes[0] ? state.data.envelopes[0].name : '');
    if (targetEnv) {
      document.getElementById('expEnvelope').value = targetEnv;
      onExpenseEnvelopeChange(targetEnv);
    } else {
      document.getElementById('expPaymentMethod').value = 'كاش';
    }
  }

  validateExpenseModalLive();
  modal.classList.remove('hidden');
}

function onExpenseEnvelopeChange(envName) {
  if (!envName) return;
  const foundEnv = state.data && state.data.envelopes ? state.data.envelopes.find(e => e.name === envName) : null;
  const accType = (foundEnv && foundEnv.accountType) || ENVELOPE_ACCOUNT_MAP[envName] || 'كاش';
  const select = document.getElementById('expPaymentMethod');
  if (!select) return;

  if (accType === 'كاش') {
    select.value = 'كاش';
  } else if (accType.includes('USDT') || accType.includes('$')) {
    select.value = 'حساب USDT';
  } else if (accType.includes('أورو') || accType.includes('يورو') || accType.includes('€')) {
    select.value = 'حساب أورو';
  } else {
    select.value = 'بريدي موب';
  }
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.add('hidden');
}

async function handleSaveExpense(event) {
  event.preventDefault();
  const rowIndexInput = document.getElementById('expRowIndex').value;
  const isUpdate = Boolean(rowIndexInput);
  const envelope = document.getElementById('expEnvelope').value;
  const amount = Number(document.getElementById('expAmount').value) || 0;

  const available = getAvailableBalanceForExpense(envelope, rowIndexInput);
  if (amount <= 0) {
    showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', true);
    return;
  }
  if (available <= 0 || amount > available) {
    validateExpenseModalLive();
    const errMsg = `❌ عملية مرفوضة: المبلغ المطلوب (${formatDZD(amount)}) أكبر من الرصيد الموجود في ظرف "${envelope}" (${formatDZD(available)}). لا يُسمح بظهور الظرف بقيمة سالبة!`;
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }

  const maxRow = state.data.expenses.reduce((m, e) => Math.max(m, Number(e.rowIndex) || 1), 1);
  const expenseObj = {
    rowIndex: isUpdate ? Number(rowIndexInput) : maxRow + 1,
    date: document.getElementById('expDate').value,
    envelope,
    statement: document.getElementById('expStatement').value.trim(),
    amount,
    paymentMethod: document.getElementById('expPaymentMethod').value,
    note: document.getElementById('expNote').value.trim()
  };

  // محاكاة العملية أولاً للتأكد بنسبة 100% من عدم تحول الظرف المستهدف إلى قيمة سالبة
  const simData = JSON.parse(JSON.stringify(state.data));
  if (isUpdate) {
    const idx = simData.expenses.findIndex(e => Number(e.rowIndex) === Number(rowIndexInput));
    if (idx !== -1) simData.expenses[idx] = expenseObj;
  } else {
    simData.expenses.push(expenseObj);
  }
  recalculateSheetFormulasLocally(simData);
  const negEnv = simData.envelopes.find(e => e.name === envelope && Number(e.netBalance) < 0);
  if (negEnv) {
    const errMsg = `❌ عملية مرفوضة: هذه العملية ستجعل رصيد ظرف "${negEnv.name}" سالباً (${formatDZD(negEnv.netBalance)}) وهو غير مسموح!`;
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }

  // تحديث فوري محلي لأرصدة الحسابات (كاش / CCP) قبل اكتمال المزامنة
  const adjustAccountForExpense = (expItem, direction) => {
    if (!expItem || !state.data.accounts) return;
    const amt = (Number(expItem.amount) || 0) * direction;
    const pm = String(expItem.paymentMethod || 'كاش');
    const key = pm === 'كاش' ? 'cash' : (pm.includes('أورو') ? 'euro' : (pm.includes('USDT') ? 'usdt' : 'ccp'));
    if (state.data.accounts[key]) {
      state.data.accounts[key].totalOut = Math.max(0, (Number(state.data.accounts[key].totalOut) || 0) + amt);
      state.data.accounts[key].balance = (Number(state.data.accounts[key].balance) || 0) - amt;
    }
  };

  if (isUpdate) {
    const idx = state.data.expenses.findIndex(e => Number(e.rowIndex) === Number(rowIndexInput));
    if (idx !== -1) {
      adjustAccountForExpense(state.data.expenses[idx], -1);
      state.data.expenses[idx] = expenseObj;
      adjustAccountForExpense(expenseObj, 1);
    }
  } else {
    state.data.expenses.push(expenseObj);
    adjustAccountForExpense(expenseObj, 1);
  }

  saveToLocal();
  populateMonthSelector();
  closeExpenseModal();
  renderAll();
  showToast(isUpdate ? 'تم تعديل المصروف بنجاح' : 'تمت إضافة المصروف في سجل المصاريف اليومية');

  if (state.scriptUrl) {
    await postToGoogleSheet({
      action: isUpdate ? 'editExpense' : 'addExpense',
      expense: expenseObj
    });
  }
}

async function handleDeleteExpense(rowIndex) {
  if (!confirm('هل أنت متأكد من حذف هذا المصروف من سجل المصاريف اليومية؟')) return;
  state.data.expenses = state.data.expenses.filter(e => Number(e.rowIndex) !== Number(rowIndex));
  saveToLocal();
  renderAll();
  showToast('تم حذف المصروف');

  if (state.scriptUrl) {
    await postToGoogleSheet({ action: 'deleteExpense', rowIndex });
  }
}

// ==================== عرض وإدارة "استلاف الأظرفة" ====================
function renderLoansList() {
  const container = document.getElementById('loansListContainer');
  const filter = state.loanTypeFilter || 'ALL';
  const allLoans = state.data && state.data.loans ? state.data.loans : [];

  const loans = allLoans
    .filter(l => filter === 'ALL' || l.type === filter)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  if (loans.length === 0) {
    const filterLabel = filter === 'سلفة مؤقتة' ? 'استلاف مؤقت' : filter === 'تحويل للادخار' ? 'تصفية دائمة (تحويل للادخار)' : '';
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center border border-slate-200/70">
        <i class="fa-solid fa-right-left text-3xl text-slate-300 mb-2"></i>
        <p class="text-sm text-slate-600 font-bold">لا توجد عمليات مسجلة ${filterLabel ? `ضمن فئة "${filterLabel}"` : ''}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = loans.map(loan => {
    let statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
    if (loan.status === 'تم الإرجاع' || loan.status === 'تم التحويل') {
      statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (loan.status === 'خطأ') {
      statusBadge = 'bg-red-50 text-red-700 border-red-200';
    }

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold border ${statusBadge}">${escapeHtml(loan.status)}</span>
            <span class="text-xs font-bold text-slate-500">${escapeHtml(loan.type)}</span>
            <span class="text-xs text-slate-400" dir="ltr">• ${escapeHtml(loan.date)}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-sm sm:text-base font-extrabold text-slate-800">
            <span class="text-rose-600">${escapeHtml(loan.fromEnvelope)}</span>
            <i class="fa-solid fa-arrow-left text-slate-400 text-xs"></i>
            <span class="text-emerald-600">${escapeHtml(loan.toEnvelope)}</span>
            <span class="text-slate-400 font-normal text-xs">(${escapeHtml(loan.reason || 'بدون سبب')})</span>
          </div>

          <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>المبلغ الأصلي: <b class="text-slate-800">${formatDZD(loan.amount)}</b></span>
            <span>المبلغ المرجع: <b class="text-emerald-600">${formatDZD(loan.repaidAmount)}</b></span>
            <span>المتبقي: <b class="text-rose-600">${formatDZD(loan.remainingAmount)}</b></span>
            ${loan.dueDate ? `<span>تاريخ الاستحقاق: <b dir="ltr">${escapeHtml(loan.dueDate)}</b></span>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${loan.type === 'سلفة مؤقتة' && loan.remainingAmount > 0 ? `
            <button
              onclick="quickRepayLoan(${loan.rowIndex})"
              class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs transition"
            >
              <i class="fa-solid fa-check"></i> تسديد السلفة
            </button>
          ` : ''}
          <button
            onclick="openLoanModal(${loan.rowIndex})"
            class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition"
            title="تعديل"
          >
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button
            onclick="handleDeleteLoan(${loan.rowIndex})"
            class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition"
            title="مسح العملية"
          >
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getAvailableBalanceForLoan(fromEnvName, editingRowIndex = null) {
  const env = state.data.envelopes.find(e => e.name === fromEnvName);
  if (!env) return 0;
  let available = Number(env.netBalance) || 0;

  // في حال تعديل سلفة سابقة من نفس الظرف، نعيد احتساب مبلغها المخصوم مسبقاً ضمن الرصيد المتاح
  if (editingRowIndex) {
    const oldLoan = state.data.loans.find(l => Number(l.rowIndex) === Number(editingRowIndex));
    if (oldLoan && oldLoan.fromEnvelope === fromEnvName) {
      const oldDeducted = oldLoan.type === 'تحويل للادخار'
        ? (Number(oldLoan.amount) || 0)
        : (Number(oldLoan.remainingAmount) || 0);
      available += oldDeducted;
    }
  }
  return available;
}

function validateLoanModalLive() {
  const rowIndexInput = document.getElementById('loanRowIndex')?.value || null;
  const fromEnv = document.getElementById('loanFromEnvelope')?.value || '';
  const toEnv = document.getElementById('loanToEnvelope')?.value || '';
  const amountVal = Number(document.getElementById('loanAmount')?.value) || 0;

  const hintBox = document.getElementById('loanBalanceHintBox');
  const hintText = document.getElementById('loanBalanceHintText');
  const maxBadge = document.getElementById('loanBalanceMaxBadge');

  const available = getAvailableBalanceForLoan(fromEnv, rowIndexInput);
  if (!hintBox || !hintText || !maxBadge) return true;

  if (fromEnv && toEnv && fromEnv === toEnv) {
    hintBox.className = 'rounded-xl p-3 text-xs border bg-red-50 border-red-300 text-red-700 flex items-center justify-between';
    hintText.innerHTML = `<i class="fa-solid fa-ban ml-1"></i> <b>مرفوض:</b> لا يمكن الاستلاف من الظرف لنفسه! اختر ظرفاً مستفيداً مختلفاً.`;
    maxBadge.textContent = '';
    return false;
  }

  if (available <= 0) {
    hintBox.className = 'rounded-xl p-3 text-xs border bg-red-50 border-red-300 text-red-700 flex items-center justify-between';
    hintText.innerHTML = `<i class="fa-solid fa-ban ml-1"></i> <b>مرفوض:</b> ظرف <b>"${escapeHtml(fromEnv)}"</b> رصيده 0 دج ولا يمكن الاستلاف منه!`;
    maxBadge.textContent = `المتاح: ${formatDZD(available)}`;
    return false;
  }

  if (amountVal > available) {
    hintBox.className = 'rounded-xl p-3 text-xs border bg-red-50 border-red-300 text-red-700 flex items-center justify-between';
    hintText.innerHTML = `<i class="fa-solid fa-ban ml-1"></i> <b>عملية مرفوضة:</b> المبلغ المقترض أكبر من الرصيد الموجود في ظرف <b>"${escapeHtml(fromEnv)}"</b> ولا يُسمح برصيد سالب!`;
    maxBadge.textContent = `الحد الأقصى: ${formatDZD(available)}`;
    return false;
  }

  hintBox.className = 'rounded-xl p-3 text-xs border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center justify-between';
  hintText.innerHTML = `<i class="fa-solid fa-circle-check ml-1 text-emerald-600"></i> الرصيد المتاح في <b>"${escapeHtml(fromEnv)}"</b> كافٍ${amountVal > 0 ? ` (المتبقي بعد السلفة: <b>${formatDZD(available - amountVal)}</b>)` : ''}`;
  maxBadge.textContent = `المتاح: ${formatDZD(available)}`;
  return true;
}

function openLoanModal(rowIndex = null) {
  populateEnvelopeSelects();
  const modal = document.getElementById('loanModal');
  const title = document.getElementById('loanModalTitle');

  if (rowIndex) {
    const loan = state.data.loans.find(l => Number(l.rowIndex) === Number(rowIndex));
    if (!loan) return;
    title.textContent = `تعديل عملية الاستلاف (صف #${loan.rowIndex})`;
    document.getElementById('loanRowIndex').value = loan.rowIndex;
    document.getElementById('loanType').value = loan.type || 'سلفة مؤقتة';
    document.getElementById('loanAmount').value = loan.amount;
    document.getElementById('loanFromEnvelope').value = loan.fromEnvelope;
    document.getElementById('loanToEnvelope').value = loan.toEnvelope;
    document.getElementById('loanDate').value = loan.date;
    document.getElementById('loanDueDate').value = loan.dueDate || '';
    document.getElementById('loanReason').value = loan.reason || '';
    document.getElementById('loanRepaidAmount').value = loan.repaidAmount || 0;
    document.getElementById('loanNote').value = loan.note || '';
  } else {
    title.textContent = 'تسجيل سلفة أو تحويل بين الأظرفة';
    document.getElementById('loanRowIndex').value = '';
    document.getElementById('loanType').value = 'سلفة مؤقتة';
    document.getElementById('loanAmount').value = '';
    // اختيار ظرف ثانٍ مختلف تلقائياً للظرف المستفيد
    const fromSelect = document.getElementById('loanFromEnvelope');
    const toSelect = document.getElementById('loanToEnvelope');
    if (fromSelect && toSelect && toSelect.options.length > 1) {
      fromSelect.selectedIndex = 0;
      toSelect.selectedIndex = 1;
    }
    document.getElementById('loanDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('loanDueDate').value = '';
    document.getElementById('loanReason').value = '';
    document.getElementById('loanRepaidAmount').value = 0;
    document.getElementById('loanNote').value = '';
  }

  validateLoanModalLive();
  modal.classList.remove('hidden');
}

function closeLoanModal() {
  document.getElementById('loanModal').classList.add('hidden');
}

async function handleSaveLoan(event) {
  event.preventDefault();
  const rowIndexInput = document.getElementById('loanRowIndex').value;
  const isUpdate = Boolean(rowIndexInput);
  const fromEnvelope = document.getElementById('loanFromEnvelope').value;
  const toEnvelope = document.getElementById('loanToEnvelope').value;
  const amount = Number(document.getElementById('loanAmount').value) || 0;

  const available = getAvailableBalanceForLoan(fromEnvelope, rowIndexInput);

  if (fromEnvelope === toEnvelope) {
    validateLoanModalLive();
    const errMsg = '❌ عملية مرفوضة: لا يمكن الاستلاف من الظرف لنفسه!';
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }
  if (amount <= 0) {
    showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', true);
    return;
  }
  if (available <= 0 || amount > available) {
    validateLoanModalLive();
    const errMsg = `❌ عملية مرفوضة: المبلغ المقترض (${formatDZD(amount)}) أكبر من الرصيد الموجود في ظرف "${fromEnvelope}" (${formatDZD(available)}). لا يُسمح باقتراض مبلغ غير متوفر ولا أن يصبح الظرف بقيمة سالبة!`;
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }

  const maxRow = state.data.loans.reduce((m, l) => Math.max(m, Number(l.rowIndex) || 1), 1);

  const loanObj = {
    rowIndex: isUpdate ? Number(rowIndexInput) : maxRow + 1,
    date: document.getElementById('loanDate').value,
    type: document.getElementById('loanType').value,
    fromEnvelope,
    toEnvelope,
    amount,
    reason: document.getElementById('loanReason').value.trim(),
    dueDate: document.getElementById('loanDueDate').value,
    repaidAmount: Number(document.getElementById('loanRepaidAmount').value) || 0,
    note: document.getElementById('loanNote').value.trim()
  };

  // محاكاة العملية أولاً للتأكد بنسبة 100% من عدم تحول أي ظرف إلى قيمة سالبة
  const simData = JSON.parse(JSON.stringify(state.data));
  if (isUpdate) {
    const idx = simData.loans.findIndex(l => Number(l.rowIndex) === Number(rowIndexInput));
    if (idx !== -1) simData.loans[idx] = loanObj;
  } else {
    simData.loans.push(loanObj);
  }
  recalculateSheetFormulasLocally(simData);
  const negEnv = simData.envelopes.find(e => Number(e.netBalance) < 0);
  if (negEnv) {
    const errMsg = `❌ عملية مرفوضة: هذه العملية ستجعل رصيد ظرف "${negEnv.name}" سالباً (${formatDZD(negEnv.netBalance)}) وهو غير مسموح!`;
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }

  if (isUpdate) {
    const idx = state.data.loans.findIndex(l => Number(l.rowIndex) === Number(rowIndexInput));
    if (idx !== -1) state.data.loans[idx] = loanObj;
  } else {
    state.data.loans.push(loanObj);
  }

  saveToLocal();
  closeLoanModal();
  renderAll();
  showToast('تم حفظ عملية الاستلاف وتحديث أرصدة الأظرفة');

  if (state.scriptUrl) {
    await postToGoogleSheet({
      action: isUpdate ? 'editLoan' : 'addLoan',
      loan: loanObj
    });
  }
}

async function quickRepayLoan(rowIndex) {
  const loan = state.data.loans.find(l => Number(l.rowIndex) === Number(rowIndex));
  if (!loan) return;
  const input = prompt(`أدخل إجمالي المبلغ المرجع لهذه السلفة (المبلغ الأصلي: ${loan.amount} دج):`, loan.amount);
  if (input === null) return;
  const repaidAmount = Number(input);
  if (isNaN(repaidAmount) || repaidAmount < 0) return;

  loan.repaidAmount = repaidAmount;
  saveToLocal();
  renderAll();
  showToast('تم تسجيل تسديد السلفة وتحديث الرصيد المتاح');

  if (state.scriptUrl) {
    await postToGoogleSheet({
      action: 'repayLoan',
      rowIndex: loan.rowIndex,
      repaidAmount
    });
  }
}

async function handleDeleteLoan(rowIndex) {
  if (!confirm('هل تريد مسح عملية الاستلاف هذه؟ (سيتم مسح خلايا الإدخال فقط مع الحفاظ على معادلات الصف في الشيت)')) return;
  state.data.loans = state.data.loans.filter(l => Number(l.rowIndex) !== Number(rowIndex));
  saveToLocal();
  renderAll();
  showToast('تم مسح العملية');

  if (state.scriptUrl) {
    await postToGoogleSheet({ action: 'deleteLoan', rowIndex });
  }
}

// ==================== نافذة سجل وقائمة التحويلات المالية بين الحسابات ====================
function openTransfersListModal() {
  renderTransfersList();
  const modal = document.getElementById('transfersListModal');
  if (modal) modal.classList.remove('hidden');
}

function closeTransfersListModal() {
  const modal = document.getElementById('transfersListModal');
  if (modal) modal.classList.add('hidden');
}

function renderTransfersList() {
  const container = document.getElementById('transfersListContainer');
  const countEl = document.getElementById('transfersListCount');
  if (!container) return;

  const transfers = state.data && state.data.transfers ? [...state.data.transfers] : [];
  if (countEl) countEl.textContent = `${transfers.length} عملية تحويل مسجلة`;

  if (transfers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 space-y-2">
        <i class="fa-solid fa-arrow-right-arrow-left text-3xl text-slate-300"></i>
        <p class="text-xs font-bold">لا توجد تحويلات مالية مسجلة بعد</p>
        <p class="text-[11px]">يمكنك تسجيل تحويل بين الحسابات الأربعة في أي وقت.</p>
      </div>
    `;
    return;
  }

  // فرز تنازلي حسب التاريخ
  transfers.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const fmt = (val, cur) => {
    if (cur === '€') return `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    if (cur === '$') return `${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    return `${Number(val || 0).toLocaleString('fr-FR')} دج`;
  };

  container.innerHTML = transfers.map(t => {
    const fromAcc = t.fromAccount || 'حساب CCP';
    const toAcc = t.toAccount || 'كاش';
    const amount = Number(t.amount) || 0;
    const fee = Number(t.fee) || 0;
    const net = Number(t.netReceived) || (amount - fee);
    const fromCur = t.fromCurrency || 'دج';
    const toCur = t.toCurrency || 'دج';
    const rate = Number(t.exchangeRate) || 1;
    const note = t.note || '';

    return `
      <div class="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition space-y-2">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 font-bold text-slate-800">
            <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px]">${escapeHtml(fromAcc)}</span>
            <i class="fa-solid fa-arrow-left text-slate-400 text-[10px]"></i>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">${escapeHtml(toAcc)}</span>
          </div>
          <span class="text-slate-400 font-mono text-[11px]" dir="ltr">${escapeHtml(t.date || '')}</span>
        </div>

        <div class="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-slate-100 text-center text-xs">
          <div>
            <span class="text-slate-400 block text-[10px]">المبلغ المحول</span>
            <b class="text-slate-800 font-extrabold">${fmt(amount, fromCur)}</b>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">الرسوم</span>
            <b class="text-rose-600 font-bold">${fee > 0 ? fmt(fee, fromCur) : '0 دج'}</b>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">الصافي المستلم</span>
            <b class="text-emerald-700 font-extrabold">${fmt(net, toCur)}</b>
          </div>
        </div>

        ${(note || (rate && rate !== 1)) ? `
          <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-100/60">
            <span class="truncate">${note ? `📝 ${escapeHtml(note)}` : ''}</span>
            ${(rate && rate !== 1) ? `<span class="bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold">صرف: 1 = ${rate}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ==================== نافذة التحويلات المالية بين الحسابات ====================
function openTransferModal() {
  const modal = document.getElementById('transferModal');
  if (!modal) return;
  const fromSel = document.getElementById('trFromAccount');
  const toSel = document.getElementById('trToAccount');
  const amtInput = document.getElementById('trAmount');
  const feeInput = document.getElementById('trFee');
  const rateInput = document.getElementById('trRate');
  const dateInput = document.getElementById('trDate');
  const noteInput = document.getElementById('trNote');

  if (fromSel) fromSel.value = 'حساب CCP';
  if (toSel) toSel.value = 'كاش';
  if (amtInput) amtInput.value = '';
  if (feeInput) feeInput.value = '0';
  if (rateInput) rateInput.value = '1';
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (noteInput) noteInput.value = '';

  modal.classList.remove('hidden');
}

function closeTransferModal() {
  const modal = document.getElementById('transferModal');
  if (modal) modal.classList.add('hidden');
}

async function handleSaveTransfer(event) {
  event.preventDefault();
  const fromAcc = document.getElementById('trFromAccount').value;
  const toAcc = document.getElementById('trToAccount').value;
  const amount = Number(document.getElementById('trAmount').value) || 0;
  const fee = Number(document.getElementById('trFee').value) || 0;
  const rate = Number(document.getElementById('trRate').value) || 1;
  const date = document.getElementById('trDate').value || new Date().toISOString().split('T')[0];
  const note = document.getElementById('trNote').value.trim();

  if (amount <= 0) {
    showToast('يرجى إدخال مبلغ تحويل صحيح أكبر من الصفر', true);
    return;
  }
  if (fromAcc === toAcc) {
    showToast('لا يمكن التحويل إلى نفس الحساب، يرجى اختيار حسابين مختلفين', true);
    return;
  }

  const getCurrency = (acc) => {
    if (acc.includes('USDT') || acc.includes('$')) return '$';
    if (acc.includes('أورو') || acc.includes('يورو') || acc.includes('€')) return '€';
    return 'دج';
  };

  const transfer = {
    date,
    fromAccount: fromAcc,
    fromCurrency: getCurrency(fromAcc),
    toAccount: toAcc,
    toCurrency: getCurrency(toAcc),
    amount,
    fee,
    exchangeRate: rate,
    netReceived: amount * rate,
    note
  };

  if (!state.data.transfers) state.data.transfers = [];
  state.data.transfers.unshift({
    rowIndex: state.data.transfers.length + 4,
    ...transfer
  });

  // تحديث فوري محلي لأرصدة الحسابات
  if (state.data.accounts) {
    const accKey = (name) => {
      if (name.includes('CCP') || name.includes('بريدي')) return 'ccp';
      if (name.includes('كاش')) return 'cash';
      if (name.includes('أورو') || name.includes('يورو') || name.includes('€')) return 'euro';
      if (name.includes('USDT') || name.includes('$')) return 'usdt';
      return null;
    };
    const fKey = accKey(fromAcc);
    const tKey = accKey(toAcc);
    if (fKey && state.data.accounts[fKey]) {
      state.data.accounts[fKey].totalOut = (Number(state.data.accounts[fKey].totalOut) || 0) + amount + fee;
      state.data.accounts[fKey].balance = (Number(state.data.accounts[fKey].balance) || 0) - (amount + fee);
    }
    if (tKey && state.data.accounts[tKey]) {
      const net = amount * rate;
      state.data.accounts[tKey].totalIn = (Number(state.data.accounts[tKey].totalIn) || 0) + net;
      state.data.accounts[tKey].balance = (Number(state.data.accounts[tKey].balance) || 0) + net;
    }
  }

  saveToLocal();
  closeTransferModal();
  renderAll();
  renderTransfersList();
  showToast('تم تسجيل التحويل المالي وتحديث الأرصدة بنجاح');

  if (state.scriptUrl) {
    await postToGoogleSheet({
      action: 'addTransfer',
      transfer
    });
  }
}

// ==================== عرض وإدارة "تغذية الأظرفة" + "الأظرفة الموحدة" ====================
function setFeedingRefCategoryFilter(cat) {
  state.feedingRefCategoryFilter = cat;
  ['ALL', 'أساسيات', 'كماليات', 'استثمار وادخار', 'احتياطي وتدوير'].forEach(c => {
    const btn = document.getElementById(`feedRefCat-${c}`);
    if (!btn) return;
    if (c === cat) {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-white transition';
    } else if (c === 'أساسيات') {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition';
    } else if (c === 'كماليات') {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition';
    } else if (c === 'استثمار وادخار') {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition';
    } else if (c === 'احتياطي وتدوير') {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 hover:bg-purple-100 transition';
    } else {
      btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
    }
  });
  renderFeedingView();
}

function getMajorCategoryBadgeHtml(cat) {
  if (cat === 'أساسيات') {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">🟢 أساسيات</span>`;
  }
  if (cat === 'كماليات') {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">🟠 كماليات</span>`;
  }
  if (cat === 'استثمار وادخار' || cat === 'إدخار') {
    return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800">🔵 استثمار وادخار</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800">🟣 احتياطي وتدوير</span>`;
}

function renderFeedingView() {
  const ov = state.data.overview;
  if (ov) {
    document.getElementById('ovMonthlySalary').textContent = formatDZD(ov.monthlySalary || 104200);
    document.getElementById('ovBonusMonthly').textContent = formatDZD(ov.quarterlyBonusMonthlyAvg || 17450);
    document.getElementById('ovWeightedAvg').textContent = formatDZD(ov.weightedMonthlyAvg || 121650);

    // احتساب دقيق لتوزيع السيولة بين (كاش) و (حساب جاري) مباشرة من الأظرفة المعتمدة
    let cashVal = 0;
    let currentAccVal = 0;
    if (state.data.envelopes && state.data.envelopes.length) {
      state.data.envelopes.forEach(e => {
        const acc = e.accountType || ENVELOPE_ACCOUNT_MAP[e.name] || 'كاش';
        const alloc = Number(e.totalMonthlyAllocated) || 0;
        if (acc.includes('كاش')) {
          cashVal += alloc;
        } else {
          currentAccVal += alloc;
        }
      });
    }
    if (!cashVal) cashVal = Number(ov.cashTotal) || 69150;
    if (!currentAccVal) currentAccVal = Number(ov.currentAccountTotal) || 52500;

    const cashSplitEl = document.getElementById('ovCashSplit');
    if (cashSplitEl) {
      cashSplitEl.textContent = `كاش: ${formatDZD(cashVal)} | جاري: ${formatDZD(currentAccVal)}`;
    }

    const wAvg = Number(ov.weightedMonthlyAvg) || 121650;
    const essTotal = Number(ov.essentialsTotal) || 72150;
    const luxTotal = Number(ov.luxuriesTotal) || 25000;
    const savTotal = Number(ov.savingsTotal) || 24500;
    const contTotal = Number(ov.contingencyTotal) || 0;

    const essEl = document.getElementById('ovEssentialsTotal');
    const luxEl = document.getElementById('ovLuxuriesTotal');
    const savEl = document.getElementById('ovSavingsTotal');
    const contEl = document.getElementById('ovContingencyTotal');
    if (essEl) essEl.textContent = formatDZD(essTotal);
    if (luxEl) luxEl.textContent = formatDZD(luxTotal);
    if (savEl) savEl.textContent = formatDZD(savTotal);
    if (contEl) contEl.textContent = formatDZD(contTotal);

    const essPctEl = document.getElementById('ovEssentialsPct');
    const luxPctEl = document.getElementById('ovLuxuriesPct');
    const savPctEl = document.getElementById('ovSavingsPct');
    const contPctEl = document.getElementById('ovContingencyPct');
    if (essPctEl) essPctEl.textContent = `${((essTotal / wAvg) * 100).toFixed(2)}% من الدخل الموزون`;
    if (luxPctEl) luxPctEl.textContent = `${((luxTotal / wAvg) * 100).toFixed(2)}% من الدخل الموزون`;
    if (savPctEl) savPctEl.textContent = `${((savTotal / wAvg) * 100).toFixed(2)}% من الدخل الموزون`;
    if (contPctEl) contPctEl.textContent = `${((contTotal / wAvg) * 100).toFixed(2)}% من الدخل الموزون`;
  }

  // تعبئة جدول المخصص الشهري الإجمالي للأظرفة الموحدة مقسماً حسب الفئات الأربعة
  const refTableBody = document.getElementById('sheet1ReferenceTableBody');
  if (refTableBody) {
    const allCategories = ['أساسيات', 'كماليات', 'استثمار وادخار', 'احتياطي وتدوير'];
    const categoriesToShow = state.feedingRefCategoryFilter === 'ALL'
      ? allCategories
      : [state.feedingRefCategoryFilter];

    refTableBody.innerHTML = categoriesToShow.map(majorCat => {
      const catEnvs = state.data.envelopes.filter(e => {
        const cat = e.majorCategory || MAJOR_CATEGORY_MAP[e.name] || 'أساسيات';
        if (majorCat === 'استثمار وادخار') return cat === 'استثمار وادخار' || cat === 'إدخار';
        return cat === majorCat;
      });
      if (catEnvs.length === 0) return '';

      const catSalarySum = catEnvs.reduce((s, e) => s + (Number(e.salaryRef) || 0), 0);
      const catBonusMonthlySum = catEnvs.reduce((s, e) => s + (Number(e.bonusMonthlyRef) || 0), 0);
      const catTotalMonthlySum = catEnvs.reduce((s, e) => s + (Number(e.totalMonthlyAllocated) || 0), 0);
      const catBonusQuarterlySum = catEnvs.reduce((s, e) => s + (Number(e.bonusRef) || 0), 0);

      const headerBg = majorCat === 'أساسيات'
        ? 'bg-emerald-50/90 text-emerald-900 border-y border-emerald-200'
        : majorCat === 'كماليات'
        ? 'bg-amber-50/90 text-amber-900 border-y border-amber-200'
        : majorCat === 'استثمار وادخار'
        ? 'bg-indigo-50/90 text-indigo-900 border-y border-indigo-200'
        : 'bg-purple-50/90 text-purple-900 border-y border-purple-200';

      const rowsHtml = catEnvs.map(env => {
        const hasBonus = (Number(env.bonusMonthlyRef) || 0) > 0;
        const mCat = env.majorCategory || MAJOR_CATEGORY_MAP[env.name] || 'أساسيات';
        const acc = env.accountType || ENVELOPE_ACCOUNT_MAP[env.name] || 'كاش';
        const accBadge = acc.includes('كاش')
          ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">💵 كاش</span>'
          : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">🏦 حساب جاري</span>';

        const envTypeBadge = (Number(env.accumulationMonths) > 0 || env.group === 'الإدخار والتراكم')
          ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">🎯 إدخار وتراكم</span>'
          : '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">🔄 صرف دوري</span>';

        const durationText = Number(env.accumulationMonths) > 0 ? `${env.accumulationMonths} أشهر` : '—';

        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2.5 font-bold text-slate-800">${escapeHtml(env.name)}</td>
            <td class="p-2.5">${getMajorCategoryBadgeHtml(mCat)}</td>
            <td class="p-2.5">${envTypeBadge}</td>
            <td class="p-2.5">${accBadge}</td>
            <td class="p-2.5 font-semibold text-slate-700">${formatDZD(env.salaryRef)}</td>
            <td class="p-2.5 font-semibold ${hasBonus ? 'text-purple-700' : 'text-slate-400'}">${hasBonus ? formatDZD(env.bonusMonthlyRef) : '—'}</td>
            <td class="p-2.5 font-extrabold bg-emerald-50/40 text-emerald-700">${formatDZD(env.totalMonthlyAllocated)}</td>
            <td class="p-2.5 font-bold bg-purple-50/40 ${hasBonus ? 'text-purple-700' : 'text-slate-400'}">
              ${hasBonus ? `${formatDZD(env.bonusRef)} <span class="text-[10px] font-normal">(${env.bonusMonthlyRef}×3)</span>` : '—'}
            </td>
            <td class="p-2.5 font-medium text-slate-600">${durationText}</td>
          </tr>
        `;
      }).join('');

      return `
        <tr class="${headerBg} font-extrabold text-xs">
          <td colspan="4" class="p-2.5">📂 تصنيف: ${escapeHtml(majorCat)} (${catEnvs.length} أظرفة)</td>
          <td class="p-2.5">${formatDZD(catSalarySum)}</td>
          <td class="p-2.5">${catBonusMonthlySum > 0 ? formatDZD(catBonusMonthlySum) : '—'}</td>
          <td class="p-2.5">${formatDZD(catTotalMonthlySum)}</td>
          <td class="p-2.5">${catBonusQuarterlySum > 0 ? formatDZD(catBonusQuarterlySum) : '—'}</td>
          <td class="p-2.5">—</td>
        </tr>
        ${rowsHtml}
      `;
    }).join('');
  }

  const container = document.getElementById('feedingCyclesContainer');
  container.innerHTML = state.data.feedingCycles.map(cycle => {
    const isFed = Number(cycle.receivedAmount) > 0 || Number(cycle.distributedTotal) > 0;
    const isBonus = cycle.incomeType === 'مردودية';
    const isSalary = cycle.incomeType === 'راتب شهري' || cycle.incomeType === 'راتب';

    let badgeClass = 'bg-slate-100 text-slate-600';
    if (cycle.status.includes('✅')) badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    else if (cycle.status.includes('⚠️')) badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
    else if (cycle.status.includes('❌')) badgeClass = 'bg-red-50 text-red-700 border border-red-200';

    const typeBadgeClass = isBonus
      ? 'bg-purple-100 text-purple-700'
      : isSalary
      ? 'bg-blue-100 text-blue-700'
      : 'bg-amber-100 text-amber-800';

    return `
      <div class="p-4 rounded-2xl border ${isFed ? 'bg-white border-emerald-200 shadow-xs' : 'bg-slate-50/70 border-slate-200/70'} flex items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-extrabold text-slate-800 text-base">${escapeHtml(cycle.monthName)} ${cycle.year}</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded-md ${typeBadgeClass}">
              ${escapeHtml(cycle.incomeType)}
            </span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${badgeClass}">${escapeHtml(cycle.status)}</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>المستلم: <b class="text-slate-800">${cycle.receivedAmount === '' ? '—' : formatDZD(cycle.receivedAmount)}</b></span>
            <span>الموزع: <b class="text-emerald-700">${formatDZD(cycle.distributedTotal)}</b></span>
            <span>المتبقي: <b class="${cycle.remainingBalance === 0 ? 'text-slate-600' : 'text-rose-600'}">${formatDZD(cycle.remainingBalance)}</b></span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function findMatchingFeedingCycle(monthName, year, incomeCat, customName = '') {
  return state.data.feedingCycles.find(c => {
    if (c.monthName !== monthName || Number(c.year) !== Number(year)) return false;
    if (incomeCat === 'راتب') {
      return c.incomeType === 'راتب شهري' || c.incomeType === 'راتب';
    }
    if (incomeCat === 'مردودية') {
      return c.incomeType === 'مردودية';
    }
    const cleanCustom = String(customName || '').trim();
    if (!cleanCustom) return false;
    return c.incomeType === cleanCustom;
  });
}

function openFeedingModal() {
  const monthSel = document.getElementById('feedMonthSelect');
  const yearSel = document.getElementById('feedYearSelect');
  const catSel = document.getElementById('feedIncomeCategory');
  const customInp = document.getElementById('feedCustomIncomeName');

  // ضبط الشهر والسنة الافتراضية بناءً على الشهر المحدد حالياً إن وجد
  if (state.selectedPeriod && state.selectedPeriod !== 'ALL') {
    const [y, m] = state.selectedPeriod.split('-');
    const foundMonthName = Object.keys(MONTH_NAME_TO_NUM).find(k => MONTH_NAME_TO_NUM[k] === m);
    if (foundMonthName && monthSel) monthSel.value = foundMonthName;
    if (y && yearSel) yearSel.value = y;
  } else {
    if (monthSel) monthSel.value = 'نوفمبر';
    if (yearSel) yearSel.value = '2026';
  }

  if (catSel) catSel.value = 'راتب';
  if (customInp) customInp.value = '';

  onFeedingHeaderChange();
  document.getElementById('feedingModal').classList.remove('hidden');
}

function onCustomIncomeNameInput() {
  const monthName = document.getElementById('feedMonthSelect').value;
  const year = Number(document.getElementById('feedYearSelect').value) || 2026;
  const customName = document.getElementById('feedCustomIncomeName').value.trim();
  const matched = findMatchingFeedingCycle(monthName, year, 'مدخول آخر', customName);
  state.editingCycleRowIndex = matched ? Number(matched.rowIndex) : null;
  if (matched) {
    document.getElementById('feedReceivedInput').value = matched.receivedAmount === '' ? '' : matched.receivedAmount;
    document.querySelectorAll('.feed-env-input').forEach(inp => {
      const envName = inp.getAttribute('data-env-name');
      const v = matched.allocations && matched.allocations[envName] !== undefined ? matched.allocations[envName] : '';
      inp.value = v === '' ? '' : v;
    });
    recalcFeedingModalLive();
  }
}

function onFeedingHeaderChange() {
  const monthName = document.getElementById('feedMonthSelect').value;
  const year = Number(document.getElementById('feedYearSelect').value) || 2026;
  const incomeCat = document.getElementById('feedIncomeCategory').value; // 'راتب' | 'مردودية' | 'مدخول آخر'
  const customWrap = document.getElementById('feedCustomIncomeWrap');
  const customInp = document.getElementById('feedCustomIncomeName');
  const autoFillBtn = document.getElementById('btnAutoFillFeeding');
  const autoFillText = document.getElementById('btnAutoFillFeedingText');

  // إظهار أو إخفاء حقل اسم المدخول الآخر وزر التعبئة التلقائية
  if (incomeCat === 'مدخول آخر') {
    customWrap.classList.remove('hidden');
    autoFillBtn.classList.add('hidden');
  } else {
    customWrap.classList.add('hidden');
    autoFillBtn.classList.remove('hidden');
    autoFillText.textContent = incomeCat === 'مردودية'
      ? 'تعبئة تلقائية بالمبلغ المرصود من المردودية'
      : 'تعبئة تلقائية بالمبلغ المرصود من الراتب';
  }

  const customName = customInp ? customInp.value.trim() : '';
  const cycle = findMatchingFeedingCycle(monthName, year, incomeCat, customName);
  state.editingCycleRowIndex = cycle ? Number(cycle.rowIndex) : null;

  document.getElementById('feedReceivedInput').value = cycle && cycle.receivedAmount !== '' ? cycle.receivedAmount : '';

  const listEl = document.getElementById('feedingModalEnvelopesList');
  listEl.innerHTML = ['أساسيات', 'كماليات', 'إدخار'].map(majorCat => {
    const envs = state.data.envelopes.filter(e => (e.majorCategory || MAJOR_CATEGORY_MAP[e.name]) === majorCat);
    const catHeaderStyle = majorCat === 'أساسيات'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
      : majorCat === 'كماليات'
      ? 'text-amber-800 bg-amber-50 border-amber-200'
      : 'text-indigo-800 bg-indigo-50 border-indigo-200';
    const catIcon = majorCat === 'أساسيات' ? '🟢' : majorCat === 'كماليات' ? '🟠' : '🔵';

    return `
      <div class="space-y-2.5">
        <h4 class="text-xs font-extrabold px-3 py-1.5 rounded-xl border flex items-center justify-between ${catHeaderStyle}">
          <span>${catIcon} التصنيف الكبير: ${majorCat} (${envs.length} أظرفة)</span>
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          ${envs.map(env => {
            const val = cycle && cycle.allocations && cycle.allocations[env.name] !== undefined
              ? cycle.allocations[env.name]
              : '';

            // تحديد ما يظهر بجانب الظرف حسب نوع المدخول المختار:
            // 1. راتب -> المبلغ المرصود من الراتب
            // 2. مردودية -> المبلغ المرصود من المردودية
            // 3. مدخول آخر -> بدون ظهور أي مبلغ مرصود
            let refHtml = '';
            if (incomeCat === 'راتب') {
              refHtml = `<div class="text-[11px] font-bold text-blue-600 mt-0.5">المبلغ المرصود من الراتب: ${formatDZD(env.salaryRef)}</div>`;
            } else if (incomeCat === 'مردودية') {
              refHtml = `<div class="text-[11px] font-bold text-purple-600 mt-0.5">المبلغ المرصود من المردودية: ${formatDZD(env.bonusRef)}</div>`;
            }

            return `
              <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(env.name)}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 shrink-0">${escapeHtml(env.group)}</span>
                  </div>
                  ${refHtml}
                </div>
                <input
                  type="number"
                  data-env-name="${escapeHtml(env.name)}"
                  oninput="recalcFeedingModalLive()"
                  value="${val === '' ? '' : val}"
                  placeholder="0"
                  class="feed-env-input w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500 text-left"
                />
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  recalcFeedingModalLive();
}

function closeFeedingModal() {
  document.getElementById('feedingModal').classList.add('hidden');
}

function fillFeedingFromReference() {
  const incomeCat = document.getElementById('feedIncomeCategory').value;
  if (incomeCat === 'مدخول آخر') return;
  const isBonus = incomeCat === 'مردودية';

  // تعبئة المبلغ المستلم المرجعي
  const defaultReceived = isBonus
    ? (state.data.overview.quarterlyBonusMonthlyAvg * 3)
    : state.data.overview.monthlySalary;
  document.getElementById('feedReceivedInput').value = defaultReceived;

  // تعبئة حقول الأظرفة الـ 23 من المبلغ المرصود (الراتب أو المردودية)
  document.querySelectorAll('.feed-env-input').forEach(inp => {
    const envName = inp.getAttribute('data-env-name');
    const env = state.data.envelopes.find(e => e.name === envName);
    if (env) {
      inp.value = isBonus ? env.bonusRef : env.salaryRef;
    }
  });

  recalcFeedingModalLive();
  showToast('تمت التعبئة التلقائية بالمبالغ المرصودة، يمكنك الآن تعديل أي ظرف قبل الحفظ');
}

function clearFeedingModalInputs() {
  document.getElementById('feedReceivedInput').value = '';
  document.querySelectorAll('.feed-env-input').forEach(inp => {
    inp.value = '';
  });
  recalcFeedingModalLive();
}

function recalcFeedingModalLive() {
  const recStr = document.getElementById('feedReceivedInput').value;
  const hasRec = recStr !== '' && recStr !== null;
  const D = Number(recStr) || 0;

  let E = 0;
  let countAlloc = 0;
  document.querySelectorAll('.feed-env-input').forEach(inp => {
    if (inp.value !== '') {
      countAlloc++;
      E += Number(inp.value) || 0;
    }
  });

  const F = (!hasRec && countAlloc === 0) ? 0 : (D - E);
  let status = '⚪ غير مسجل';
  if (!hasRec && countAlloc === 0) status = '⚪ غير مسجل';
  else if (!hasRec) status = '⚠️ بدون دخل مسجل';
  else if (F === 0) status = '✅ متوازنة 100%';
  else if (F > 0) status = '⚠️ يوجد فائض';
  else status = '❌ عجز مالي';

  document.getElementById('feedLiveDistributed').textContent = formatDZD(E);
  const remEl = document.getElementById('feedLiveRemaining');
  remEl.textContent = formatDZD(F);
  remEl.className = `font-extrabold text-sm ${F === 0 ? 'text-emerald-600' : 'text-rose-600'}`;
  document.getElementById('feedLiveStatus').textContent = status;
}

async function handleSaveFeedingCycle() {
  const monthName = document.getElementById('feedMonthSelect').value;
  const year = Number(document.getElementById('feedYearSelect').value) || 2026;
  const incomeCat = document.getElementById('feedIncomeCategory').value;
  const customName = document.getElementById('feedCustomIncomeName').value.trim();

  if (incomeCat === 'مدخول آخر' && !customName) {
    const errMsg = 'يرجى كتابة اسم المدخول الآخر في الحقل المخصص';
    showToast(errMsg, true);
    alert(errMsg);
    document.getElementById('feedCustomIncomeName').focus();
    return;
  }

  const finalIncomeType = incomeCat === 'راتب'
    ? 'راتب شهري'
    : incomeCat === 'مردودية'
    ? 'مردودية'
    : customName;

  const recStr = document.getElementById('feedReceivedInput').value;
  const receivedAmount = recStr === '' ? '' : Number(recStr);

  const newAllocations = {};
  document.querySelectorAll('.feed-env-input').forEach(inp => {
    const envName = inp.getAttribute('data-env-name');
    newAllocations[envName] = inp.value === '' ? '' : Number(inp.value);
  });

  let cycle = findMatchingFeedingCycle(monthName, year, incomeCat, customName);
  const maxRow = state.data.feedingCycles.reduce((m, c) => Math.max(m, Number(c.rowIndex) || 11), 11);

  const updatedCycleObj = cycle
    ? { ...cycle, monthName, year, incomeType: finalIncomeType, receivedAmount, allocations: newAllocations }
    : {
        rowIndex: maxRow + 1,
        monthName,
        year,
        incomeType: finalIncomeType,
        receivedAmount,
        distributedTotal: 0,
        remainingBalance: 0,
        status: '⚪ غير مسجل',
        allocations: newAllocations
      };

  // محاكاة للتأكد من عدم تحول أي ظرف إلى رصيد سالب
  const simData = JSON.parse(JSON.stringify(state.data));
  const simIdx = simData.feedingCycles.findIndex(c => Number(c.rowIndex) === Number(updatedCycleObj.rowIndex));
  if (simIdx !== -1) simData.feedingCycles[simIdx] = updatedCycleObj;
  else simData.feedingCycles.push(updatedCycleObj);
  recalculateSheetFormulasLocally(simData);
  const negEnv = simData.envelopes.find(e => Number(e.netBalance) < 0);
  if (negEnv) {
    const errMsg = `❌ عملية مرفوضة: هذا التعديل سيجعل رصيد ظرف "${negEnv.name}" سالباً (${formatDZD(negEnv.netBalance)}) بسبب وجود مصاريف أو سلف مسحوبة منه!`;
    showToast(errMsg, true);
    alert(errMsg);
    return;
  }

  if (cycle) {
    const idx = state.data.feedingCycles.findIndex(c => Number(c.rowIndex) === Number(cycle.rowIndex));
    if (idx !== -1) state.data.feedingCycles[idx] = updatedCycleObj;
  } else {
    state.data.feedingCycles.push(updatedCycleObj);
  }

  saveToLocal();
  populateMonthSelector();
  closeFeedingModal();
  renderAll();
  showToast(`تم حفظ تغذية الأظرفة: ${monthName} ${year} (${finalIncomeType})`);

  if (state.scriptUrl) {
    await postToGoogleSheet({
      action: 'saveFeedingCycle',
      cycle: {
        rowIndex: updatedCycleObj.rowIndex,
        monthName: updatedCycleObj.monthName,
        year: updatedCycleObj.year,
        incomeType: updatedCycleObj.incomeType,
        receivedAmount: updatedCycleObj.receivedAmount,
        allocations: updatedCycleObj.allocations
      }
    });
  }
}

// ==================== تصفية أظرفة الصرف الدوري وتحويلها إلى الإدخار ====================

function updateSweepCardSummary() {
  const sweepSummaryEl = document.getElementById('sweepAvailableSummary');
  if (sweepSummaryEl && state.data && state.data.envelopes) {
    const totalAvail = state.data.envelopes
      .filter(e => e.group === 'الصرف الدوري')
      .reduce((sum, e) => sum + Math.max(0, Number(e.netBalance) || 0), 0);
    sweepSummaryEl.textContent = formatDZD(totalAvail);
  }
}

function openSweepModal() {
  const modal = document.getElementById('sweepModal');
  const container = document.getElementById('sweepEnvelopesListContainer');
  const dateInput = document.getElementById('sweepDateInput');
  const reasonInput = document.getElementById('sweepReasonInput');

  // تعيين التاريخ الافتراضي
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateInput) dateInput.value = todayStr;
  if (reasonInput) reasonInput.value = 'تصفية وفائض نهاية الشهر إلى الادخار';

  // أظرفة الصرف الدوري الـ 13
  const spendingEnvs = (state.data.envelopes || []).filter(e => e.group === 'الصرف الدوري');

  if (spendingEnvs.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-slate-400">لا توجد أظرفة صرف دوري مسجلة.</div>';
    modal.classList.remove('hidden');
    return;
  }

  container.innerHTML = spendingEnvs.map(env => {
    const available = Math.max(0, Number(env.netBalance) || 0);
    const hasBalance = available > 0;
    const isChecked = hasBalance;

    return `
      <div class="p-3 rounded-xl border ${hasBalance ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/60 opacity-60'} flex flex-wrap items-center justify-between gap-3 transition hover:border-emerald-300">
        <div class="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            id="sweepCheck-${escapeHtml(env.name)}"
            data-env="${escapeHtml(env.name)}"
            ${isChecked ? 'checked' : ''}
            ${!hasBalance ? 'disabled' : ''}
            onchange="onSweepCheckChange('${escapeHtml(env.name)}')"
            class="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
          >
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${env.color}"></span>
              <span class="font-bold text-slate-800 text-sm truncate">${escapeHtml(env.name)}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              الرصيد المتبقي: <b class="${available > 0 ? 'text-emerald-700' : 'text-slate-400'}">${formatDZD(available)}</b>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="relative w-36">
            <input
              type="number"
              id="sweepAmt-${escapeHtml(env.name)}"
              data-env="${escapeHtml(env.name)}"
              data-max="${available}"
              value="${available}"
              min="0"
              max="${available}"
              ${!hasBalance ? 'disabled' : ''}
              oninput="onSweepAmountInput('${escapeHtml(env.name)}')"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-left font-black text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              placeholder="0"
            >
            <span class="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">دج</span>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              onclick="setSweepAmtFull('${escapeHtml(env.name)}', ${available})"
              ${!hasBalance ? 'disabled' : ''}
              class="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-[10px] font-bold text-slate-600 transition"
              title="سحب كامل الرصيد المتبقي"
            >
              الكل
            </button>
            <button
              type="button"
              onclick="setSweepAmtZero('${escapeHtml(env.name)}')"
              ${!hasBalance ? 'disabled' : ''}
              class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-400 transition"
              title="تصفير المبلغ"
            >
              0
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateSweepTotalDisplay();
  modal.classList.remove('hidden');
}

function closeSweepModal() {
  const modal = document.getElementById('sweepModal');
  if (modal) modal.classList.add('hidden');
}

function onSweepCheckChange(envName) {
  const chk = document.getElementById(`sweepCheck-${envName}`);
  const input = document.getElementById(`sweepAmt-${envName}`);
  if (chk && input) {
    if (chk.checked) {
      const maxVal = Number(input.dataset.max) || 0;
      if (Number(input.value) === 0 && maxVal > 0) {
        input.value = maxVal;
      }
    } else {
      input.value = 0;
    }
  }
  updateSweepTotalDisplay();
}

function onSweepAmountInput(envName) {
  const chk = document.getElementById(`sweepCheck-${envName}`);
  const input = document.getElementById(`sweepAmt-${envName}`);
  if (chk && input) {
    const val = Number(input.value) || 0;
    const maxVal = Number(input.dataset.max) || 0;
    if (val > maxVal) {
      input.value = maxVal;
    }
    chk.checked = Number(input.value) > 0;
  }
  updateSweepTotalDisplay();
}

function setSweepAmtFull(envName, maxVal) {
  const chk = document.getElementById(`sweepCheck-${envName}`);
  const input = document.getElementById(`sweepAmt-${envName}`);
  if (chk && input) {
    input.value = maxVal;
    chk.checked = maxVal > 0;
    updateSweepTotalDisplay();
  }
}

function setSweepAmtZero(envName) {
  const chk = document.getElementById(`sweepCheck-${envName}`);
  const input = document.getElementById(`sweepAmt-${envName}`);
  if (chk && input) {
    input.value = 0;
    chk.checked = false;
    updateSweepTotalDisplay();
  }
}

function updateSweepTotalDisplay() {
  const inputs = document.querySelectorAll('#sweepEnvelopesListContainer input[type="number"]');
  let total = 0;
  let count = 0;

  inputs.forEach(inp => {
    const envName = inp.dataset.env;
    const chk = document.getElementById(`sweepCheck-${envName}`);
    if (chk && chk.checked) {
      const val = Math.max(0, Number(inp.value) || 0);
      total += val;
      if (val > 0) count++;
    }
  });

  const displayEl = document.getElementById('sweepTotalSumDisplay');
  if (displayEl) displayEl.textContent = formatDZD(total);

  const confirmBtn = document.getElementById('sweepConfirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = total <= 0;
    if (total <= 0) {
      confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

async function confirmEnvelopeSweep() {
  const dateVal = document.getElementById('sweepDateInput').value || new Date().toISOString().split('T')[0];
  const reasonVal = (document.getElementById('sweepReasonInput').value || '').trim() || 'تصفية وفائض نهاية الشهر إلى الادخار';

  const inputs = document.querySelectorAll('#sweepEnvelopesListContainer input[type="number"]');
  const itemsToSweep = [];

  inputs.forEach(inp => {
    const envName = inp.dataset.env;
    const chk = document.getElementById(`sweepCheck-${envName}`);
    if (chk && chk.checked) {
      const amt = Math.max(0, Number(inp.value) || 0);
      if (amt > 0) {
        itemsToSweep.push({
          fromEnvelope: envName,
          amount: amt
        });
      }
    }
  });

  if (itemsToSweep.length === 0) {
    alert('يرجى تحديد ظرف واحد على الأقل بمبلغ أكبر من 0 دج للتصفية.');
    return;
  }

  const totalSwept = itemsToSweep.reduce((s, it) => s + it.amount, 0);

  if (!confirm(`هل أنت متأكد من تصفية ${itemsToSweep.length} أظرفة وتحويل إجمالي ${formatDZD(totalSwept)} إلى ظرف الإدخار؟\nسيتم تسجيل هذه التحويلات مباشرة في صفحة "استلاف الأظرفة".`)) {
    return;
  }

  const loansToAdd = [];
  itemsToSweep.forEach(it => {
    const nextRowIndex = (state.data.loans.length > 0 ? Math.max(...state.data.loans.map(l => Number(l.rowIndex) || 0)) : 1) + 1;
    const loanObj = {
      rowIndex: nextRowIndex,
      date: dateVal,
      type: 'تحويل للادخار',
      fromEnvelope: it.fromEnvelope,
      toEnvelope: 'إدخار',
      amount: it.amount,
      reason: reasonVal,
      dueDate: '',
      status: 'تم التحويل',
      repaidAmount: 0,
      remainingAmount: 0,
      note: 'تصفية نهاية الشهر'
    };
    state.data.loans.push(loanObj);
    loansToAdd.push(loanObj);
  });

  recalculateSheetFormulasLocally(state.data);
  saveToLocal();
  renderAll();
  closeSweepModal();
  showToast(`🎉 تمت تصفية ${loansToAdd.length} أظرفة بنجاح وتحويل ${formatDZD(totalSwept)} إلى ظرف الإدخار`);

  if (state.scriptUrl) {
    postToGoogleSheet({
      action: 'batchAddLoans',
      loans: loansToAdd
    });
  }
}

// ==================== التنقل بين التبويبات الأربعة ====================
function switchTab(tabName) {
  state.currentTab = tabName;
  ['dashboard', 'expenses', 'loans', 'feeding'].forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const deskTab = document.getElementById(`deskTab-${t}`);
    const mobTab = document.getElementById(`mobTab-${t}`);

    if (t === tabName) {
      view.classList.remove('hidden');
      if (deskTab) deskTab.className = 'py-3 px-2 tab-active flex items-center gap-2 transition';
      if (mobTab) mobTab.classList.add('mobile-nav-active');
    } else {
      view.classList.add('hidden');
      if (deskTab) deskTab.className = 'py-3 px-2 text-slate-300 hover:text-white flex items-center gap-2 transition';
      if (mobTab) mobTab.classList.remove('mobile-nav-active');
    }
  });

  updateFloatingButtonsVisibility(tabName);

  if (tabName === 'dashboard') {
    renderCharts();
  } else if (tabName === 'loans') {
    renderLoansList();
  }
}

// ==================== المزامنة مع Google Sheets ====================
function openSettingsModal() {
  document.getElementById('scriptUrlInput').value = state.scriptUrl;
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

async function saveSettings() {
  const url = document.getElementById('scriptUrlInput').value.trim();
  state.scriptUrl = url;
  localStorage.setItem(STORAGE_KEYS.SCRIPT_URL, url);
  updateConnectionStatusUI();
  closeSettingsModal();

  if (url) {
    await syncWithGoogleSheets();
  } else {
    showToast('تم حفظ الإعدادات');
  }
}

async function syncWithGoogleSheets(silent = false) {
  if (!state.scriptUrl) {
    if (!silent) openSettingsModal();
    return;
  }

  const syncIcon = document.getElementById('syncIcon');
  syncIcon.classList.add('fa-spin');

  try {
    const response = await fetch(state.scriptUrl, { method: 'GET' });
    const resData = await response.json();

    if (resData && resData.status === 'success') {
      state.data = {
        overview: resData.overview || state.data.overview,
        annualSummary: resData.annualSummary || state.data.annualSummary,
        envelopes: resData.envelopes || state.data.envelopes,
        feedingCycles: resData.feedingCycles || state.data.feedingCycles,
        expenses: resData.expenses || state.data.expenses,
        loans: resData.loans || state.data.loans,
        accounts: resData.accounts || (state.data && state.data.accounts),
        accountInflows: resData.accountInflows || (state.data && state.data.accountInflows),
        transfers: resData.transfers || (state.data && state.data.transfers)
      };
      saveToLocal();
      populateMonthSelector();
      renderAll();
      if (!silent) showToast('تمت المزامنة مع ملف "ميزانية العائلة" بنجاح!');
    } else {
      if (!silent) showToast('تعذر قراءة الشيت، تأكد من نشر السكربت بصلاحية Anyone');
    }
  } catch (err) {
    console.error('Sync error:', err);
    if (!silent) showToast('تعذر الاتصال برابط Google Apps Script');
  } finally {
    syncIcon.classList.remove('fa-spin');
  }
}

async function postToGoogleSheet(payload) {
  if (!state.scriptUrl) return;
  const syncIcon = document.getElementById('syncIcon');
  syncIcon.classList.add('fa-spin');

  try {
    const response = await fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    if (resData && resData.status === 'success') {
      state.data = {
        overview: resData.overview || state.data.overview,
        annualSummary: resData.annualSummary || state.data.annualSummary,
        envelopes: resData.envelopes || state.data.envelopes,
        feedingCycles: resData.feedingCycles || state.data.feedingCycles,
        expenses: resData.expenses || state.data.expenses,
        loans: resData.loans || state.data.loans,
        accounts: resData.accounts || (state.data && state.data.accounts),
        accountInflows: resData.accountInflows || (state.data && state.data.accountInflows),
        transfers: resData.transfers || (state.data && state.data.transfers)
      };
      saveToLocal();
      populateMonthSelector();
      renderAll();
    } else if (resData && resData.status === 'error') {
      showToast(resData.message || 'تعذر تنفيذ العملية في الشيت', true);
    }
  } catch (err) {
    console.error('Post error:', err);
    showToast('تم الحفظ محلياً، وتعذر الإرسال للشيت');
  } finally {
    syncIcon.classList.remove('fa-spin');
  }
}

function resetToSheetSnapshot() {
  if (!confirm('هل تريد استعادة نسخة بيانات ملفك الأصلية؟')) return;
  state.data = getInitialSheetSnapshot();
  saveToLocal();
  populateMonthSelector();
  renderAll();
  closeSettingsModal();
  showToast('تمت استعادة البيانات المطابقة لملفك');
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 ${isError ? 'bg-red-700' : 'bg-slate-900'} text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 max-w-md text-center`;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, isError ? 4500 : 3200);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toggleAccountsSection(event) {
  if (event && event.target && event.target.closest('button')) return;
  const wrap = document.getElementById('accountsGridWrap');
  const header = document.getElementById('accountsHeaderBar');
  const chevron = document.getElementById('accountsCollapseChevron');
  if (!wrap) return;

  const isHidden = wrap.classList.toggle('hidden');
  if (chevron) {
    chevron.classList.toggle('rotate-180', !isHidden);
  }
  if (header) {
    if (isHidden) {
      header.classList.remove('border-b', 'border-slate-100', 'pb-2.5');
    } else {
      header.classList.add('border-b', 'border-slate-100', 'pb-2.5');
    }
  }
}

function openEnvelopeExpenses(envName, event) {
  if (event) event.stopPropagation();
  const filterEnv = document.getElementById('filterEnvelopeSelect');
  if (filterEnv) {
    filterEnv.value = envName;
  }
  const searchInput = document.getElementById('searchExpenseInput');
  if (searchInput) {
    searchInput.value = '';
  }
  const paySelect = document.getElementById('filterPaymentSelect');
  if (paySelect) {
    paySelect.value = 'ALL';
  }
  switchTab('expenses');
  renderExpensesList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast(`🧾 عرض مصاريف ظرف: ${envName}`);
}

// ربط الدوال العامة بالكائن window لضمان عمل كافة عناصر HTML
window.openEnvelopeExpenses = openEnvelopeExpenses;
window.toggleAccountsSection = toggleAccountsSection;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.openTransfersListModal = openTransfersListModal;
window.closeTransfersListModal = closeTransfersListModal;
window.handleSaveTransfer = handleSaveTransfer;
window.onExpenseEnvelopeChange = onExpenseEnvelopeChange;
window.openExpenseModal = openExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.handleSaveExpense = handleSaveExpense;
window.openLoanModal = openLoanModal;
window.closeLoanModal = closeLoanModal;
window.handleSaveLoan = handleSaveLoan;
window.handleDeleteLoan = handleDeleteLoan;
window.handleRepayLoan = handleRepayLoan;
window.openSweepModal = openSweepModal;
window.closeSweepModal = closeSweepModal;
window.handleExecuteSweep = handleExecuteSweep;
window.resetToSheetSnapshot = resetToSheetSnapshot;
window.toggleEnvelopeExpand = toggleEnvelopeExpand;
window.cycleEnvelopeCategoryFilter = cycleEnvelopeCategoryFilter;
window.cycleLoanTypeFilter = cycleLoanTypeFilter;
window.handleFloatingAddClick = handleFloatingAddClick;
window.updateFloatingButtonsVisibility = updateFloatingButtonsVisibility;
