#! /usr/bin/env node

var pull = require('pull-stream')
var ref = require('ssb-ref')
var schemas = require('ssb-msg-schemas')
var moment = require('moment')
var argv = require('minimist')(process.argv.slice(2))

if (argv.h || argv.help)
  usage()

// output help and kill the process
function usage (errtext) {
  if (errtext)
    console.log(errtext)
  console.log('List messages: ssb-example-pm.js')
  console.log('Send message:  ssb-example-pm.js {recp} [message...]')
  process.exit(1)
}

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

// render a private message
function renderPost (selfId, msg) {
  var c = msg.value.content
  if (c.type != 'post' || !c.text || typeof c.text != 'string')
    return
  var author = (msg.value.author === selfId) ? 'you' : msg.value.author
  console.log(moment(msg.value.timestamp).fromNow(), ' ', author, '\n')
  console.log(c.text.trim())
  console.log('\n-\n')
}

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

require('ssb-client')(function (err, sbot) {
  if (err) throw err

  sbot.whoami(function (err, info) {
    var selfId = info.id

    if (argv._.length === 0)
      listPMs(sbot, selfId)
    else {
      var recpId = argv._[0]
      var msg = argv._.slice(1).join(' ').trim()
      if (!ref.isFeed(recpId))
        usage('Invalid recipient, must be a feed ID')
      if (!msg)
        usage('Must include a message')
      publishPM(sbot, selfId, recpId, msg)
    }
  })
})