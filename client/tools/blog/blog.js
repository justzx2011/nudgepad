/*
var Space = require('space'),
    moment = require('moment'),
    html_beautify = require('html_beautify'),
    Tool = require('tool),
    fs = require('fs),
    Alerts = require('Alerts'),
    Test = require('Test'),
    $ = require('jQuery')
*/

var Blog = new Tool('Blog')

Blog.set('posts', new Space())

Blog.active = {}

Blog.active.filename = null

Blog.active.advanced = function () {
  var post = Blog.get('posts ' + Blog.active.filename)
  TextPrompt.open('Advanced', post.toString(), Blog.active.filename, function (value) {
    post.clear()
    post.patch(value)
    post.save()
    Blog.active.open(Blog.active.filename)
  })
}

Blog.active.close = function () {
  Blog.active.filename = null
  $('.disableable').attr('disabled', true)
  // disable
}

Blog.active.delete = function () {
  var filename =  Blog.active.filename
  Blog.active.close()
  var post = Blog.get('posts ' + filename).trash()
  Blog.trigger('posts')
}

Blog.active.open = function (filename) {
  Blog.active.filename = filename
  var post = Blog.get('posts ' + filename)
  $('#BlogTitle').val(post.get('title'))
  $('#BlogContent').val(post.get('content'))
  // enable
  $('.disableable').removeAttr('disabled')
  $('#BlogTitle').focus()
  document.execCommand('selectAll',false,null)
}

Blog.active.publish = function () {
  var filename = Blog.active.filename
  var post = Blog.get('posts ' + filename)
  var path = 'nudgepad/posts/' + filename
  
  // Autogenerate a permalink
  // todo: cover exceptions like if file already exists
  if (!post.get('permalink')) {
    var title = $('#BlogTitle').val()
    var permalink = Blog.permalink(title)
    post.set('permalink', permalink)
    post.save()
  }
  else {
    var permalink = post.get('permalink')
  }
  // todo: if the title has changed since last publish, may want
  // to ask user if they'd like to update the permalink
  
  var html = Blog.defaultTemplate
  var pressedHtml = post.press(html.toString())
  expressfs.writeFileAndOpen(permalink, pressedHtml, 'published')
}

Blog.active.save = function () {
  var filename =  Blog.active.filename
  var post = Blog.get('posts ' + filename)
  post.set('title', $('#BlogTitle').val())
  post.set('content', $('#BlogContent').val())
  post.save()
  Blog.trigger('posts')
}


Blog.create = function () {
  // todo: remove this line, make writeFile mkdirs that it needs to
  expressfs.mkdir('nudgepad/posts')
  var timestamp = new Date().getTime()
  var filename = timestamp + '.space'
  var post = new Blog.Post(filename)
  post.set('timestamp', timestamp)
  post.set('title', 'Untitled')
  post.save()
  Blog.set('posts ' + filename, post, 0)
  Blog.trigger('posts')
  Blog.active.open(filename)
}

Blog.permalink = function (string) {
  if (!string)
    return ''
  return string.toLowerCase().replace(/[^a-z0-9- _\.]/gi, '').replace(/ /g, '-') + '.html'
}

Blog.downloadPosts = function () {
  expressfs.downloadDirectory('nudgepad/posts/', 'space', function (data) {
    var space = new Space(data)
    space.each(function (filename, value) {
      Blog.set('posts ' + filename, new Blog.Post(filename, value))
    })
    Blog.trigger('posts')
  })
}

Blog.getList = function () {
  var html = '<ul>\n'
  Blog.get('posts').each(function (filename, value) {
    html += ' <li><a href="' + value.get('permalink') + '">' + value.get('title') + '</a></li>\n'
  })
  html += '</ul>'
  TextPrompt.open('List', html, 'list.html')
}

Blog.listPosts = function () {
  var posts = Blog.get('posts')
  $('#BlogPosts').html('')
  
  posts.each(function (filename, value) {
    $('#BlogPosts').append('<li><a class="cursor" onclick="Blog.active.open(\'' + filename + '\')">' + value.get('title') + '</a></li>')
  })
}

Blog.publishAll = function () {
  Blog.get('posts').each(function (filename, value) {
    var post = Blog.get('posts ' + filename)
    var path = 'nudgepad/posts/' + filename
    
    // Autogenerate a permalink
    // todo: cover exceptions like if file already exists
    if (!post.get('permalink')) {
      var title = post.get('title')
      var permalink = Blog.permalink(title)
      post.set('permalink', permalink)
      post.save()
    }
    else {
      var permalink = post.get('permalink')
    }
    
    
    var html = Blog.defaultTemplate
    var pressedHtml = post.press(html.toString())
    expressfs.writeFile(permalink, pressedHtml, function () {
      Alerts.success('Published ' + permalink)
    })
  })
}

Blog.on('ready', Blog.downloadPosts)
Blog.on('posts', Blog.listPosts)

Blog.on('once', function () {
  $.get('/nudgepad/tools/blog/bootstrap/index.html', function (data) {
    Blog.defaultTemplate = data
  })
})

Blog.Post = function (filename, patch) {
  this.clear()
  this._filename = filename
  if (patch)
    this.patch(patch)
  return this
}

Blog.Post.prototype = new Space()

Blog.Post.prototype.press = function (htmlString) {
  var post = new Space(this.toString())
  var format = post.get('format')
  var content = post.get('content')
  if (format === 'html')
    content = content
  // nl2br
  else if (format === 'markdown')
    content = marked(content)
  else
    content = content.replace(/\n/g, '<br>')
  htmlString = htmlString.replace(/Blog Post Content/g, content)
  htmlString = htmlString.replace(/Blog Post Title/g, post.get('title'))
  var timestamp = parseFloat(post.get('timestamp'))
  var date = moment(timestamp).format('MMMM Do YYYY, h:mm:ss a')
  htmlString = htmlString.replace(/Blog Post Date/g, date)
  htmlString = html_beautify(htmlString, {
    'indent-size' : 2,
    'indent-char' : ' ',
    'indent-inner-html' : true
  })
  return htmlString
}

Blog.Post.prototype.save = function () {
  var path = 'nudgepad/posts/' + this._filename
  expressfs.writeFile(path, this.toString(), function () {
    Alerts.success('Saved')
  })
}

Blog.Post.prototype.trash = function () {
  var path = 'nudgepad/posts/' + this._filename
  expressfs.unlink(path, function () {
    Alerts.success('Deleted')
  })
  Blog.delete('posts ' + this._filename)
}


