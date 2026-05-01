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

  const lowerSearch = searchText.toLowerCase();
  const matchesSearch = (b: Bookmark) =>
    !searchText || b.title.toLowerCase().includes(lowerSearch) || b.url.toLowerCase().includes(lowerSearch);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search bookmarks..."
    >
      {GROUP_ORDER.map((group) => {
        const items = bookmarks.filter((b) => b.group === group).filter(matchesSearch);
        if (items.length === 0) return null;

        return (
          <List.Section
            key={group}
            title={GROUP_LABELS[group]}
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
