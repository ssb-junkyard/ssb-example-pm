# SSB Private Message

Send and receive encrypted messages on ssb

```
$ git clone https://github.com/pfraze/ssb-pm.git
$ cd ssb-pm
$ npm install

$ ./ssb-pm.js -h
List messages: ssb-pm.js
Send message:  ssb-pm.js {recp} [message...]

$ ./ssb-pm.js @hxGxqPrplLjRG2vtjQL87abX4QKqeLgCwQpS730nNwE=.ed25519 "hello, this is a big secret"
$ ./ssb-pm.js

a minute ago   you 

hello there, this is a big secret
```

## How it works

Normally, messages have an object in the `content` attribute.
If `content` is a string, that means the message is encrypted -- the string is the base64-encoded ciphertext.
Recipients are hidden, so we try to decrypt.
If successful, the message was for the user:

```js
// list private messages
function listPMs (sbot, selfId) {
  pull(
    // all type: post messages, in order received
    sbot.messagesByType('post'),

    // encrypted?
    pull.filter(function (msg) { return typeof msg.value.content === 'string' }),

    // attempt to decrypt    
    pull.asyncMap(function (msg, cb) {
      sbot.private.unbox(msg.value.content, function (err, content) {
        if (content)
          msg.value.content = content
        cb(null, msg)
      })
    }),

    // successfully decrypted?
    pull.filter(function (msg) { return typeof msg.value.content !== 'string' }),

    // render
    pull.drain(renderPost.bind(null, selfId), function (err) {
      if (err) throw err
      sbot.close()
    })
  )
}
```

To publish, we use [https://github.com/ssbc/ssb-message-schemas](ssb-msg-schemas) to build the message content, and [`sbot.private.publish`](https://github.com/ssbc/scuttlebot/blob/master/plugins/private.md#publish-async) to write to the feed.
Note, the local user is included in the recipients, so we can read our own messages.

```js
function publishPM (sbot, selfId, recpId, msg) {
  var recps = (selfId !== recpId) ? [selfId, recpId] : [selfId]

  // create the type: post message
  var post = schemas.post(
    msg,  // text content
    null, // reply topmost msg
    null, // reply parent
    null, // mention links
    recps // recipient links
  )
  sbot.private.publish(post, recps, function (err, msg) {
    if (err) throw err
    sbot.close()
  })
}
```