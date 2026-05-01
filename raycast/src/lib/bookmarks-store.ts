import * as fs from "fs";
import * as path from "path";
import { Bookmark, BookmarkGroup, BookmarksData } from "./types";

const GROUPS: ReadonlyArray<BookmarkGroup> = ["bar", "other"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateData(data: unknown): asserts data is Record<BookmarkGroup, Record<string, string>> {
  if (!isObject(data)) {
    throw new Error("Bookmarks file must be a JSON object");
  }
  const keys = Object.keys(data);
  const extra = keys.filter((k) => k !== "bar" && k !== "other");
  const missing = GROUPS.filter((k) => !(k in data));
  if (extra.length || missing.length) {
    const parts: string[] = [];
    if (extra.length) parts.push(`unexpected key(s): ${extra.join(", ")}`);
    if (missing.length) parts.push(`missing key(s): ${missing.join(", ")}`);
    throw new Error(`Bookmarks file must have exactly 'bar' and 'other' keys (${parts.join("; ")})`);
  }
  for (const group of GROUPS) {
    const v = (data as Record<string, unknown>)[group];
    if (!isObject(v)) {
      throw new Error(`"${group}" must be an object`);
    }
    for (const url of Object.values(v)) {
      if (typeof url !== "string") {
        throw new Error(`"${group}" must map strings to strings`);
      }
    }
  }
}

export function readBookmarks(filePath: string): BookmarksData {
  if (!fs.existsSync(filePath)) {
    return { bookmarks: [] };
  }

  const content = fs.readFileSync(filePath, "utf-8").trim();
  if (!content) {
    return { bookmarks: [] };
  }

  const data: unknown = JSON.parse(content);
  validateData(data);

  const bookmarks: Bookmark[] = [];
  for (const group of GROUPS) {
    for (const [title, url] of Object.entries(data[group])) {
      bookmarks.push({ title, url, group });
    }
  }
  return { bookmarks };
}

export function writeBookmarks(filePath: string, data: BookmarksData): void {
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, serialize(data) + "\n", "utf-8");
}

function serialize(data: BookmarksData): string {
  const obj: Record<BookmarkGroup, Record<string, string>> = { bar: {}, other: {} };
  for (const b of data.bookmarks) {
    obj[b.group][b.title] = b.url;
  }
  return JSON.stringify(obj, null, 2);
}

function sameBookmark(a: Bookmark, b: Bookmark): boolean {
  return a.group === b.group && a.title === b.title && a.url === b.url;
}

export function addBookmark(filePath: string, bookmark: Bookmark): void {
  const data = readBookmarks(filePath);
  const conflict = data.bookmarks.some((b) => b.group === bookmark.group && b.title === bookmark.title);
  if (conflict) {
    throw new Error(`A bookmark titled "${bookmark.title}" already exists in this group`);
  }
  data.bookmarks.push(bookmark);
  writeBookmarks(filePath, data);
}

export function editBookmark(filePath: string, original: Bookmark, updated: Bookmark): void {
  const data = readBookmarks(filePath);
  const idx = data.bookmarks.findIndex((b) => sameBookmark(b, original));
  if (idx < 0) return;

  const titleChanged = original.title !== updated.title || original.group !== updated.group;
  if (titleChanged) {
    const conflict = data.bookmarks.some((b, i) => i !== idx && b.group === updated.group && b.title === updated.title);
    if (conflict) {
      throw new Error(`A bookmark titled "${updated.title}" already exists in this group`);
    }
  }

  data.bookmarks[idx] = updated;
  writeBookmarks(filePath, data);
}

export function deleteBookmark(filePath: string, target: Bookmark): void {
  const data = readBookmarks(filePath);
  data.bookmarks = data.bookmarks.filter((b) => !sameBookmark(b, target));
  writeBookmarks(filePath, data);
}

export function moveBookmark(filePath: string, target: Bookmark, newGroup: BookmarkGroup): void {
  const data = readBookmarks(filePath);
  const idx = data.bookmarks.findIndex((b) => sameBookmark(b, target));
  if (idx < 0) return;

  const conflict = data.bookmarks.some((b, i) => i !== idx && b.group === newGroup && b.title === target.title);
  if (conflict) {
    throw new Error(`A bookmark titled "${target.title}" already exists in the destination group`);
  }

  data.bookmarks[idx] = { ...data.bookmarks[idx], group: newGroup };
  writeBookmarks(filePath, data);
}
