import { Client } from "@notionhq/client";
import { google } from "googleapis"; 

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// Notion DB ID
const DATABASE_ID = process.env.NOTION_DB_ID;
// Google Calendar ID
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

    if (prop.rollup.type === "date") return prop.rollup.date?.start || null;
    if (prop.rollup.array?.length > 0) return prop.rollup.array[0]?.date?.start || null;
    if (prop.rollup.results?.length > 0) return prop.rollup.results[0]?.date?.start || null;

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

    const eventStart = start.split("T")[0];
    const eventEndDate = (end || start).split("T")[0];

    const startDate = new Date(eventStart);
    const endDate = new Date(eventEndDate);
    endDate.setDate(endDate.getDate() + 1); // timeMax는 exclusive

    // Notion에 저장된 기존 Event ID 가져오기
    const existingEventId = page.properties["Calendar Event ID"]?.rich_text?.[0]?.plain_text;

    let needCreate = true; // 새 이벤트 생성 여부

    if (existingEventId) {
      try {
        // 기존 이벤트 가져오기
        const existingEvent = await calendar.events.get({
          calendarId: CALENDAR_ID,
          eventId: existingEventId,
        });

        // 기존 이벤트 end date 확인
        const existingEnd = existingEvent.data.end?.date || existingEvent.data.end?.dateTime;
        if (existingEnd === eventEndDate) {
          console.log(`⚠️ 변경 없음 → 건너뜀: ${title}`);
          needCreate = false; // 변경 없으면 건너뜀
        } else {
          // 변경 있으면 삭제
          await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId: existingEventId,
          });
          console.log(`🗑 기존 이벤트 삭제됨: ${title}`);
        }
      } catch (err) {
        console.log(`⚠️ 기존 이벤트 조회 실패, 새로 생성: ${title}`);
      }
    }

    if (needCreate) {
      // 새 이벤트 생성
      const newEvent = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary: title,
          start: { date: eventStart },
          end: { date: eventEndDate },
        },
      });

      // Notion에 새 Event ID 저장
      await notion.pages.update({
        page_id: page.id,
        properties: {
          "Calendar Event ID": {
            rich_text: [{ text: { content: newEvent.data.id } }]
          }
        }
      });

      console.log(`✔️ 등록 완료: ${title} (${eventStart} ~ ${eventEndDate})`);
    }
  }

  console.log("🎉 완료! Google Calendar 업데이트됨");
}

main().catch(err => {
  console.error("🔥 오류 발생", err);
  process.exit(1);
});
