import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// notion DB ID 
const DATABASE_ID = process.env.NOTION_DB_ID;
// google calender ID
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// Google Service Account 인증
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const jwtClient = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ["https://www.googleapis.com/auth/calendar"]
);

const calendar = google.calendar({ version: "v3", auth: jwtClient });

async function main() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID
  });

  console.log("📌 Notion 데이터 개수:", response.results.length);

  for (const page of response.results) {
    const title =
      page.properties["강의제목"]?.title?.[0]?.plain_text || "제목 없음";

    // 🔹 Rollup 구조 대응 (array / results 자동 처리)
    const start =
      page.properties["최초 수강일"]?.rollup?.array?.[0]?.date?.start ||
      page.properties["최초 수강일"]?.rollup?.results?.[0]?.date?.start ||
      null;

    const end =
      page.properties["최종 수강일"]?.rollup?.array?.[0]?.date?.end ||
      page.properties["최종 수강일"]?.rollup?.results?.[0]?.date?.end ||
      null;

    if (!start || !end) {
      console.log(`❌ 날짜 없음 → 건너뜀: ${title}`);
      continue;
    }

    console.log(`✔️ 등록: ${title} (${start} ~ ${end})`);

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: title,
        start: { date: start },
        end: { date: end },
      }
    });
  }

  console.log("🎉 완료! Google Calendar 업데이트됨");
}

main().catch(err => {
  console.error("🔥 오류 발생", err);
  process.exit(1);
});


