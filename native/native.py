#!/usr/bin/env python3

import os
import json
import struct
import sys
import tempfile


def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack("@I", rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode("utf-8")
    return json.loads(message)


def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent, separators=(",", ":")).encode("utf-8")
    encodedLength = struct.pack("@I", len(encodedContent))
    return {"length": encodedLength, "content": encodedContent}


def sendMessage(messageContent):
    encoded = encodeMessage(messageContent)
    sys.stdout.buffer.write(encoded["length"])
    sys.stdout.buffer.write(encoded["content"])
    sys.stdout.buffer.flush()


def readFileContent(filePath):
    if not os.path.exists(filePath):
        return ""
    with open(filePath, "r") as f:
        return f.read()


# writes the file atomically & preserves symlinks
def atomicWriteJson(filePath, data):
    realPath = os.path.realpath(filePath)
    dirName = os.path.dirname(realPath) or "."
    fd, tmpPath = tempfile.mkstemp(dir=dirName, prefix=".bookmarks-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        os.replace(tmpPath, realPath)
    except Exception:
        try:
            os.unlink(tmpPath)
        except OSError:
            pass
        raise


def handleGetFile(filePath):
    sendMessage(readFileContent(filePath))


def urlsEqual(a, b):
    return a == b or a + "/" == b or a == b + "/"


def validateData(data):
    """Returns an error message string, or None if data is the canonical {bar, other} shape."""
    if not isinstance(data, dict):
        return "Bookmarks file must be a JSON object"
    keys = set(data.keys())
    extra = keys - {"bar", "other"}
    missing = {"bar", "other"} - keys
    if extra or missing:
        problems = []
        if extra:
            problems.append(f"unexpected key(s): {', '.join(sorted(extra))}")
        if missing:
            problems.append(f"missing key(s): {', '.join(sorted(missing))}")
        return f"Bookmarks file must have exactly 'bar' and 'other' keys ({'; '.join(problems)})"
    for group in ("bar", "other"):
        v = data[group]
        if not isinstance(v, dict):
            return f'"{group}" must be an object'
        for title, url in v.items():
            if not isinstance(title, str) or not isinstance(url, str):
                return f'"{group}" must map strings to strings'
    return None


def parseAndValidate(content):
    """Returns (data, error). Empty/whitespace content is treated as the canonical empty file."""
    content = content.strip()
    if not content:
        return {"bar": {}, "other": {}}, None
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return None, f"Bookmarks file is not valid JSON: {e}"
    err = validateData(data)
    if err:
        return None, err
    return data, None


def handleAddBookmark(filePath, msg):
    try:
        title = msg.get("title")
        url = msg.get("url")
        group = msg.get("group")

        if not isinstance(title, str) or not title.strip():
            sendMessage({"ok": False, "error": "Title is required"})
            return
        if not isinstance(url, str) or not url.strip():
            sendMessage({"ok": False, "error": "URL is required"})
            return
        if group not in ("bar", "other"):
            sendMessage({"ok": False, "error": "Group must be bar or other"})
            return

        title = title.strip()
        url = url.strip()

        data, err = parseAndValidate(readFileContent(filePath))
        if err:
            sendMessage({"ok": False, "error": err})
            return

        target = data[group]
        if title in target:
            sendMessage(
                {
                    "ok": False,
                    "error": f'A bookmark titled "{title}" already exists with a different URL',
                }
            )
            return

        target[title] = url
        atomicWriteJson(filePath, {"bar": data["bar"], "other": data["other"]})
        sendMessage({"ok": True, "title": title, "url": url, "group": group})
    except Exception as e:
        sendMessage({"ok": False, "error": str(e)})


def main(filePath):
    while True:
        msg = getMessage()
        if msg == "getFile":
            handleGetFile(filePath)
        elif isinstance(msg, dict) and msg.get("action") == "addBookmark":
            handleAddBookmark(filePath, msg)
        else:
            sendMessage({"ok": False, "error": "Unknown message"})


if __name__ == "__main__":
    scriptDir = os.path.dirname(os.path.abspath(__file__))
    filePath = os.path.join(os.path.dirname(scriptDir), "bookmarks.json")
    main(filePath)
