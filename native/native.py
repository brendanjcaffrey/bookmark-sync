#!/usr/bin/env python3

import os
import json
import struct
import sys

def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode('utf-8')
    return json.loads(message)

def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent, separators=(',', ':')).encode('utf-8')
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}

def sendMessage(encodedMessage):
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.buffer.write(encodedMessage['content'])
    sys.stdout.buffer.flush()

def main(filePath):
    while True:
        receivedMessage = getMessage()
        if receivedMessage == "getFile":
            with open(filePath, 'r') as f:
                content = f.read()
            sendMessage(encodeMessage(content))

if __name__ == "__main__":
    scriptDir = os.path.dirname(os.path.abspath(__file__))
    filePath = os.path.join(os.path.dirname(scriptDir), 'bookmarks.json')
    main(filePath)
