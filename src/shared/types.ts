export interface SearchResult {
  position: number;
  sourceTitle: string;
  sectionTitle: string;
  citation: string;
  vpath: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalPages: number;
  currentPage: number;
  normRedirect?: {
    vpath: string;
    title: string;
  };
}

export interface DocumentContent {
  title: string;
  metadata: string;
  content: string;
  vpath: string;
}

export interface TocEntry {
  title: string;
  vpath: string;
  depth: number;
  children?: TocEntry[];
}

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}
