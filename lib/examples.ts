export type CallExample = {
  /** Business being called. */
  business: string;
  /** City or neighborhood, as it would read on the call screen. */
  place: string;
  /** Language spoken on the line. */
  language: string;
  /** BCP-47 tag, so the browser picks the right font for the script. */
  lang: string;
  /** What Yappr says on the line. */
  original: string;
  /** The same line in the reader's language. */
  translation: string;
};

/**
 * The example calls that rotate through the homepage postcard. Keep them
 * ordinary — a table, a pickup, an appointment — and spread across languages,
 * since the point is to show that this works wherever the reader is going.
 */
export const callExamples: CallExample[] = [
  {
    business: "Baan Suan",
    place: "Bangkok",
    language: "Thai",
    lang: "th",
    original: "มีโต๊ะสำหรับสองท่าน เวลา 19:00 ค่ะ ติดหน้าต่างได้ไหมคะ",
    translation: "Table for two at 7:00pm. Is a window seat possible?",
  },
  {
    business: "Ryokan Aoi",
    place: "Kyoto",
    language: "Japanese",
    lang: "ja",
    original: "本日22時頃のチェックインは可能でしょうか。二名で予約しております。",
    translation: "Could we check in around 10pm tonight? The booking is for two.",
  },
  {
    business: "Farmacia Triana",
    place: "Seville",
    language: "Spanish",
    lang: "es",
    original: "¿Tienen algo para las picaduras de mosquito sin receta? Pasaría a recogerlo esta tarde.",
    translation:
      "Do you have anything for mosquito bites without a prescription? I'd come by this afternoon.",
  },
  {
    business: "Nhà May Sen",
    place: "Hội An",
    language: "Vietnamese",
    lang: "vi",
    original: "Áo của tôi may xong chưa ạ? Tôi muốn đến lấy trước 6 giờ chiều nay.",
    translation: "Is my shirt finished? I'd like to collect it before 6pm today.",
  },
  {
    business: "Studio Dentistico Rossi",
    place: "Bologna",
    language: "Italian",
    lang: "it",
    original: "Avete un appuntamento libero domani mattina? Ho un dente che mi fa male.",
    translation: "Do you have an appointment free tomorrow morning? I have a tooth that hurts.",
  },
  {
    business: "Sewa Motor Ubud",
    place: "Bali",
    language: "Indonesian",
    lang: "id",
    original: "Apakah masih ada motor matic untuk tiga hari mulai besok?",
    translation: "Do you still have an automatic scooter for three days from tomorrow?",
  },
  {
    business: "Taxi Naxos",
    place: "Naxos",
    language: "Greek",
    lang: "el",
    original: "Μπορείτε να στείλετε ένα ταξί στο λιμάνι στις εφτά το πρωί;",
    translation: "Could you send a taxi to the port at seven in the morning?",
  },
  {
    business: "Mirae Clinic",
    place: "Seoul",
    language: "Korean",
    lang: "ko",
    original: "오늘 오후에 진료 가능한가요? 목이 많이 아파서요.",
    translation: "Could I be seen this afternoon? My throat is very sore.",
  },
];
