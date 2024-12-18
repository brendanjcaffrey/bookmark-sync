#!/usr/bin/env python3

import sys
import json
import struct

# open log file
log_file = open("/Users/brendancaffrey/Development/scripts/log.txt", "a")

def getMessage():
    global log_file
    rawLength = sys.stdin.buffer.read(4)
    log_file.write("rawLength: " + str(rawLength) + "\n")
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode('utf-8')
    log_file.write("message: " + str(message) + "\n")
    return json.loads(message)

def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent, separators=(',', ':')).encode('utf-8')
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}

def sendMessage(encodedMessage):
    log_file.write("encodedMessage: " + str(encodedMessage) + "\n")
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.buffer.write(encodedMessage['content'])
    sys.stdout.buffer.flush()

while True:
    receivedMessage = getMessage()
    if receivedMessage == "getFile":
        file_path = "/Users/brendancaffrey/Development/scripts/bookmarks.json"
        with open(file_path, 'r') as f:
            content = f.read()
        sendMessage(encodeMessage(content))

if __name__ == "__main__":
    log_file.write("Python script started\n")
    main()
