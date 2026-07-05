export type Tag = string;

/** A raw comment match found during scanning, before blame info is attached. */
export interface ScannedItem {
  tag: Tag;
  text: string;
  file: string;
  line: number;
}

export interface BlameInfo {
  author: string;
  email: string;
  /** ISO 8601 date string, or null if blame failed / author is unknown. */
  date: string | null;
  commit: string | null;
  /** Age in days at the time of the run, or null if unknown. */
  ageDays: number | null;
}

/** A fully resolved artifact: scan result + blame info. */
export interface Item extends ScannedItem, BlameInfo {}

export interface TagCount {
  tag: Tag;
  count: number;
}

export interface AuthorCount {
  author: string;
  count: number;
}

export interface Summary {
  total: number;
  byTag: TagCount[];
  byAuthor: AuthorCount[];
  oldestAgeDays: number | null;
  averageAgeDays: number | null;
  topAuthor: AuthorCount | null;
  shallowClone: boolean;
}

export interface Report {
  repo: string;
  summary: Summary;
  items: Item[];
}

export type SortKey = "age" | "file" | "author";

export type Format = "terminal" | "json" | "markdown";
