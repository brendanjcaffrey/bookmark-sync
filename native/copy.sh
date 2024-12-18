cd "$(dirname $0)"
user="$(whoami)"
cat manifest.json | sed "s/USERNAME/$user/" > "/Users/$user/Library/Application Support/Mozilla/NativeMessagingHosts/com.jcaffrey.bookmark_sync.json"
chmod 644 "/Users/$user/Library/Application Support/Mozilla/NativeMessagingHosts/com.jcaffrey.bookmark_sync.json"
