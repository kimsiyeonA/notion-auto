import { Client } from "@notionhq/client";
import { google } from "googleapis"; 

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

  function getRollupDate(prop) {
    if (!prop?.rollup) return null;
  
    // case 1: rollup → date (가장 많은 케이스)
    if (prop.rollup.type === "date") {
      return prop.rollup.date?.start || null;
    }
  
    // case 2: rollup → array
    if (prop.rollup.array?.length > 0) {
      return prop.rollup.array[0]?.date?.start || null;
    }
  
    // case 3: rollup → results
    if (prop.rollup.results?.length > 0) {
      return prop.rollup.results[0]?.date?.start || null;
    }

    return null;
  }

  for (const page of response.results) {
  
    const title =
      page.properties["강의제목"]?.title?.[0]?.plain_text || "제목 없음";
  
    const start = getRollupDate(page.properties["최초 수강일"]);
    const end = getRollupDate(page.properties["최종 수강일"]);
  
    if (!start) {
      console.log(`❌ 날짜 없음 → 건너뜀: ${title}`);
      continue;
    }

  const eventEnd = end || start;   // end 없으면 하루짜리로 처리

  console.log(`✔️ 등록: ${title} (${start} ~ ${eventEnd})`);

  const eventStart = start.split("T")[0];
  const eventEndDate = (end || start).split("T")[0];
  
  const startDate = new Date(eventStart);
  const endDate = new Date(eventEndDate);
  endDate.setDate(endDate.getDate() + 1); // timeMax는 exclusive
  
  const existingEvents = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  
  const alreadyExists = existingEvents.data.items.some(
    (event) => event.summary === title
  );
  
  if (alreadyExists) {
    console.log(`⚠️ 이미 등록됨: ${title}`);
    continue;
  }
  
  // 등록
  await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: title,
      start: { date: eventStart },
      end: { date: eventEndDate },
    },
  });
}

  console.log("🎉 완료! Google Calendar 업데이트됨");
}
main().catch(err => {
  console.error("🔥 오류 발생", err);
  process.exit(1);
});


