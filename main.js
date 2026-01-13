import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// ⚠️ 여기에 네 DB ID 넣기
const DATABASE_ID = "2cb362898815808fb014c749751e6342?v=2cb362898815802bba3c000c2a3839a4";

async function main() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID
  });

  console.log("총 가져온 개수:", response.results.length);

  response.results.forEach(page => {
    console.log("페이지 제목:",
      page.properties["Name"]?.title?.[0]?.plain_text
    );
  });
}

main();

