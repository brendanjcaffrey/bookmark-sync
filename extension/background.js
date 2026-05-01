const OTHER_BOOKMARKS_ID = "unfiled_____";
const TOOLBAR_BOOKMARKS_ID = "toolbar_____";
const NATIVE_HOST = "com.jcaffrey.bookmark_sync";
const NOTIFICATION_ID = "bookmark-sync-status";
const SUCCESS_DISMISS_MS = 4000;

const MENU_BAR = "add-current-tab-bar";
const MENU_OTHER = "add-current-tab-other";

// treat http://example.com and http://example.com/ as equal to prevent spurious updates
function urlsEqual(a, b) {
  if (a === b) return true;
  return a + "/" === b || a === b + "/";
}

async function syncBookmarks(parentId, jsonBookmarks) {
  console.log("Syncing bookmarks");
  const counts = { added: 0, updated: 0, removed: 0 };
  const existingBookmarks = await chrome.bookmarks.getChildren(parentId);

  const currentBookmarks = {};
  existingBookmarks.forEach((bookmark) => {
    if (bookmark.url)
      currentBookmarks[bookmark.title] = [bookmark.id, bookmark.url];
  });
  console.log(`Current bookmarks: ${JSON.stringify(currentBookmarks)}`);

  for (const [title, url] of Object.entries(jsonBookmarks)) {
    if (currentBookmarks[title]) {
      const [bookmarkId, existingUrl] = currentBookmarks[title];
      if (!urlsEqual(existingUrl, url)) {
        console.log(`Updating bookmark: ${title} ${existingUrl} -> ${url}`);
        await chrome.bookmarks.update(bookmarkId, { url });
        counts.updated += 1;
      }
      delete currentBookmarks[title];
    } else {
      console.log(`Adding bookmark: ${title} (${url})`);
      await chrome.bookmarks.create({ parentId: parentId, title, url });
      counts.added += 1;
      delete currentBookmarks[title];
    }
  }

  for (const [title, [id]] of Object.entries(currentBookmarks)) {
    console.log(`Removing bookmark: ${title}`);
    await chrome.bookmarks.remove(id);
    counts.removed += 1;
  }

  const updatedBookmarks = await chrome.bookmarks.getChildren(parentId);
  for (const [index, title] of Object.keys(jsonBookmarks).entries()) {
    const bookmarkToMove = updatedBookmarks.find((b) => b.title === title);
    if (bookmarkToMove) {
      console.log(`Moving bookmark: ${title} to position ${index}`);
      await chrome.bookmarks.move(bookmarkToMove.id, { index });
    }
  }

  return counts;
}

async function performSync(json) {
  const totals = { added: 0, updated: 0, removed: 0 };
  const targets = [
    [TOOLBAR_BOOKMARKS_ID, json.bar],
    [OTHER_BOOKMARKS_ID, json.other],
  ];

  for (const [parentId, entries] of targets) {
    const counts = await syncBookmarks(parentId, entries);
    totals.added += counts.added;
    totals.updated += counts.updated;
    totals.removed += counts.removed;
  }

  return totals;
}

function parseAndValidate(content) {
  const trimmed = (content || "").trim();
  if (!trimmed) {
    return { bar: {}, other: {} };
  }
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Bookmarks file is not valid JSON: ${e.message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Bookmarks file must be a JSON object");
  }
  const keys = Object.keys(data);
  const extra = keys.filter((k) => k !== "bar" && k !== "other");
  const missing = ["bar", "other"].filter((k) => !(k in data));
  if (extra.length || missing.length) {
    const parts = [];
    if (extra.length) parts.push(`unexpected key(s): ${extra.join(", ")}`);
    if (missing.length) parts.push(`missing key(s): ${missing.join(", ")}`);
    throw new Error(
      `Bookmarks file must have exactly 'bar' and 'other' keys (${parts.join("; ")})`,
    );
  }
  for (const group of ["bar", "other"]) {
    const v = data[group];
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`"${group}" must be an object`);
    }
    for (const url of Object.values(v)) {
      if (typeof url !== "string") {
        throw new Error(`"${group}" must map strings to strings`);
      }
    }
  }
  return data;
}

function summarize(totals) {
  const parts = [];
  if (totals.added) parts.push(`${totals.added} added`);
  if (totals.updated) parts.push(`${totals.updated} updated`);
  if (totals.removed) parts.push(`${totals.removed} removed`);
  return parts.length ? parts.join(", ") : "No changes";
}

async function showSuccess(title, message) {
  await chrome.notifications.clear(NOTIFICATION_ID);
  await chrome.notifications.create(NOTIFICATION_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-48.png"),
    title,
    message,
  });
  setTimeout(
    () => chrome.notifications.clear(NOTIFICATION_ID),
    SUCCESS_DISMISS_MS,
  );
}

async function showError(title, error) {
  console.error(title, error);
  const message = error && error.message ? error.message : String(error);
  await chrome.notifications.clear(NOTIFICATION_ID);
  await chrome.notifications.create(NOTIFICATION_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-48.png"),
    title,
    message,
    requireInteraction: true,
  });
}

async function setupMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_BAR,
    title: "Save current tab to Bookmarks Toolbar",
    contexts: ["action", "page"],
  });
  chrome.contextMenus.create({
    id: MENU_OTHER,
    title: "Save current tab to Other Bookmarks",
    contexts: ["action", "page"],
  });
}

async function getActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    throw new Error("No active tab");
  }
  if (!/^https?:/i.test(tab.url)) {
    throw new Error("Only http(s) pages can be saved");
  }
  return { title: (tab.title || tab.url).trim(), url: tab.url };
}

async function saveBookmark({ title, url, group }) {
  const response = await browser.runtime.sendNativeMessage(NATIVE_HOST, {
    action: "addBookmark",
    title,
    url,
    group,
  });
  if (!response || response.ok !== true) {
    throw new Error(
      (response && response.error) || "Native host did not confirm save",
    );
  }

  const resolvedGroup = response.group === "bar" ? "bar" : "other";
  const parentId =
    resolvedGroup === "bar" ? TOOLBAR_BOOKMARKS_ID : OTHER_BOOKMARKS_ID;
  const existing = await chrome.bookmarks.getChildren(parentId);
  const dup = existing.find((b) => b.title === title);
  if (dup) {
    throw new Error(
      "A bookmark with this title already exists in the target folder",
    );
  } else {
    await chrome.bookmarks.create({ parentId, title, url });
  }

  return { title, url, group: resolvedGroup };
}

async function handleAddCurrentTab(group) {
  try {
    const { title, url } = await getActiveTabInfo();
    const params = new URLSearchParams({ title, url, group });
    await browser.windows.create({
      url: chrome.runtime.getURL(`save-tab.html?${params.toString()}`),
      type: "popup",
      width: 460,
      height: 280,
    });
  } catch (error) {
    await showError("Failed to save bookmark", error);
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    const response = await browser.runtime.sendNativeMessage(
      NATIVE_HOST,
      "getFile",
    );
    console.log(`Received ${response}`);
    const json = parseAndValidate(response);
    const totals = await performSync(json);
    await showSuccess("Bookmarks synced", summarize(totals));
  } catch (error) {
    await showError("Bookmark sync failed", error);
  }
});

chrome.runtime.onInstalled.addListener(setupMenus);
chrome.runtime.onStartup.addListener(setupMenus);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_BAR) {
    handleAddCurrentTab("bar");
  } else if (info.menuItemId === MENU_OTHER) {
    handleAddCurrentTab("other");
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === MENU_BAR) {
    handleAddCurrentTab("bar");
  } else if (command === MENU_OTHER) {
    handleAddCurrentTab("other");
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "save-bookmark") {
    return (async () => {
      try {
        const result = await saveBookmark(msg);
        const where =
          result.group === "bar" ? "Bookmarks Toolbar" : "Other Bookmarks";
        showSuccess("Bookmark saved", `${where} — ${result.title}`);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error && error.message ? error.message : String(error),
        };
      }
    })();
  }
});
