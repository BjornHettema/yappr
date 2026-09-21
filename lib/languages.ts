/**
 * One shared language list for both dropdowns.
 *
 * There used to be a "traveler languages" list and a separate, longer "local
 * languages" list, which quietly decided who was allowed to be a tourist:
 * an Indonesian speaker in Thailand couldn't use Yappr at all, and neither
 * could a Thai person travelling anywhere. Anyone can be on either end of the
 * call, so it's one list.
 *
 * Grouped by region only so the dropdown is scannable — nothing in the app
 * depends on the grouping. The languages here are the ones the voice model
 * handles well enough for a phone call; the last few Southeast Asian entries
 * are the weakest for spoken output but are kept because they're squarely in
 * Yappr's use case.
 */
export const languageGroups = [
  {
    region: "Europe",
    languages: [
      "English",
      "Spanish",
      "Portuguese",
      "French",
      "German",
      "Dutch",
      "Italian",
      "Catalan",
      "Greek",
      "Polish",
      "Czech",
      "Slovak",
      "Hungarian",
      "Romanian",
      "Bulgarian",
      "Croatian",
      "Serbian",
      "Ukrainian",
      "Russian",
      "Swedish",
      "Norwegian",
      "Danish",
      "Finnish",
      "Turkish",
    ],
  },
  {
    region: "Middle East & Africa",
    languages: ["Arabic", "Hebrew", "Persian (Farsi)", "Swahili", "Afrikaans"],
  },
  {
    region: "South Asia",
    languages: ["Hindi", "Urdu", "Bengali", "Tamil", "Telugu", "Nepali"],
  },
  {
    region: "East & Southeast Asia",
    languages: [
      "Mandarin Chinese",
      "Cantonese",
      "Japanese",
      "Korean",
      "Thai",
      "Vietnamese",
      "Indonesian",
      "Malay",
      "Tagalog (Filipino)",
      "Khmer",
      "Lao",
      "Burmese",
    ],
  },
];

export const businessTypes = [
  { value: "restaurant", label: "Restaurant / cafe" },
  { value: "hotel", label: "Hotel / guesthouse" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "clinic", label: "Clinic / dentist" },
  { value: "shop", label: "Shop / market stall" },
  { value: "tour", label: "Tour desk / activity" },
  { value: "transport", label: "Taxi / transfer / rental" },
  { value: "salon", label: "Salon / spa" },
  { value: "other", label: "Other local business" },
];
