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
 * The example calls that rotate through the homepage postcard.
 *
 * Two rules for anything added here. The destination should be somewhere an
 * ordinary European holiday actually goes, not somewhere that sounds
 * adventurous, and the errand should be one a traveler would genuinely put off
 * making themselves: a late arrival, a pharmacy, a lost jacket, a doctor for a
 * child, a taxi at five in the morning. A visitor should read one and think
 * "that happened to me", not "how exotic".
 */
export const callExamples: CallExample[] = [
  {
    business: "Apartamentos Alfama",
    place: "Lisbon",
    language: "Portuguese",
    lang: "pt",
    original: "Boa tarde, chegamos hoje por volta das 23h30. Como podemos levantar a chave?",
    translation: "Good afternoon, we arrive today around 11:30pm. How do we pick up the key?",
  },
  {
    business: "Farmàcia Gràcia",
    place: "Barcelona",
    language: "Spanish",
    lang: "es",
    original:
      "Buenos días, ¿tienen algo para las quemaduras del sol sin receta? Pasaríamos a buscarlo esta tarde.",
    translation:
      "Good morning, do you have anything for sunburn without a prescription? We would come by this afternoon.",
  },
  {
    business: "Le Petit Marché",
    place: "Paris",
    language: "French",
    lang: "fr",
    original: "Bonjour, auriez-vous une table pour quatre ce soir à 20h ? Une personne est végétarienne.",
    translation: "Hello, would you have a table for four tonight at 8pm? One of us is vegetarian.",
  },
  {
    business: "Trattoria da Enzo",
    place: "Rome",
    language: "Italian",
    lang: "it",
    original: "Buongiorno, ieri sera ho dimenticato una giacca da voi. È stata trovata per caso?",
    translation: "Good morning, I left a jacket at your place last night. Has anyone found it?",
  },
  {
    business: "Taxi Chania",
    place: "Crete",
    language: "Greek",
    lang: "el",
    original: "Καλησπέρα, μπορείτε να στείλετε ένα ταξί αύριο στις 5 το πρωί για το αεροδρόμιο;",
    translation: "Good evening, could you send a taxi tomorrow at 5am to the airport?",
  },
  {
    business: "Özel Sağlık Poliklinik",
    place: "Antalya",
    language: "Turkish",
    lang: "tr",
    original: "Merhaba, oğlumun kulağı ağrıyor. Bugün bir randevu bulabilir miyiz?",
    translation: "Hello, my son has an earache. Could we get an appointment today?",
  },
  {
    business: "Sewa Motor Ubud",
    place: "Bali",
    language: "Indonesian",
    lang: "id",
    original: "Halo, apakah masih ada motor matic untuk tiga hari mulai besok?",
    translation: "Hello, do you still have an automatic scooter for three days from tomorrow?",
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
    business: "Krua Apsorn",
    place: "Bangkok",
    language: "Thai",
    lang: "th",
    original: "สวัสดีครับ พรุ่งนี้วันหยุด ร้านเปิดไหมครับ แล้วเปิดถึงกี่โมงครับ",
    translation: "Hello, are you open tomorrow over the holiday, and until what time?",
  },
];
