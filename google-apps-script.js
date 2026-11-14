/**
 * كود Google Apps Script المخصص لملف "ميزانية العائلة"
 * مطابق 100% لهيكل الصفحات ومعادلاتها دون أي تغيير على تصميم الملف:
 * 1. الأظرفة الموحدة (الورقة1 سابقاً - المرجع الأساسي الموحد للأظرفة والرواتب والحسابات)
 * 2. تغذية الأظرفة (قراءة الأرصدة والتغذيات وتوزيع الحصص)
 * 3. المصاريف اليومية (إضافة / تعديل / حذف مع الحفاظ على الرصيد)
 * 4. استلاف الأظرفة (إضافة سلفة أو تحويل / تسديد / مسح مع حماية المعادلات)
 * 5. إدارة الحسابات (أرصدة الحسابات الأربعة: CCP، كاش، أورو، USDT وسجل الدخل)
 * 6. التحويلات المالية (سجل التحويل والصرف بين الحسابات وسحب السيولة والرسوم)
 */

const SHEET_NAMES = {
  OVERVIEW: 'الأظرفة الموحدة',
  OVERVIEW_FALLBACK: 'الورقة1',
  EXPENSES: 'المصاريف اليومية',
  LOANS: 'استلاف الأظرفة',
  FEEDING: 'تغذية الأظرفة',
  ACCOUNTS: 'إدارة الحسابات',
  TRANSFERS: 'التحويلات المالية'
};

// تحويل أي قيمة رقمية أو نص يحتوي على "دج" أو "€" أو "$" وفواصل إلى رقم صافي
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val)
    .replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// تنسيق التاريخ إلى yyyy-MM-dd
function formatDateVal(val, tz) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return String(val).trim();
}

// قراءة كافة بيانات الملف من كافة الصفحات
function readAllBudgetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'GMT+1';

  const overviewSheet = ss.getSheetByName(SHEET_NAMES.OVERVIEW) || ss.getSheetByName(SHEET_NAMES.OVERVIEW_FALLBACK);
  const expSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
  const feedSheet = ss.getSheetByName(SHEET_NAMES.FEEDING);
  const accountsSheet = ss.getSheetByName(SHEET_NAMES.ACCOUNTS);
  const transfersSheet = ss.getSheetByName(SHEET_NAMES.TRANSFERS);

  // 1. قراءة شيت "الأظرفة الموحدة" (المرجع الأساسي المحدث)
  const overview = {
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
    totalEnvelopesText: '23 ظرفاً',
    envelopesConfig: {},
    savingsGoals: {}
  };

  if (overviewSheet) {
    const ovVals = overviewSheet.getDataRange().getValues();
    if (ovVals.length >= 2) {
      overview.monthlySalary = parseNum(ovVals[1][1]) || 104200; // B2
      const quarterlyBonus = parseNum(ovVals[1][3]) || 52350;     // D2
      overview.quarterlyBonusTotal = quarterlyBonus;
      overview.quarterlyBonusMonthlyAvg = Math.round(quarterlyBonus / 3);
      overview.weightedMonthlyAvg = parseNum(ovVals[1][5]) || (overview.monthlySalary + overview.quarterlyBonusMonthlyAvg); // F2
      overview.totalEnvelopesText = String(ovVals[1][7] || '23 ظرفاً').trim(); // H2
    }

    // ملخص الفئات من الأعمدة L..N (الصفوف 7..10 -> index 6..9)
    if (ovVals.length >= 10) {
      overview.essentialsTotal = parseNum(ovVals[6][12]) || 72150; // M7
      overview.luxuriesTotal = parseNum(ovVals[7][12]) || 25000;   // M8
      overview.savingsTotal = parseNum(ovVals[8][12]) || 24500;    // M9
      overview.contingencyTotal = parseNum(ovVals[9][12]) || 0;    // M10
    }

    // قراءة ملخص نوع الحساب (السيولة) بدقة بالبحث في العمود L
    for (let r = 0; r < ovVals.length; r++) {
      const lbl = String(ovVals[r][11] || '').trim(); // العمود L
      if (lbl === 'كاش') {
        overview.cashTotal = parseNum(ovVals[r][12]) || 69150; // العمود M
      } else if (lbl === 'حساب جاري' || lbl.includes('جاري')) {
        overview.currentAccountTotal = parseNum(ovVals[r][12]) || 52500; // العمود M
      }
    }

    // قراءة جدول الأظرفة الموحدة بدءاً من الصف 7 (index 6)
    // الأعمدة: B (فئة)، C (اسم الظرف)، D (نوع الظرف)، E (نوع الحساب)، F (مخصص راتب)، G (مردودية شهري)، H (موزون)، J (دورة التجميع)
    for (let r = 6; r < ovVals.length; r++) {
      const row = ovVals[r];
      const envName = String(row[2] || '').trim(); // العمود C
      if (!envName || envName === 'المجموع الإجمالي' || envName === 'اسم الظرف') continue;

      const rawCat = String(row[1] || '').trim(); // العمود B
      const cleanCategory = rawCat.includes('استثمار') ? 'استثمار وادخار'
                          : rawCat.includes('احتياطي') ? 'احتياطي وتدوير'
                          : rawCat.includes('كماليات') ? 'كماليات'
                          : 'أساسيات';
      const envType = String(row[3] || '').trim();  // العمود D (صرف دوري / إدخار وتراكم)
      const accType = String(row[4] || '').trim();  // العمود E (كاش / حساب جاري / إلخ)
      const salRef = parseNum(row[5]);              // العمود F
      const bonusRefMonthly = parseNum(row[6]);     // G
      const weightedMonthly = parseNum(row[7]);     // H
      const rawMonths = row[9]; // العمود J (دورة التجميع)
      const parsedMonths = (rawMonths !== '' && rawMonths !== null && !isNaN(Number(rawMonths))) ? Number(rawMonths) : 0;
      const accMonths = Math.max(0, parsedMonths);

      // الأظرفة التي أشهر تراكمها 0 هي أظرفة صرف دوري وليس لها هدف
      const isSpending = accMonths === 0 || envType.includes('صرف');
      const groupName = isSpending ? 'الصرف الدوري' : 'الإدخار والتراكم';

      overview.envelopesConfig[envName] = {
        name: envName,
        majorCategory: cleanCategory,
        originalCategory: rawCat,
        group: groupName,
        accountType: accType || 'كاش',
        salaryRef: salRef,
        bonusMonthlyRef: bonusRefMonthly,
        totalMonthlyAllocated: weightedMonthly || (salRef + bonusRefMonthly),
        accumulationMonths: accMonths
      };

      if (accMonths > 0) {
        overview.savingsGoals[envName] = accMonths;
      }
    }
  }

  // 2. قراءة شيت "إدارة الحسابات" (الأرصدة الأربعة ومحافظ السيولة)
  const accounts = {
    ccp: { key: 'ccp', name: 'حساب CCP', fullName: 'حساب بريدي جاري (CCP)', balance: 0, totalIn: 0, totalOut: 0, currency: 'دج', icon: 'fa-building-columns' },
    cash: { key: 'cash', name: 'كاش', fullName: 'كاش (نقدي)', balance: 0, totalIn: 0, totalOut: 0, currency: 'دج', icon: 'fa-money-bill-wave' },
    euro: { key: 'euro', name: 'حساب أورو', fullName: 'حساب يورو (EURO)', balance: 0, totalIn: 0, totalOut: 0, currency: '€', icon: 'fa-euro-sign' },
    usdt: { key: 'usdt', name: 'حساب USDT', fullName: 'حساب دولار رقمي (USDT)', balance: 0, totalIn: 0, totalOut: 0, currency: '$', icon: 'fa-coins' }
  };

  const accountInflows = [];
  if (accountsSheet) {
    const accVals = accountsSheet.getDataRange().getValues();
    if (accVals.length >= 6) {
      // الصف 4 (index 3): B4 (CCP), E4 (Cash), H4 (Euro), K4/L4 (USDT)
      accounts.ccp.balance = parseNum(accVals[3][1]);
      accounts.cash.balance = parseNum(accVals[3][4]);
      accounts.euro.balance = parseNum(accVals[3][7]);
      accounts.usdt.balance = parseNum(accVals[3][10]);

      // الصف 5 (index 4): C5 (CCP وارد), F5 (Cash وارد), I5 (Euro وارد), L5 (USDT وارد)
      accounts.ccp.totalIn = parseNum(accVals[4][2]);
      accounts.cash.totalIn = parseNum(accVals[4][5]);
      accounts.euro.totalIn = parseNum(accVals[4][8]);
      accounts.usdt.totalIn = parseNum(accVals[4][11]);

      // الصف 6 (index 5): C6 (CCP منصرف), F6 (Cash منصرف), I6 (Euro منصرف), L6 (USDT منصرف)
      accounts.ccp.totalOut = parseNum(accVals[5][2]);
      accounts.cash.totalOut = parseNum(accVals[5][5]);
      accounts.euro.totalOut = parseNum(accVals[5][8]);
      accounts.usdt.totalOut = parseNum(accVals[5][11]);
    }

    // سجل تغذية الحسابات بالدخل والإيداعات (الصف 10 فما فوق)
    for (let r = 9; r < accVals.length; r++) {
      const row = accVals[r];
      const dateVal = formatDateVal(row[1], tz);
      const statement = String(row[2] || '').trim();
      const amount = parseNum(row[5]);
      if (!statement && !amount) continue;

      accountInflows.push({
        rowIndex: r + 1,
        date: dateVal,
        statement: statement,
        incomeType: String(row[3] || '').trim(),
        toAccount: String(row[4] || '').trim(),
        amount: amount,
        currency: String(row[6] || 'دج').trim(),
        note: String(row[7] || '').trim()
      });
    }
  }

  // 3. قراءة شيت "التحويلات المالية" (سجل التحويلات والصرف بين الحسابات)
  const transfers = [];
  if (transfersSheet) {
    const trVals = transfersSheet.getDataRange().getValues();
    for (let r = 3; r < trVals.length; r++) {
      const row = trVals[r];
      const dateVal = formatDateVal(row[1], tz);
      const fromAcc = String(row[2] || '').trim();
      const toAcc = String(row[3] || '').trim();
      const amount = parseNum(row[4]);
      if (!fromAcc && !amount) continue;

      transfers.push({
        rowIndex: r + 1,
        date: dateVal,
        fromAccount: fromAcc,
        toAccount: toAcc,
        amount: amount,
        fromCurrency: String(row[5] || 'دج').trim(),
        exchangeRate: parseNum(row[6]) || 1,
        fee: parseNum(row[7]) || 0,
        netReceived: parseNum(row[8]) || (amount - (parseNum(row[7]) || 0)),
        toCurrency: String(row[9] || 'دج').trim(),
        note: String(row[10] || '').trim()
      });
    }
  }

  // 4. قراءة "تغذية الأظرفة" (الأظرفة الـ 23 + المرجع + التغذية السنوية + صافي الرصيد + دورات الأشهر)
  const envelopes = [];
  const feedingCycles = [];
  let annualSummary = {};

  if (feedSheet) {
    const feedVals = feedSheet.getDataRange().getValues();
    const groupRow = feedVals[5] || [];      // الصف 6: مجموعات الأظرفة
    const headerRow = feedVals[6] || [];     // الصف 7: أسماء الأظرفة من H7 إلى AD7 (index 7..29)
    const salaryRefRow = feedVals[7] || [];  // الصف 8: الحصة المخصصة (راتب شهري)
    const bonusRefRow = feedVals[8] || [];   // الصف 9: الحصة المخصصة (منحة المردودية)
    const annualFedRow = feedVals[9] || [];  // الصف 10: إجمالي التغذية السنوية
    const netBalanceRow = feedVals[10] || []; // الصف 11: صافي رصيد كل ظرف

    annualSummary = {
      year: feedVals[2] ? feedVals[2][2] : 2026,
      totalAnnualIncome: feedVals[2] ? parseNum(feedVals[2][5]) : 0,
      totalAnnualDistributed: feedVals[2] ? parseNum(feedVals[2][6]) : 0,
      totalAnnualRemaining: feedVals[2] ? parseNum(feedVals[2][7]) : 0,
      budgetStatus: feedVals[2] ? String(feedVals[2][8] || '') : '',
      totalNetAvailable: parseNum(netBalanceRow[3]), // D11
      totalSpentAll: parseNum(netBalanceRow[4]),     // E11
      totalPendingLoans: parseNum(netBalanceRow[5]), // F11
      netStatus: String(netBalanceRow[6] || '')      // G11
    };

    let currentGroup = 'الصرف الدوري';
    for (let col = 7; col <= 29; col++) {
      const name = String(headerRow[col] || '').trim();
      if (!name) continue;

      const groupCell = String(groupRow[col] || '').trim();
      if (groupCell.includes('الصرف الدوري')) currentGroup = 'الصرف الدوري';
      else if (groupCell.includes('الإدخار والتراكم')) currentGroup = 'الإدخار والتراكم';
      else if (groupCell.includes('احتياطي وتدوير')) currentGroup = 'احتياطي وتدوير';

      // استخدام إعدادات الظرف الدقيقة من جدول "الأظرفة الموحدة"
      const cfg = overview.envelopesConfig[name] || {};
      const group = cfg.group || currentGroup;
      const majorCategory = cfg.majorCategory || (group === 'الصرف الدوري' ? 'أساسيات' : 'استثمار وادخار');
      const accountType = cfg.accountType || 'كاش';

      const salaryRef = cfg.salaryRef !== undefined ? cfg.salaryRef : parseNum(salaryRefRow[col]);
      const bonusQuarterlyRef = parseNum(bonusRefRow[col]);
      const bonusMonthlyRef = cfg.bonusMonthlyRef !== undefined ? cfg.bonusMonthlyRef : Math.round(bonusQuarterlyRef / 3);
      const totalMonthlyAlloc = cfg.totalMonthlyAllocated || (salaryRef + bonusMonthlyRef);

      const accumulationMonths = cfg.accumulationMonths !== undefined
        ? Number(cfg.accumulationMonths)
        : ((overview.savingsGoals && overview.savingsGoals[name]) ? Number(overview.savingsGoals[name]) : 0);
      const targetAmount = accumulationMonths > 0 ? (totalMonthlyAlloc * accumulationMonths) : 0;
      const finalGroup = accumulationMonths > 0 ? 'الإدخار والتراكم' : 'الصرف الدوري';

      envelopes.push({
        colIndex: col + 1, // 1-based column (8 = H .. 30 = AD)
        keyIndex: col - 7, // 0..22
        name: name,
        group: finalGroup,
        majorCategory: majorCategory,
        accountType: accountType,
        salaryRef: salaryRef,
        bonusMonthlyRef: bonusMonthlyRef,
        totalMonthlyAllocated: totalMonthlyAlloc,
        bonusRef: bonusQuarterlyRef,
        annualFed: parseNum(annualFedRow[col]),
        netBalance: parseNum(netBalanceRow[col]),
        accumulationMonths: accumulationMonths,
        targetAmount: targetAmount
      });
    }

    // قراءة الصفوف 12 إلى 27 (دورات التغذية الشهرية ومنح المردودية)
    for (let r = 11; r < feedVals.length; r++) {
      const row = feedVals[r];
      const monthName = String(row[0] || '').trim();
      if (!monthName) continue;

      const allocations = {};
      envelopes.forEach(env => {
        const rawCell = row[env.colIndex - 1];
        allocations[env.name] = rawCell === '' || rawCell === null ? '' : parseNum(rawCell);
      });

      feedingCycles.push({
        rowIndex: r + 1,
        monthName: monthName,
        year: Number(row[1]) || 2026,
        incomeType: String(row[2] || '').trim(),
        receivedAmount: row[3] === '' || row[3] === null ? '' : parseNum(row[3]),
        totalAllocated: parseNum(row[4]),
        remainingToAllocate: parseNum(row[5]),
        allocationStatus: String(row[6] || '').trim(),
        allocations: allocations
      });
    }
  }

  // 5. قراءة "المصاريف اليومية"
  const expenses = [];
  if (expSheet) {
    const expVals = expSheet.getDataRange().getValues();
    for (let i = 1; i < expVals.length; i++) {
      const row = expVals[i];
      const d = formatDateVal(row[0], tz);
      const env = String(row[1] || '').trim();
      const amount = parseNum(row[3]);
      if (!d && !env && !amount) continue;

      expenses.push({
        rowIndex: i + 1,
        date: d,
        envelope: env,
        statement: String(row[2] || '').trim(),
        amount: amount,
        paymentMethod: String(row[4] || 'كاش').trim(),
        note: String(row[5] || '').trim()
      });
    }
  }

  // 6. قراءة "استلاف الأظرفة"
  const loans = [];
  if (loanSheet) {
    const loanVals = loanSheet.getDataRange().getValues();
    for (let i = 1; i < loanVals.length; i++) {
      const row = loanVals[i];
      const d = formatDateVal(row[0], tz);
      const fromEnv = String(row[2] || '').trim();
      const toEnv = String(row[3] || '').trim();
      const amount = parseNum(row[4]);
      if (!d && !fromEnv && !toEnv && !amount) continue;

      loans.push({
        rowIndex: i + 1,
        date: formatDateVal(row[0], tz),
        type: String(row[1] || 'سلفة مؤقتة').trim(),
        fromEnvelope: String(row[2] || '').trim(),
        toEnvelope: String(row[3] || '').trim(),
        amount: parseNum(row[4]),
        reason: String(row[5] || '').trim(),
        dueDate: formatDateVal(row[6], tz),
        status: String(row[7] || '').trim(),
        repaidAmount: parseNum(row[8]),
        remainingAmount: parseNum(row[9]),
        note: String(row[10] || '').trim()
      });
    }
  }

  return {
    status: 'success',
    overview,
    annualSummary,
    envelopes,
    feedingCycles,
    expenses,
    loans,
    accounts,
    accountInflows,
    transfers
  };
}

// استقبال طلب القراءة (GET)
function doGet(e) {
  try {
    return createJsonResponse(readAllBudgetData());
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// استقبال طلبات الإضافة والتعديل والحذف (POST) مع إرجاع البيانات المحدثة فوراً
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'GMT+1';
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // ==================== 1. عمليات المصاريف اليومية ====================
    if (action === 'addExpense') {
      const expSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
      const feedSheet = ss.getSheetByName(SHEET_NAMES.FEEDING);
      const item = payload.expense;

      // التحقق من أن مبلغ المصروف لا يتجاوز الرصيد المتاح في الظرف (حتى لا يصبح الظرف سالباً)
      if (feedSheet) {
        const headerNames = feedSheet.getRange(7, 8, 1, 23).getValues()[0];
        const netBalances = feedSheet.getRange(11, 8, 1, 23).getValues()[0];
        const envIdx = headerNames.findIndex(n => String(n || '').trim() === String(item.envelope || '').trim());
        if (envIdx !== -1) {
          const availableInEnv = parseNum(netBalances[envIdx]);
          if (Number(item.amount) > availableInEnv) {
            return createJsonResponse({
              status: 'error',
              message: `عملية مرفوضة: المبلغ (${item.amount}) أكبر من الرصيد المتاح في ظرف "${item.envelope}" (${availableInEnv})`
            });
          }
        }
      }

      const lastRow = expSheet.getLastRow();
      let targetRow = Math.max(2, lastRow + 1);
      const existing = expSheet.getRange('A2:A' + Math.max(2, lastRow + 1)).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (!existing[i][0]) {
          targetRow = i + 2;
          break;
        }
      }

      expSheet.getRange(targetRow, 1, 1, 6).setValues([[
        item.date,
        item.envelope,
        item.statement || '',
        Number(item.amount) || 0,
        item.paymentMethod || 'كاش',
        item.note || ''
      ]]);
    }

    else if (action === 'editExpense' || action === 'updateExpense') {
      const expSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
      const item = payload.expense;
      const rowIndex = Number(item.rowIndex);
      if (rowIndex >= 2) {
        expSheet.getRange(rowIndex, 1, 1, 6).setValues([[
          item.date,
          item.envelope,
          item.statement || '',
          Number(item.amount) || 0,
          item.paymentMethod || 'كاش',
          item.note || ''
        ]]);
      }
    }

    else if (action === 'deleteExpense') {
      const expSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
      const rowIndex = Number(payload.rowIndex);
      if (rowIndex >= 2) {
        expSheet.getRange(rowIndex, 1, 1, 6).clearContent();
      }
    }

    // ==================== 2. عمليات استلاف الأظرفة ====================
    else if (action === 'addLoan') {
      const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
      const feedSheet = ss.getSheetByName(SHEET_NAMES.FEEDING);
      const item = payload.loan;

      // منع الاستلاف أو التحويل إذا كان رصيد الظرف المصدر غير كافٍ
      if (feedSheet && item.type !== 'إرجاع سلفة') {
        const headerNames = feedSheet.getRange(7, 8, 1, 23).getValues()[0];
        const netBalances = feedSheet.getRange(11, 8, 1, 23).getValues()[0];
        const envIdx = headerNames.findIndex(n => String(n || '').trim() === String(item.fromEnvelope || '').trim());
        if (envIdx !== -1) {
          const availableInFrom = parseNum(netBalances[envIdx]);
          if (Number(item.amount) > availableInFrom) {
            return createJsonResponse({
              status: 'error',
              message: `عملية مرفوضة: رصيد الظرف المصدر "${item.fromEnvelope}" (${availableInFrom}) غير كافٍ لسحب (${item.amount})`
            });
          }
        }
      }

      const lastRow = loanSheet.getLastRow();
      let targetRow = Math.max(2, lastRow + 1);
      const existing = loanSheet.getRange('A2:A' + Math.max(2, lastRow + 1)).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (!existing[i][0]) {
          targetRow = i + 2;
          break;
        }
      }

      loanSheet.getRange(targetRow, 1, 1, 7).setValues([[
        item.date,
        item.type || 'سلفة مؤقتة',
        item.fromEnvelope,
        item.toEnvelope,
        Number(item.amount) || 0,
        item.reason || '',
        item.dueDate || ''
      ]]);
      loanSheet.getRange(targetRow, 9).setValue(Number(item.repaidAmount) || 0);
      loanSheet.getRange(targetRow, 11).setValue(item.note || '');

      // الحفاظ على صيغ المعادلات في H و J
      const hFormula = loanSheet.getRange(targetRow, 8).getFormula();
      if (!hFormula) {
        loanSheet.getRange(targetRow, 8).setFormula(
          `=IF(E${targetRow}="","", IF(B${targetRow}="تحويل للادخار", "تم التحويل", IF(I${targetRow}>E${targetRow}, "خطأ", IF(N(I${targetRow})=0, "معلق", IF(J${targetRow}<=0, "تم التسديد", "تسديد جزئي")))))`
        );
      }
      const jFormula = loanSheet.getRange(targetRow, 10).getFormula();
      if (!jFormula) {
        loanSheet.getRange(targetRow, 10).setFormula(
          `=IF(E${targetRow}="","", IF(B${targetRow}="تحويل للادخار", 0, E${targetRow}-N(I${targetRow})))`
        );
      }
    }

    else if (action === 'batchAddLoans') {
      const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
      const items = payload.loans || [];
      if (loanSheet && items.length > 0) {
        let lastRow = loanSheet.getLastRow();
        for (let k = 0; k < items.length; k++) {
          const item = items[k];
          let r = Math.max(2, lastRow + 1);
          const existing = loanSheet.getRange('A2:A' + Math.max(2, lastRow + 1)).getValues();
          for (let i = 0; i < existing.length; i++) {
            if (!existing[i][0]) {
              r = i + 2;
              break;
            }
          }
          if (r > lastRow) lastRow = r;

          loanSheet.getRange(r, 1, 1, 7).setValues([[
            item.date,
            item.type || 'تحويل للادخار',
            item.fromEnvelope,
            item.toEnvelope || 'إدخار',
            Number(item.amount) || 0,
            item.reason || 'تصفية نهاية الشهر',
            item.dueDate || ''
          ]]);
          loanSheet.getRange(r, 9).setValue(Number(item.repaidAmount) || 0);
          loanSheet.getRange(r, 11).setValue(item.note || 'تصفية آلية');

          const hFormula = loanSheet.getRange(r, 8).getFormula();
          if (!hFormula) {
            loanSheet.getRange(r, 8).setFormula(
              `=IF(E${r}="","", IF(B${r}="تحويل للادخار", "تم التحويل", IF(I${r}>E${r}, "خطأ", IF(N(I${r})=0, "معلق", IF(J${r}<=0, "تم التسديد", "تسديد جزئي")))))`
            );
          }
          const jFormula = loanSheet.getRange(r, 10).getFormula();
          if (!jFormula) {
            loanSheet.getRange(r, 10).setFormula(
              `=IF(E${r}="","", IF(B${r}="تحويل للادخار", 0, E${r}-N(I${r})))`
            );
          }
        }
      }
    }

    else if (action === 'editLoan' || action === 'updateLoan') {
      const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
      const item = payload.loan;
      const r = Number(item.rowIndex);
      if (r >= 2) {
        loanSheet.getRange(r, 1, 1, 7).setValues([[
          item.date,
          item.type || 'سلفة مؤقتة',
          item.fromEnvelope,
          item.toEnvelope,
          Number(item.amount) || 0,
          item.reason || '',
          item.dueDate || ''
        ]]);
        loanSheet.getRange(r, 9).setValue(Number(item.repaidAmount) || 0);
        loanSheet.getRange(r, 11).setValue(item.note || '');
      }
    }

    else if (action === 'repayLoan') {
      const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
      const r = Number(payload.rowIndex);
      const repaidAmount = Number(payload.repaidAmount);
      if (r >= 2) {
        loanSheet.getRange(r, 9).setValue(repaidAmount);
      }
    }

    else if (action === 'deleteLoan') {
      const loanSheet = ss.getSheetByName(SHEET_NAMES.LOANS);
      const r = Number(payload.rowIndex);
      if (r >= 2) {
        loanSheet.getRange(r, 1, 1, 7).clearContent();
        loanSheet.getRange(r, 9).clearContent();
        loanSheet.getRange(r, 11).clearContent();
      }
    }

    // ==================== 3. عمليات التحويلات المالية بين الحسابات ====================
    else if (action === 'addTransfer') {
      const transfersSheet = ss.getSheetByName(SHEET_NAMES.TRANSFERS);
      if (transfersSheet) {
        const item = payload.transfer || {};
        const lastRow = transfersSheet.getLastRow();
        let targetRow = Math.max(4, lastRow + 1);
        const existing = transfersSheet.getRange('B4:B' + Math.max(4, lastRow + 1)).getValues();
        for (let i = 0; i < existing.length; i++) {
          if (!existing[i][0]) {
            targetRow = i + 4;
            break;
          }
        }

        const tDate = item.date || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
        const fromAcc = item.fromAccount || 'حساب CCP';
        const toAcc = item.toAccount || 'كاش';
        const amount = Number(item.amount) || 0;
        const fee = Number(item.fee) || 0;
        const rate = Number(item.exchangeRate) || 1;
        const fromCur = item.fromCurrency || 'دج';
        const toCur = item.toCurrency || 'دج';
        const note = item.note || '';

        transfersSheet.getRange(targetRow, 2, 1, 10).setValues([[
          tDate,
          fromAcc,
          toAcc,
          amount,
          fromCur,
          rate,
          fee,
          '', // سيتم وضع المعادلة في العمود I (9)
          toCur,
          note
        ]]);

        transfersSheet.getRange(targetRow, 9).setFormula(
          `=IF(OR(ISBLANK(E${targetRow}),E${targetRow}=""),"",IF(C${targetRow}=D${targetRow},"خطأ: نفس الحساب",(E${targetRow}-N(H${targetRow}))*IF(IFERROR(VALUE(G${targetRow}),0)>0,IFERROR(VALUE(G${targetRow}),1),1)))`
        );
      }
    }

    // ==================== 4. تغذية الحسابات بالدخل والإيداعات ====================
    else if (action === 'addAccountIncome') {
      const accountsSheet = ss.getSheetByName(SHEET_NAMES.ACCOUNTS);
      if (accountsSheet) {
        const item = payload.income || {};
        const lastRow = accountsSheet.getLastRow();
        let targetRow = Math.max(10, lastRow + 1);
        const existing = accountsSheet.getRange('B10:B' + Math.max(10, lastRow + 1)).getValues();
        for (let i = 0; i < existing.length; i++) {
          if (!existing[i][0]) {
            targetRow = i + 10;
            break;
          }
        }

        accountsSheet.getRange(targetRow, 2, 1, 7).setValues([[
          item.date || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
          item.statement || '',
          item.incomeType || 'راتب شهري',
          item.toAccount || 'حساب CCP',
          Number(item.amount) || 0,
          item.currency || 'دج',
          item.note || ''
        ]]);
      }
    }

    // ==================== 5. عمليات تغذية الأظرفة ====================
    else if (action === 'saveFeedingCycle') {
      const feedSheet = ss.getSheetByName(SHEET_NAMES.FEEDING);
      const cycle = payload.cycle;
      const allVals = feedSheet.getDataRange().getValues();
      let targetRow = -1;

      for (let r = 11; r < allVals.length; r++) {
        const mName = String(allVals[r][0] || '').trim();
        const yVal = Number(allVals[r][1]) || 0;
        const iType = String(allVals[r][2] || '').trim();
        if (mName === String(cycle.monthName || '').trim() && yVal === Number(cycle.year)) {
          if (
            iType === String(cycle.incomeType || '').trim() ||
            ((cycle.incomeType === 'راتب شهري' || cycle.incomeType === 'راتب') && (iType === 'راتب شهري' || iType === 'راتب'))
          ) {
            targetRow = r + 1;
            break;
          }
        }
      }

      if (targetRow === -1) {
        targetRow = Math.max(allVals.length + 1, 12);
        feedSheet.getRange(targetRow, 1, 1, 3).setValues([[
          cycle.monthName || '',
          Number(cycle.year) || 2026,
          cycle.incomeType || ''
        ]]);
        feedSheet.getRange(targetRow, 5).setFormula(`=IF(COUNT(H${targetRow}:AD${targetRow})=0, 0, SUM(H${targetRow}:AD${targetRow}))`);
        feedSheet.getRange(targetRow, 6).setFormula(`=IF(AND(D${targetRow}="", E${targetRow}=0), 0, N(D${targetRow})-E${targetRow})`);
        feedSheet.getRange(targetRow, 7).setFormula(`=IF(AND(D${targetRow}="", E${targetRow}=0), "⚪ غير مسجل", IF(D${targetRow}="", "⚠️ بدون دخل مسجل", IF(F${targetRow}=0, "✅ متوازنة 100%", IF(F${targetRow}>0, "⚠️ يوجد فائض", "❌ عجز مالي"))))`);

        if (targetRow > 27) {
          for (let col = 8; col <= 30; col++) {
            const colLetter = columnToLetter(col);
            feedSheet.getRange(10, col).setFormula(`=SUM(${colLetter}12:${colLetter}${targetRow})`);
          }
        }
      }

      const recVal = cycle.receivedAmount === '' || cycle.receivedAmount === null ? '' : Number(cycle.receivedAmount);
      feedSheet.getRange(targetRow, 4).setValue(recVal);

      const envNames = feedSheet.getRange(7, 8, 1, 23).getValues()[0];
      const rowAllocations = envNames.map(name => {
        const cleanName = String(name || '').trim();
        const val = cycle.allocations ? cycle.allocations[cleanName] : '';
        return (val === '' || val === null || val === undefined) ? '' : Number(val);
      });
      feedSheet.getRange(targetRow, 8, 1, 23).setValues([rowAllocations]);
    }

    SpreadsheetApp.flush();
    return createJsonResponse(readAllBudgetData());
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
