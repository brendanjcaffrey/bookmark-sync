const OTHER_BOOKMARKS_ID = "unfiled_____";
const TOOLBAR_BOOKMARKS_ID = "toolbar_____";

async function syncBookmarks(parentId, jsonBookmarks) {
  console.log("Syncing bookmarks");
  const existingBookmarks = await chrome.bookmarks.getChildren(parentId);

  const currentBookmarks = {};
  existingBookmarks.forEach(bookmark => {
    if (bookmark.url) currentBookmarks[bookmark.title] = [bookmark.id, bookmark.url];
  });
  console.log(`Current bookmarks: ${JSON.stringify(currentBookmarks)}`);

  for (const [title, url] of Object.entries(jsonBookmarks)) {
    if (currentBookmarks[title]) {
      const [bookmarkId, existingUrl] = currentBookmarks[title];
      if (existingUrl !== url) {
        await chrome.bookmarks.update(bookmarkId, { url });
        console.log(`Updated bookmark: ${title} ${existingUrl} -> ${url}`);
      }
      delete currentBookmarks[title];
    } else {
      await chrome.bookmarks.create({ parentId: parentId, title, url });
      console.log(`Added bookmark: ${title} (${url})`);
      delete currentBookmarks[title];
    }
  }

  for (const [title, [id, _]] of Object.entries(currentBookmarks)) {
    await chrome.bookmarks.remove(id);
    console.log(`Removed bookmark: ${title}`);
  }

  const updatedBookmarks = await chrome.bookmarks.getChildren(parentId);
  for (const [index, title] of Object.keys(jsonBookmarks).entries()) {
    const bookmarkToMove = updatedBookmarks.find(b => b.title === title);
    if (bookmarkToMove) {
      await chrome.bookmarks.move(bookmarkToMove.id, { index });
      console.log(`Moved bookmark: ${title} to position ${index}`);
    }
  }
}

function onResponse(response) {
  try {
    console.log(`Received ${response}`);
    const json = JSON.parse(response);
    if ("bar" in json && "other" in json) {
      syncBookmarks(TOOLBAR_BOOKMARKS_ID, json["bar"]);
      syncBookmarks(OTHER_BOOKMARKS_ID, json["other"]);
    } else {
      syncBookmarks(OTHER_BOOKMARKS_ID, json);
    }
  } catch (error) {
    console.error("Error syncing bookmarks:", error);
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

chrome.action.onClicked.addListener(async () => {
  try {
    let sending = browser.runtime.sendNativeMessage("com.jcaffrey.bookmark_sync", "getFile");
    sending.then(onResponse, onError);
  } catch (error) {
    console.error("Error syncing bookmarks:", error);
  }
});
