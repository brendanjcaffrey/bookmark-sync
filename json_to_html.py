#!/usr/bin/env python3
"""Convert bookmarks.json into a Netscape bookmark HTML file (importable by Safari)."""

import argparse
import html
import json
import time

FOLDER_NAMES = {"bar": "Favorites", "other": "Other Bookmarks"}


def render(node, indent, now):
    pad = "    " * indent
    lines = [f"{pad}<DL><p>"]
    for name, value in node.items():
        if isinstance(value, dict):
            attrs = f' ADD_DATE="{now}" LAST_MODIFIED="{now}"'
            if indent == 0 and name == "bar":
                attrs += ' PERSONAL_TOOLBAR_FOLDER="true"'
            title = FOLDER_NAMES.get(name, name) if indent == 0 else name
            lines.append(f"{pad}    <DT><H3{attrs}>{html.escape(title)}</H3>")
            lines.extend(render(value, indent + 1, now))
        else:
            href = html.escape(value, quote=True)
            lines.append(f'{pad}    <DT><A HREF="{href}" ADD_DATE="{now}">{html.escape(name)}</A>')
    lines.append(f"{pad}</DL><p>")
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default="bookmarks.json")
    parser.add_argument("output", nargs="?", default="bookmarks.html")
    args = parser.parse_args()

    with open(args.input) as f:
        bookmarks = json.load(f)

    out = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        *render(bookmarks, 0, int(time.time())),
    ]
    with open(args.output, "w") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
