import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  getPreferenceValues,
  Icon,
  List,
  showInFinder,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { getFavicon } from "@raycast/utils";
import { readBookmarks, deleteBookmark, editBookmark, moveBookmark } from "./lib/bookmarks-store";
import { Bookmark, BookmarkGroup } from "./lib/types";

const GROUP_LABELS: Record<BookmarkGroup, string> = {
  bar: "Bookmarks Toolbar",
  other: "Other Bookmarks",
};

const GROUP_ORDER: BookmarkGroup[] = ["bar", "other"];

export default function ListBookmarks() {
  const { bookmarksFile } = getPreferenceValues<Preferences>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const loadBookmarks = () => {
    try {
      const data = readBookmarks(bookmarksFile);
      setBookmarks(data.bookmarks);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load bookmarks",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, [bookmarksFile]);

  const handleDelete = async (bookmark: Bookmark) => {
    const confirmed = await confirmAlert({
      title: "Delete Bookmark",
      message: `Are you sure you want to delete "${bookmark.title}"?`,
      primaryAction: {
        title: "Delete",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    try {
      deleteBookmark(bookmarksFile, bookmark);
      showToast({ style: Toast.Style.Success, title: "Bookmark deleted" });
      loadBookmarks();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete bookmark",
        message: String(error),
      });
    }
  };

  const handleMove = (bookmark: Bookmark, targetGroup: BookmarkGroup) => {
    try {
      moveBookmark(bookmarksFile, bookmark, targetGroup);
      showToast({ style: Toast.Style.Success, title: `Moved to ${GROUP_LABELS[targetGroup]}` });
      loadBookmarks();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to move bookmark",
        message: String(error),
      });
    }
  };

  const isSearching = searchText.trim().length > 0;

  const sections: { key: string; title: string; items: Bookmark[] }[] = isSearching
    ? (() => {
        const scored: { bookmark: Bookmark; score: number }[] = [];
        for (const b of bookmarks) {
          const score = scoreBookmark(searchText, b);
          if (score !== null) scored.push({ bookmark: b, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return [{ key: "results", title: "Search Results", items: scored.map((s) => s.bookmark) }];
      })()
    : GROUP_ORDER.map((group) => ({
        key: group,
        title: GROUP_LABELS[group],
        items: bookmarks.filter((b) => b.group === group),
      })).filter((s) => s.items.length > 0);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search bookmarks..."
      filtering={false}
    >
      {sections.map((section) => {
        const items = section.items;
        return (
          <List.Section
            key={section.key}
            title={section.title}
            subtitle={`${items.length} bookmark${items.length !== 1 ? "s" : ""}`}
          >
            {items.map((bookmark) => (
              <List.Item
                key={`${bookmark.group}:${bookmark.title}:${bookmark.url}`}
                title={bookmark.title}
                icon={getFavicon(bookmark.url, { fallback: Icon.Bookmark })}
                accessories={[{ text: hostnameOf(bookmark.url) }]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action.OpenInBrowser url={bookmark.url} />
                      <Action.CopyToClipboard
                        title="Copy URL"
                        content={bookmark.url}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="Copy Title"
                        content={bookmark.title}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action.Push
                        title="Edit Bookmark"
                        icon={Icon.Pencil}
                        shortcut={{ modifiers: ["cmd"], key: "e" }}
                        target={
                          <EditBookmarkForm bookmark={bookmark} bookmarksFile={bookmarksFile} onSave={loadBookmarks} />
                        }
                      />
                      <ActionPanel.Submenu
                        title="Move to Group"
                        icon={Icon.ArrowRight}
                        shortcut={{ modifiers: ["cmd"], key: "m" }}
                      >
                        {GROUP_ORDER.filter((g) => g !== bookmark.group).map((g) => (
                          <Action key={g} title={GROUP_LABELS[g]} onAction={() => handleMove(bookmark, g)} />
                        ))}
                      </ActionPanel.Submenu>
                      <Action
                        title="Delete Bookmark"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                        onAction={() => handleDelete(bookmark)}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="Reload Bookmarks"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                        onAction={loadBookmarks}
                      />
                      <Action
                        title="Reveal Bookmarks File in Finder"
                        icon={Icon.Finder}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                        onAction={() => showInFinder(bookmarksFile)}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}
      {!isLoading && bookmarks.length === 0 && (
        <List.EmptyView
          title="No Bookmarks"
          description="Add your first bookmark using the 'New Bookmark' command"
          icon={Icon.Bookmark}
        />
      )}
    </List>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const BOUNDARY_RE = /[\s\-_./|:?#&=@+]/;

function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  let score = 0;
  let hIdx = 0;
  let lastMatch = -1;
  let consecutive = 0;

  for (let i = 0; i < n.length; i++) {
    const found = h.indexOf(n[i], hIdx);
    if (found === -1) return null;

    let cs = 1;
    if (found === 0) {
      cs += 10;
    } else {
      const prev = haystack[found - 1];
      const cur = haystack[found];
      if (BOUNDARY_RE.test(prev)) {
        cs += 7;
      } else if (cur !== cur.toLowerCase() && prev === prev.toLowerCase()) {
        cs += 5;
      }
    }

    if (lastMatch !== -1 && found === lastMatch + 1) {
      consecutive += 1;
      cs += consecutive * 4;
    } else {
      consecutive = 0;
      if (lastMatch !== -1) cs -= Math.min(found - lastMatch - 1, 6) * 0.5;
    }

    score += cs;
    lastMatch = found;
    hIdx = found + 1;
  }

  const substrIdx = h.indexOf(n);
  if (substrIdx !== -1) {
    score += 20;
    if (substrIdx === 0) score += 15;
  }

  score -= haystack.length * 0.02;
  return score;
}

function scoreBookmark(needle: string, b: Bookmark): number | null {
  const trimmed = needle.trim();
  if (!trimmed) return 0;
  const titleScore = fuzzyScore(trimmed, b.title);
  const hostScore = fuzzyScore(trimmed, hostnameOf(b.url));
  const urlScore = fuzzyScore(trimmed, b.url);
  if (titleScore === null && hostScore === null && urlScore === null) return null;
  const t = titleScore !== null ? titleScore * 1.5 : -Infinity;
  const ho = hostScore !== null ? hostScore * 1.2 : -Infinity;
  const u = urlScore !== null ? urlScore : -Infinity;
  return Math.max(t, ho, u);
}

interface EditBookmarkFormProps {
  bookmark: Bookmark;
  bookmarksFile: string;
  onSave: () => void;
}

function EditBookmarkForm({ bookmark, bookmarksFile, onSave }: EditBookmarkFormProps) {
  const { pop } = useNavigation();
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [group, setGroup] = useState<BookmarkGroup>(bookmark.group);

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Title and URL are required" });
      return;
    }

    try {
      editBookmark(bookmarksFile, bookmark, {
        title: title.trim(),
        url: url.trim(),
        group,
      });
      showToast({ style: Toast.Style.Success, title: "Bookmark updated" });
      onSave();
      pop();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to update bookmark",
        message: String(error),
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Bookmark" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" value={title} onChange={setTitle} />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} />
      <Form.Dropdown id="group" title="Group" value={group} onChange={(v) => setGroup(v as BookmarkGroup)}>
        <Form.Dropdown.Item value="bar" title={GROUP_LABELS.bar} />
        <Form.Dropdown.Item value="other" title={GROUP_LABELS.other} />
      </Form.Dropdown>
    </Form>
  );
}
