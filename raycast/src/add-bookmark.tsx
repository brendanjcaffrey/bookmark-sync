import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  getPreferenceValues,
  showToast,
  Toast,
  popToRoot,
  showHUD,
  Icon,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { addBookmark } from "./lib/bookmarks-store";
import { BookmarkGroup } from "./lib/types";

const GROUP_LABELS: Record<BookmarkGroup, string> = {
  bar: "Bookmarks Toolbar",
  other: "Other Bookmarks",
};

function parseUrl(text: string | undefined): URL | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url;
    }
  } catch {
    // not a URL
  }
  return null;
}

export default function AddBookmark() {
  const { bookmarksFile } = getPreferenceValues<Preferences>();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [group, setGroup] = useState<BookmarkGroup>("other");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const clipboardText = await Clipboard.readText();
        const clipboardUrl = parseUrl(clipboardText);
        if (clipboardUrl) {
          setUrl(clipboardUrl.toString());
          showToast({
            style: Toast.Style.Success,
            title: "Pulled URL from clipboard",
          });
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to initialize",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [bookmarksFile]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Title is required" });
      return;
    }

    if (!url.trim()) {
      showToast({ style: Toast.Style.Failure, title: "URL is required" });
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      showToast({ style: Toast.Style.Failure, title: "Invalid URL" });
      return;
    }

    try {
      addBookmark(bookmarksFile, {
        title: title.trim(),
        url: url.trim(),
        group,
      });

      await showHUD(`Bookmark saved to ${GROUP_LABELS[group]}`);
      await popToRoot();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to save bookmark",
        message: String(error),
      });
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Bookmark" icon={Icon.Bookmark} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" value={title} onChange={setTitle} placeholder="Bookmark title" />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} placeholder="https://example.com" />
      <Form.Separator />
      <Form.Dropdown id="group" title="Group" value={group} onChange={(v) => setGroup(v as BookmarkGroup)}>
        <Form.Dropdown.Item value="bar" title={GROUP_LABELS.bar} />
        <Form.Dropdown.Item value="other" title={GROUP_LABELS.other} />
      </Form.Dropdown>
    </Form>
  );
}
