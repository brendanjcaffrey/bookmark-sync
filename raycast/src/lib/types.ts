export type BookmarkGroup = "bar" | "other";

export interface Bookmark {
  title: string;
  url: string;
  group: BookmarkGroup;
}

export interface BookmarksData {
  bookmarks: Bookmark[];
}
