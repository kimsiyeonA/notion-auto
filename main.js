import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// DB IDs
const LECTURE_DB_ID = process.env.LECTURE_DB_ID;   // A 강의 DB
const CALENDAR_DB_ID = process.env.CALENDAR_DB_ID; // C 캘린더 DB
console.log("LECTURE_DB_ID:", process.env.LECTURE_DB_ID);
console.log("CALENDAR_DB_ID:", process.env.CALENDAR_DB_ID);

function getRollupDate(prop) {
  if (!prop?.rollup) return null;

  if (prop.rollup.type === "date")
    return prop.rollup.date?.start || null;

  if (prop.rollup.array?.length > 0)
    return prop.rollup.array[0]?.date?.start || null;

  if (prop.rollup.results?.length > 0)
    return prop.rollup.results[0]?.date?.start || null;

  return null;
}

async function main() {
  const response = await notion.databases.query({
    database_id: LECTURE_DB_ID
  });

  console.log("📌 강의 개수:", response.results.length);

  for (const page of response.results) {
    const title =
      page.properties["강의제목"]?.title?.[0]?.plain_text || "제목 없음";

    const start = getRollupDate(page.properties["최초 수강일"]);
    const end = getRollupDate(page.properties["최종 수강일"]);

    if (!start) {
      console.log(`❌ 날짜 없음 → 건너뜀: ${title}`);
      continue;
    }

    const startDate = start.split("T")[0];
    const endDate = (end || start).split("T")[0];

    // 🔍 기존 캘린더 페이지 조회 (A page.id 기준)
    const existing = await notion.databases.query({
      database_id: CALENDAR_DB_ID,
      filter: {
        property: "강의 목록 DB 연결 ID",
        rich_text: {
          equals: page.id
        }
      }
    });

    if (existing.results.length > 0) {
      const calendarPage = existing.results[0];
      const props = calendarPage.properties;

      const existingStart = props["시작일"]?.date?.start;
      const existingEnd = props["종료일"]?.date?.start;

      // 변경 없으면 skip
      if (existingStart === startDate && existingEnd === endDate) {
        console.log(`⚠️ 변경 없음 → 건너뜀: ${title}`);
        continue;
      }

      // 🔄 업데이트
      await notion.pages.update({
        page_id: calendarPage.id,
        properties: {
          시작일: { date: { start: startDate } },
          종료일: { date: { start: endDate } }
        }
      });

      console.log(`🔄 캘린더 업데이트: ${title}`);
    } else {
      // 🆕 새 캘린더 페이지 생성
      await notion.pages.create({
        parent: { database_id: CALENDAR_DB_ID },
        properties: {
          이름: {
            rich_text: [{ text: { content: title } }]
          },
          시작일: {
            date: { start: startDate }
          },
          종료일: {
            date: { start: endDate }
          },
          "강의 목록 DB 연결 ID": {
            rich_text: [{ text: { content: page.id } }]
          },
          "강의 목록": {
            relation: [{ id: page.id }]
          }
        }
      });

      console.log(`✔️ 캘린더 생성: ${title}`);
    }
  }

  console.log("🎉 노션 캘린더 동기화 완료");
}

main().catch(err => {
  console.error("🔥 오류 발생", err);
  process.exit(1);
});




// notion  <-> google calendar connect
// import { Client } from "@notionhq/client";
// import { google } from "googleapis"; 

// const notion = new Client({
//   auth: process.env.NOTION_TOKEN
// });

// // Notion DB ID
// const DATABASE_ID = process.env.NOTION_DB_ID;
// // Google Calendar ID
// const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// // Google Service Account 인증
// const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

// const jwtClient = new google.auth.JWT(
//   credentials.client_email,
//   null,
//   credentials.private_key,
//   ["https://www.googleapis.com/auth/calendar"]
// );

// const calendar = google.calendar({ version: "v3", auth: jwtClient });

// async function main() {
//   const response = await notion.databases.query({
//     database_id: DATABASE_ID
//   });

//   console.log("📌 Notion 데이터 개수:", response.results.length);

//   function getRollupDate(prop) {
//     if (!prop?.rollup) return null;

//     if (prop.rollup.type === "date") return prop.rollup.date?.start || null;
//     if (prop.rollup.array?.length > 0) return prop.rollup.array[0]?.date?.start || null;
//     if (prop.rollup.results?.length > 0) return prop.rollup.results[0]?.date?.start || null;

//     return null;
//   }

//   for (const page of response.results) {
//     const title =
//       page.properties["강의제목"]?.title?.[0]?.plain_text || "제목 없음";

//     const start = getRollupDate(page.properties["최초 수강일"]);
//     const end = getRollupDate(page.properties["최종 수강일"]);

//     if (!start) {
//       console.log(`❌ 날짜 없음 → 건너뜀: ${title}`);
//       continue;
//     }

//     const eventStart = start.split("T")[0];
//     const eventEndDate = (end || start).split("T")[0];

//     const startDate = new Date(eventStart);
//     const endDate = new Date(eventEndDate);
//     endDate.setDate(endDate.getDate() + 1); // timeMax exclusive

//     // Notion Text 속성으로 기존 Event ID 가져오기
//     const existingEventId = page.properties["Calendar Event ID"]?.rich_text?.[0]?.text?.content || null;

//     if (!existingEventId) {
//       console.log(`⚠️ "Calendar Event ID" 속성 없음 → 기존 이벤트 건너뜀: ${title}`);
//     }

//     let needCreate = true;

//     if (existingEventId) {
//       try {
//         const existingEvent = await calendar.events.get({
//           calendarId: CALENDAR_ID,
//           eventId: existingEventId,
//         });

//         const existingEnd = existingEvent.data.end?.date || existingEvent.data.end?.dateTime;

//         if (existingEnd === eventEndDate) {
//           console.log(`⚠️ 변경 없음 → 건너뜀: ${title}`);
//           needCreate = false;
//         } else {
//           await calendar.events.delete({
//             calendarId: CALENDAR_ID,
//             eventId: existingEventId,
//           });
//           console.log(`🗑 기존 이벤트 삭제됨: ${title}`);
//         }
//       } catch (err) {
//         console.log(`⚠️ 기존 이벤트 조회 실패, 새로 생성: ${title}`);
//       }
//     }

//     if (needCreate) {
//       const newEvent = await calendar.events.insert({
//         calendarId: CALENDAR_ID,
//         requestBody: {
//           summary: title,
//           start: { date: eventStart },
//           end: { date: eventEndDate },
//         },
//       });

//       // Notion Text 속성에 새 Event ID 기록
//       try {
//         if (page.properties["Calendar Event ID"]) {
//           await notion.pages.update({
//             page_id: page.id,
//             properties: {
//               "Calendar Event ID": {
//                 rich_text: [
//                   { text: { content: newEvent.data.id } }
//                 ]
//               }
//             }
//           });
//         }
//       } catch (err) {
//         console.log(`⚠️ Notion 업데이트 실패: ${title}`, err.message);
//       }

//       console.log(`✔️ 등록 완료: ${title} (${eventStart} ~ ${eventEndDate})`);
//     }
//   }

//   console.log("🎉 완료! Google Calendar 업데이트됨");
// }

// main().catch(err => {
//   console.error("🔥 오류 발생", err);
//   process.exit(1);
// });
