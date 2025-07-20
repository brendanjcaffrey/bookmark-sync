# Bookmark Sync

Firefox extensions to load bookmarks from a JSON file on macOS.

### Backup your bookmarks first

Please follow the steps at [https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer) to backup your bookmarks before using this extension. It will delete your bookmarks, and there will be no way to get them back.

### JSON File

The file should be in this directory, `bookmarks.json`. If you want to have the file elsewhere, create a symlink via `ln -s /Users/you/path/to/bookmarks.json bookmarks.json`.

If the file looks like this, the extension will delete everything in the "Other Bookmarks" folder and create a new bookmark for each entry in the file:
```
{
    "github": "https://github.com",
    "firefox addons developer": "https://addons.mozilla.org/en-US/developers/"
}
```

If the file looks like this, the extension will delete everything in both the "Bookmarks Toolbar" and "Other Bookmarks" folders and create a new bookmark for each entry in the file:
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

### Install the native portion

The extension requires an external script to read the `bookmarks.json` file. If you run `native/copy.sh`, it will generate a `manifest.json` file for you from the template in `native/manifest.json` and place it where Firefox expects it to be.

### Testing the extension

- clone this repository
- go to `about:debugging` in Firefox, click on `This Firefox` and `Load Temporary Add-on...`
- select the `extension/manifest.json` file
- click the extension puzzle piece button (top right toolbar) and then on the "Sync Bookmarks" button

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

