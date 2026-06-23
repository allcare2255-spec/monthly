const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_VALUE = Buffer.from(JSON.stringify({ role: "admin" })).toString("base64");
const OUT_DIR = "C:\\Users\\PC\\AppData\\Local\\Temp\\claude\\C--Users-PC-Desktop-high-dashboard\\f57e6433-91fa-4cc3-a427-b54295f4f9dd\\scratchpad";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  await context.addCookies([{
    name: "coaching_session",
    value: SESSION_VALUE,
    domain: "localhost",
    path: "/",
  }]);

  const page = await context.newPage();

  // Step 1: /admin 에서 학생 목록
  console.log("[1] /admin 접속...");
  await page.goto("http://localhost:3002/admin", { waitUntil: "networkidle", timeout: 15000 });
  await page.screenshot({ path: path.join(OUT_DIR, "01-admin.png") });

  const studentLinks = await page.$$eval('a[href*="/mentor/students/"]', els =>
    els.map(el => el.getAttribute('href')).filter(h => h && !h.includes('undefined'))
  );
  console.log("[1] 학생 링크:", studentLinks.slice(0, 5));

  if (!studentLinks.length) {
    // /admin/students 시도
    await page.goto("http://localhost:3002/admin/students", { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, "01b-admin-students.png") });
    const links2 = await page.$$eval('a[href*="/mentor/students/"]', els =>
      els.map(el => el.getAttribute('href')).filter(Boolean)
    );
    console.log("[1b] 학생 링크:", links2.slice(0, 5));
    if (!links2.length) {
      console.error("[!] 학생 없음. 현재 URL:", page.url());
      console.error("[!] 페이지 텍스트 일부:", (await page.content()).slice(0, 500));
      await browser.close();
      return;
    }
    studentLinks.push(...links2);
  }

  const firstHref = studentLinks[0];
  const m = firstHref.match(/\/mentor\/students\/([^\/\?]+)/);
  if (!m) { console.error("[!] ID 파싱 실패:", firstHref); await browser.close(); return; }
  const studentId = m[1];
  console.log("[1] 학생 ID:", studentId);

  // Step 2: 계획표 페이지
  const planUrl = `http://localhost:3002/mentor/students/${studentId}/plan?cycle=1&week=1`;
  console.log("[2] 계획표:", planUrl);
  await page.goto(planUrl, { waitUntil: "networkidle", timeout: 20000 });
  await page.screenshot({ path: path.join(OUT_DIR, "02-plan-page.png"), fullPage: true });

  const h1Text = await page.$eval('h1', el => el.textContent).catch(() => "없음");
  console.log("[2] h1:", h1Text);

  // 날짜 span 색상 확인 (whitespace-nowrap)
  const dateSpanInfo = await page.$$eval('span.whitespace-nowrap', els =>
    els.slice(0, 7).map(el => ({
      text: el.textContent?.trim(),
      color: window.getComputedStyle(el).color,
    }))
  );
  console.log("[2] 날짜 span 색상:");
  dateSpanInfo.forEach(s => console.log(`  "${s.text}" → color: ${s.color}`));

  // Step 3: PNG 다운로드
  const sendBtn = page.getByText("학생에게 보내기");
  const btnCount = await sendBtn.count();
  console.log("[3] 버튼 개수:", btnCount);
  if (!btnCount) {
    console.error("[!] 버튼 없음");
    await browser.close();
    return;
  }

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await sendBtn.click();
  console.log("[3] 클릭 완료, 다운로드 대기...");

  const download = await downloadPromise;
  const fname = download.suggestedFilename();
  const savePath = path.join(OUT_DIR, fname);
  await download.saveAs(savePath);

  const stat = fs.statSync(savePath);
  console.log("[3] 파일명:", fname);
  console.log("[3] 크기:", stat.size, "bytes");
  console.log("[3] 저장:", savePath);

  await browser.close();
  console.log("\n=== 완료 ===");
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
