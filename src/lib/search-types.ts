export type Hit = {
  title: string;
  url: string;
  snippet: string;
  host: string;
  via: "duckduckgo" | "wikipedia";
};

export type WeatherDay = {
  date: string;
  max: number;
  min: number;
  label: string;
};

export type WeatherCard = {
  place: string;
  temp: number;
  label: string;
  wind: number;
  days: WeatherDay[];
};

export type InfoRow = {
  label: string;
  value: string;
};

export type SearchPayload = {
  query: string;
  answer: string | null;
  abstract: string | null;
  abstractSource: string | null;
  abstractUrl: string | null;
  heading: string | null;
  image: string | null;
  infobox: InfoRow[];
  redirect: string | null;
  topics: string[];
  hits: Hit[];
  weather: WeatherCard | null;
};

export type ReaderPayload = {
  url: string;
  title: string;
  html: string;
  thin: boolean;
  words: number;
};
