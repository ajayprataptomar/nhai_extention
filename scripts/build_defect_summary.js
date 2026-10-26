/**
 * PROJECT-WISE WEEKLY DEFECT REPORT & SUMMARY AUTOMATION
 * Native Google Apps Script Version (Handles Drive-stored .xlsx & Google Sheets)
 */

const CFG = {
  INDEX: "Defect Index",
  PREFIX: "Defect -",
  SURVEY: "Survey form",
  ACTIVITY: "Activity log",
  HEADER_ROW_LIMIT: 20
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Defect Automation")
    .addItem("📊 Build Defect Summary (All Projects)", "buildDefectSummary")
    .addToUi();
}

function buildDefectSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getActiveSheet();

  if (master.getName() === CFG.INDEX ||
      master.getName().startsWith(CFG.PREFIX)) {
    throw new Error("Pehle original master sheet select karo.");
  }

  const range = master.getDataRange();
  const values = range.getDisplayValues();
  const formulas = range.getFormulas();
  const rich = range.getRichTextValues();

  const headers = findHeaders_(values);
  if (!headers) {
    throw new Error(
      "UPC Code aur Assessed Report Link headers nahi mile."
    );
  }

  const { row: headerRow, col } = headers;
  const projects = new Map();
  const issues = [];
  let linksFound = 0;
  let reportsProcessed = 0;

  for (let r = headerRow + 1; r < values.length; r++) {
    const row = values[r];

    const url = getUrl_(
      row[col.link],
      formulas[r][col.link],
      rich[r][col.link]
    );

    if (!url) continue;
    linksFound++;

    const masterUPC = clean_(row[col.upc]);
    const masterProject = clean_(row[col.project]);
    const masterPIU = clean_(row[col.piu]);
    const masterWeek = parseWeek_(row[col.week]);
    const masterSurveyId = clean_(row[col.surveyId]);

    try {
      const report = SpreadsheetApp.openById(getId_(url));
      const survey = getSheet_(report, CFG.SURVEY);
      const activity = getSheet_(report, CFG.ACTIVITY);

      if (!survey || !activity) {
        throw new Error(
          "Survey form ya Activity log sheet nahi mili."
        );
      }

      const meta = readSurvey_(survey);
      const week = meta.cycle || masterWeek;
      const upc = meta.upc || masterUPC;

      if (!week || week < 1) {
        throw new Error("Survey week identify nahi hua.");
      }

      if (!upc) {
        throw new Error("UPC Code missing hai.");
      }

      if (meta.cycle && masterWeek &&
          meta.cycle !== masterWeek) {
        issues.push([
          r + 1, url, upc, week,
          "Master week aur Survey Cycle alag hain."
        ]);
      }

      if (masterUPC && meta.upc &&
          norm_(masterUPC) !== norm_(meta.upc)) {
        issues.push([
          r + 1, url, masterUPC, week,
          "UPC mismatch: Survey form mein " + meta.upc
        ]);
      }

      if (masterSurveyId && meta.surveyId &&
          masterSurveyId !== meta.surveyId) {
        issues.push([
          r + 1, url, upc, week,
          "Survey ID mismatch."
        ]);
      }

      const key = norm_(upc);

      if (!projects.has(key)) {
        projects.set(key, {
          upc,
          name: meta.project || masterProject || upc,
          nh: meta.nh,
          state: meta.state,
          ro: meta.ro,
          piu: meta.piu || masterPIU,
          ae: meta.ae,
          contractor: meta.contractor,
          das: meta.das,
          cycles: {},
          duplicates: []
        });
      }

      const p = projects.get(key);

      p.name = meta.project || p.name;
      p.nh = meta.nh || p.nh;
      p.state = meta.state || p.state;
      p.ro = meta.ro || p.ro;
      p.piu = meta.piu || p.piu || masterPIU;
      p.ae = meta.ae || p.ae;
      p.contractor = meta.contractor || p.contractor;
      p.das = meta.das || p.das;

      const defects = readActivity_(activity);

      if (p.cycles[week]) {
        p.duplicates.push(week);
        issues.push([
          r + 1, url, upc, week,
          "Duplicate project-week link; last valid report used."
        ]);
      }

      p.cycles[week] = {
        defects,
        surveyId: meta.surveyId || masterSurveyId,
        url
      };

      reportsProcessed++;

    } catch (e) {
      issues.push([
        r + 1, url, masterUPC, masterWeek || "",
        String(e.message || e)
      ]);
    }
  }

  if (!linksFound) {
    throw new Error(
      "Assessed Report Link column mein koi valid link nahi mila."
    );
  }

  const indexRows = [];

  for (const p of projects.values()) {
    const name = projectName_(p.upc);
    let sh = ss.getSheetByName(name);

    if (!sh) sh = ss.insertSheet(name);

    const result = writeProject_(sh, p);
    const weeks = Object.keys(p.cycles)
      .map(Number).sort((a, b) => a - b);
    const maxWeek = weeks.length ? Math.max(...weeks) : 0;
    const missing = [];

    for (let w = 1; w <= maxWeek; w++) {
      if (!p.cycles[w]) missing.push("W" + w);
    }

    indexRows.push([
      p.name,
      p.upc,
      p.piu || "",
      weeks.map(w => "W" + w).join(", "),
      missing.join(", "),
      result.total,
      name,
      [...new Set(p.duplicates)].map(w => "W" + w).join(", "),
      maxWeek
    ]);
  }

  writeIndex_(ss, master.getName(), indexRows, issues);
  ss.setActiveSheet(ss.getSheetByName(CFG.INDEX));

  SpreadsheetApp.getUi().alert(
    "Report updated successfully!\n\n" +
    "Links found: " + linksFound + "\n" +
    "Reports processed: " + reportsProcessed + "\n" +
    "Projects: " + projects.size + "\n" +
    "Issues: " + issues.length + "\n\n" +
    "Defect Index sheet check karo."
  );
}

function findHeaders_(values) {
  const aliases = {
    upc: ["upc code"],
    project: ["project name"],
    piu: ["piu name"],
    week: ["survey week"],
    surveyId: ["survey id"],
    link: ["assessed report link"]
  };

  for (let r = 0; r < Math.min(values.length, CFG.HEADER_ROW_LIMIT); r++) {
    const h = values[r].map(header_);
    const col = {};

    for (const [key, names] of Object.entries(aliases)) {
      col[key] = h.findIndex(x => names.includes(x));
    }

    if (col.upc >= 0 && col.link >= 0) {
      return { row: r, col };
    }
  }
  return null;
}

function header_(v) {
  return clean_(v).toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function clean_(v) {
  return String(v == null ? "" : v)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ").trim();
}

function norm_(v) {
  return clean_(v).toUpperCase();
}

function parseWeek_(v) {
  const s = clean_(v);
  if (/^\d+$/.test(s)) return Number(s) || null;

  const m = s.match(
    /(?:weekly[\s_-]*)?cycle[\s_-]*(\d+)|week[\s_-]*(\d+)/i
  );
  return m ? Number(m[1] || m[2]) : null;
}

function getUrl_(display, formula, rich) {
  if (rich) {
    if (rich.getLinkUrl()) return rich.getLinkUrl();
    for (const run of rich.getRuns()) {
      if (run.getLinkUrl()) return run.getLinkUrl();
    }
  }

  const m = String(formula || "").match(
    /HYPERLINK\s*\(\s*["'](https?:\/\/[^"']+)["']/i
  );
  if (m) return m[1];

  const text = String(display || "").trim();
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(text)
    ? text : "";
}

function getId_(url) {
  const m = String(url).match(
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  );
  if (!m) throw new Error("Invalid Google Sheets link.");
  return m[1];
}

function getSheet_(ss, name) {
  return ss.getSheets().find(
    s => s.getName().trim().toLowerCase() === name.toLowerCase()
  ) || null;
}

function readSurvey_(sheet) {
  const data = sheet.getDataRange().getDisplayValues();

  const meta = {
    project: "", upc: "", nh: "", state: "", ro: "",
    piu: "", ae: "", contractor: "", das: "",
    cycle: null, startDate: "", endDate: "", surveyId: ""
  };

  function labelValue(label) {
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        const cell = clean_(data[r][c]);

        if (!cell.toLowerCase().startsWith(label.toLowerCase())) {
          continue;
        }

        const i = cell.indexOf(":");
        if (i >= 0 && clean_(cell.slice(i + 1))) {
          return clean_(cell.slice(i + 1));
        }

        for (let k = c + 1; k < data[r].length; k++) {
          const v = clean_(data[r][k]);
          if (v && v.toLowerCase() !== "details") return v;
        }
      }
    }
    return "";
  }

  const cycle = labelValue("Survey Cycle").match(
    /(?:weekly[\s_-]*)?cycle[\s_-]*(\d+)/i
  );
  if (cycle) meta.cycle = Number(cycle[1]);

  meta.surveyId = labelValue("Survey ID");
  meta.startDate = labelValue("Survey Start Date");
  meta.endDate = labelValue("Survey End Date");

  const labels = {
    "Project Name": "project",
    "NH Number": "nh",
    "UPC Code": "upc",
    "Name of State": "state",
    "RO Name": "ro",
    "PIU Name": "piu",
    "AE/IE/SC Name": "ae",
    "Contractor/ O&M Agency": "contractor",
    "DAS Agency": "das"
  };

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const label = clean_(data[r][c]).toLowerCase();

      for (const [expected, key] of Object.entries(labels)) {
        if (label !== expected.toLowerCase()) continue;

        for (let k = c + 1; k < data[r].length; k++) {
          const value = clean_(data[r][k]);

          if (value &&
              value.toLowerCase() !== "details" &&
              value.toLowerCase() !== "particular") {
            meta[key] = value;
            break;
          }
        }
      }
    }
  }
  return meta;
}

function readActivity_(sheet) {
  const data = sheet.getDataRange().getDisplayValues();
  let headerRow = -1, defectCol = -1, countCol = -1;

  for (let r = 0; r < data.length; r++) {
    const h = data[r].map(header_);
    defectCol = h.indexOf("defect type");
    countCol = h.indexOf("total defects");

    if (defectCol >= 0 && countCol >= 0) {
      headerRow = r;
      break;
    }
  }

  if (headerRow < 0) {
    throw new Error("Activity log defect headers not found.");
  }

  const defects = {};

  for (let r = headerRow + 1; r < data.length; r++) {
    const name = clean_(data[r][defectCol]);
    const raw = clean_(data[r][countCol]).replace(/,/g, "");

    if (!name || /^total$/i.test(name)) continue;
    if (!/^-?\d+(?:\.\d+)?$/.test(raw)) continue;

    defects[name] = (defects[name] || 0) + Number(raw);
  }
  return defects;
}

function projectName_(upc) {
  return (CFG.PREFIX + " " + upc)
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ").trim().substring(0, 99);
}

function writeProject_(sheet, p) {
  sheet.getDataRange().getMergedRanges().forEach(
    r => r.breakApart()
  );
  sheet.clear();

  const sortedWeeks = weeks.filter(n => Number.isFinite(n) && !!p.cycles[n]).sort((a, b) => a - b);
  let deltaHeader = "Previous Week - Current Week";
  let canCompareWeeks = false;
  let prevW = null;
  let currW = null;

  if (sortedWeeks.length >= 2) {
    currW = sortedWeeks[sortedWeeks.length - 1];
    prevW = sortedWeeks[sortedWeeks.length - 2];
    deltaHeader = "Week " + prevW + " - Week " + currW;
    canCompareWeeks = true;
  }

  const cols = maxWeek + 4;

  const defectSet = new Set();
  Object.values(p.cycles).forEach(c =>
    Object.keys(c.defects).forEach(d => defectSet.add(d))
  );
  const defectNames = [...defectSet].sort((a, b) =>
    a.localeCompare(b)
  );

  sheet.getRange(1, 1, 1, cols).merge()
    .setValue("WEEKLY DEFECT SUMMARY REPORT")
    .setFontWeight("bold").setFontSize(14)
    .setHorizontalAlignment("center");

  sheet.getRange("A2:B10").setValues([
    ["Project Name", p.name],
    ["UPC Code", p.upc],
    ["NH Number", p.nh || ""],
    ["State", p.state || ""],
    ["RO Name", p.ro || ""],
    ["PIU Name", p.piu || ""],
    ["AE/IE/SC Name", p.ae || ""],
    ["Contractor / O&M Agency", p.contractor || ""],
    ["DAS Agency", p.das || ""]
  ]);
  sheet.getRange("A2:A10").setFontWeight("bold");

  const headers = [
    "S. No.", "Defect Type",
    ...Array.from({ length: maxWeek }, (_, i) => "Week " + (i + 1)),
    "Grand Total",
    deltaHeader
  ];
  const headerRow = 11, dataRow = 12;

  sheet.getRange(headerRow, 1, 1, cols)
    .setValues([headers]).setFontWeight("bold").setWrap(true);

  const weekTotals = Array(maxWeek).fill(0);
  let grandTotal = 0;

  const rows = defectNames.map((defect, i) => {
    const row = [i + 1, defect];
    let sum = 0;

    for (let w = 1; w <= maxWeek; w++) {
      const exists = Boolean(p.cycles[w]);
      const count = exists ? (p.cycles[w].defects[defect] || 0) : "";
      row.push(count);

      if (exists) {
        sum += Number(count) || 0;
        weekTotals[w - 1] += Number(count) || 0;
      }
    }
    grandTotal += sum;
    row.push(sum);
    const rowIdx = dataRow + i;
    if (canCompareWeeks) {
      const prevCol = colToLetter(prevW + 2);
      const currCol = colToLetter(currW + 2);
      row.push("=N(" + prevCol + rowIdx + ")-N(" + currCol + rowIdx + ")");
    } else {
      row.push("");
    }
    return row;
  });

  if (rows.length) {
    sheet.getRange(dataRow, 1, rows.length, cols).setValues(rows);
  }

  const totalRow = dataRow + rows.length;
  sheet.getRange(totalRow, 1, 1, cols).setValues([[
    "", "TOTAL DEFECTS",
    ...weekTotals.map((n, i) => p.cycles[i + 1] ? n : ""),
    grandTotal,
    canCompareWeeks
      ? "=N(" + colToLetter(prevW + 2) + totalRow + ")-N(" + colToLetter(currW + 2) + totalRow + ")"
      : ""
  ]]).setFontWeight("bold");

  sheet.setFrozenRows(headerRow);
  sheet.setFrozenColumns(2);
  sheet.setColumnWidth(1, 48);
  sheet.setColumnWidth(2, 280);
  if (maxWeek) sheet.setColumnWidths(3, maxWeek, 72);
  sheet.setColumnWidth(cols - 1, 100);
  sheet.setColumnWidth(cols, 155);
  sheet.setRowHeight(headerRow, 38);

  sheet.getDataRange().setVerticalAlignment("middle").setWrap(true);
  sheet.getRange(
    headerRow, 1, rows.length + 2, cols
  ).setBorder(true, true, true, true, true, true);

  return { total: grandTotal };
}

function writeIndex_(ss, sourceName, rows, issues) {
  let sh = ss.getSheetByName(CFG.INDEX);
  if (!sh) sh = ss.insertSheet(CFG.INDEX);

  sh.getDataRange().getMergedRanges().forEach(
    r => r.breakApart()
  );
  sh.clear();

  sh.getRange("A1:I1").merge()
    .setValue("PROJECT-WISE WEEKLY DEFECT INDEX")
    .setFontWeight("bold").setFontSize(14);

  sh.getRange("A2:B3").setValues([
    ["Source Master Sheet", sourceName],
    ["Last Updated", new Date()]
  ]);

  const headers = [
    "Project Name", "UPC Code", "PIU Name",
    "Weeks Found", "Missing Weeks", "Total Defects",
    "Report Sheet", "Duplicate Weeks", "Latest Week"
  ];

  sh.getRange(5, 1, 1, headers.length)
    .setValues([headers]).setFontWeight("bold").setWrap(true);

  if (rows.length) {
    sh.getRange(6, 1, rows.length, 9).setValues(rows);

    rows.forEach((row, i) => {
      const target = ss.getSheetByName(row[6]);
      if (!target) return;

      sh.getRange(6 + i, 7).setRichTextValue(
        SpreadsheetApp.newRichTextValue()
          .setText(row[6])
          .setLinkUrl(ss.getUrl() + "#gid=" + target.getSheetId())
          .build()
      );
    });
  }

  const issueRow = Math.max(rows.length + 9, 10);
  sh.getRange(issueRow, 1, 1, 5).setValues([[
    "SOURCE ISSUES", "Source URL", "UPC Code", "Week", "Issue"
  ]]).setFontWeight("bold");

  if (issues.length) {
    sh.getRange(issueRow + 1, 1, issues.length, 5).setValues(issues);
  }

  sh.setFrozenRows(5);
  sh.getDataRange().setWrap(true).setVerticalAlignment("middle");
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 220);
  sh.setColumnWidth(5, 240);
  sh.setColumnWidth(6, 120);
  sh.setColumnWidth(7, 220);
  sh.setColumnWidth(8, 150);
  sh.setColumnWidth(9, 100);
}
