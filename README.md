# Bookmark Sync

A Firefox extension and a Raycast extension that share a single `bookmarks.json` file on macOS. The Firefox side mirrors the file into your browser bookmarks (and lets you save the current tab back into the file); the Raycast side is a quick-launcher UI for browsing and editing those bookmarks.

### Backup your bookmarks first

Please follow the steps at [https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer) to backup your bookmarks before using this extension. It will delete your bookmarks, and there will be no way to get them back.

### JSON file

The file should be in this directory, `bookmarks.json`. If you want to have the file elsewhere, create a symlink via `ln -s /Users/you/path/to/bookmarks.json bookmarks.json`.

The file uses two top-level groups, `bar` and `other`, mapped to Firefox's **Bookmarks Toolbar** and **Other Bookmarks** folders respectively. Syncing will delete everything in both of those folders and create a new bookmark for each entry in the file:

```
{
  "bar": {
    "proton mail": "https://mail.proton.me/",
    "wsj": "https://www.wsj.com/"
  },
  "other": {
    "github": "https://github.com",
    "firefox addons developer": "https://addons.mozilla.org/en-US/developers/"
  }
}
```

Both extensions strictly validate this shape and refuse to read or write the file if it has any other keys, missing keys, or non-string values.

## Firefox extension

### Install the native portion

The extension requires an external script to interact with the `bookmarks.json` file. If you run `native/copy.sh`, it will generate a `manifest.json` file for you from the template in `native/manifest.json` and place it where Firefox expects it to be.

### Testing the extension

- clone this repository
- go to `about:debugging` in Firefox, click on `This Firefox` and `Load Temporary Add-on...`
- select the `extension/manifest.json` file
- click the extension puzzle piece button (top right toolbar) and then on the "Sync Bookmarks" button

### Saving the current tab

The extension can also append the current tab to the JSON file:

- Right-click the extension icon (or anywhere on a page) → **Save current tab to Bookmarks Toolbar** or **Save current tab to Other Bookmarks**
- Or assign keyboard shortcuts in `about:addons`, Manage Extension Shortcuts

### Permanently installing the extension

This is a bit more involved, but you won't have to load the extension every time you open Firefox.

#### Uploading a private build to Mozilla Developer Hub

- if you don't have `web-ext` installed, install that first via: `npm install -g web-ext`
- clone this repository
- `cd extension`
- in `manifest.json`, make sure to set the `browser_specific_settings.gecko.id` to something unique and possibly bump the `version`
  - if you change the `browser_specific_settings.gecko.id`, you'll need to re-run the `native/copy.sh` script
- run `web-ext lint` to make sure the extension doesn't have any issues
- run `zip -r my-extension.zip .`
- go the [Developer Hub](https://addons.mozilla.org/en-US/developers/)
- sign in or create an account

#### Submitting a new add on

- go to [Submit a New Add-on](https://addons.mozilla.org/en-US/developers/addon/submit/agreement), distribute on your own, and upload the `my-extension.zip` file from earlier
- wait a bit for it to be approved (you'll get an email notification when it is)
- go to [My Add-ons](https://addons.mozilla.org/en-US/developers/addons), select `Bookmark Sync`, then `View All` in the left column
- click on the latest version and download the `xpi` file, then agree to add the extension

#### Uploading a new version

- go to [My Add-ons](https://addons.mozilla.org/en-US/developers/addons), select `Bookmark Sync`, then `Upload New Version` in the left column
- upload the `my-extension.zip` file from earlier
- wait a bit for it to be approved (you'll get an email notification when it is)
- click on the latest version and download the `xpi` file, then agree to add the extension

## Raycast extension

A Raycast extension that reads and writes the same JSON file. Use Raycast to browse, search, add, edit, and delete bookmarks. This was forked from the existing [Markmarks](https://github.com/raycast/extensions/tree/main/extensions/markmarks) extension at commit `186d955`.

### Features

- **Bookmarks** — Browse and search all bookmarks with website favicons
- **New Bookmark** — Save a URL as a bookmark; the URL field auto-fills from the clipboard if it contains one
- **Edit & Delete** — Modify or remove bookmarks directly from Raycast
- **Move Between Groups** — Reorganize bookmarks between the Bookmarks Toolbar and Other Bookmarks groups

### Installing as a local extension

Raycast can load any extension directly from a checkout on disk — there's no need to publish it to the Raycast Store.

1. Install Node.js (18+) and Raycast.
2. Inside this repository, change into the `raycast` directory and install dependencies:
   ```bash
   cd raycast
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Raycast will pick up the extension and import it. Leave this command running while you use the extension; the first launch can take a few seconds.
4. Once imported, the **Bookmarks** and **New Bookmark** commands appear in Raycast just like store-installed extensions.
5. To stop, press `Ctrl+C` in the terminal. The extension stays installed locally — Raycast remembers it between launches and will continue to use the built version. Re-run `npm run dev` whenever you change the source code.

If Raycast shows a "command not found" or build error, run `npm run lint` and `npm run build` to surface compilation issues, then restart `npm run dev`.

### Configuration

Set the path to your JSON bookmarks file in the extension preferences:

1. Open Raycast Preferences
2. Navigate to Extensions → Bookmark Sync
3. Set the **Bookmarks File** to the JSON file path (the same file the Firefox extension reads)

### Saving from the clipboard

Raycast doesn't allow third-party extensions to add actions to the built-in Clipboard History, so the workflow is clipboard-driven instead:

1. Copy a URL anywhere (browser address bar, link in a chat, etc.)
2. Open Raycast and run **New Bookmark** (assign it a hotkey for one-keystroke access)
3. The URL field is prefilled from the clipboard; type a title and press ⌘↩

### Keyboard shortcuts

| Action                          | Shortcut |
| ------------------------------- | -------- |
| Open bookmark                   | Enter    |
| Copy URL                        | ⌘C       |
| Copy title                      | ⌘⇧C      |
| Edit bookmark                   | ⌘E       |
| Move to group                   | ⌘M       |
| Delete bookmark                 | ⌘⌫       |
| Reload bookmarks                | ⌘R       |
| Reveal bookmarks file in Finder | ⌘⇧O      |
