// ==UserScript==
// @name         Refined GitHub Comments
// @license      MIT
// @homepageURL  https://github.com/bluwy/refined-github-comments
// @supportURL   https://github.com/bluwy/refined-github-comments
// @namespace    https://greasyfork.org/en/scripts/465056-refined-github-comments
// @version      0.1.0
// @description  Remove clutter in the comments view
// @author       Bjorn Lu
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

// common bots that i already know what they do
const authorsToMinimize = [
  'changeset-bot',
  'codeflowapp',
]

// common comments that don't really add value
const commentMatchToMinimize = [
  /^![a-z]/, // commands that start with !
  /^\/[a-z]/, // commands that start with /
  /^> root@0.0.0/, // astro preview release bot 
]

;(function () {
  'use strict'

  run()

  // listen to github page loaded event
  document.addEventListener('pjax:end', () => run())
  document.addEventListener('turbo:render', () => run())
})()

function run() {
  const allTimelineItem = document.querySelectorAll('.js-timeline-item')
  const seenComments = []

  allTimelineItem.forEach((timelineItem) => {
    minimizeComment(timelineItem)
    minimizeBlockquote(timelineItem, seenComments)
  })
}

// test urls:
// https://github.com/withastro/astro/pull/6845
/**
 * @param {HTMLElement} timelineItem
 */
function minimizeComment(timelineItem) {
  // things can happen twice in github for some reason
  if (timelineItem.querySelector('.refined-github-comments-toggle')) return
  
  const header = timelineItem.querySelector('.timeline-comment-header')
  if (!header) return

  const headerName = header.querySelector('a.author')
  if (!headerName) return

  const commentBody = timelineItem.querySelector('.comment-body')
  if (!commentBody) return

  const commentBodyText = commentBody.innerText.trim()

  // minimize the comment
  if (
    authorsToMinimize.includes(headerName.innerText) ||
    commentMatchToMinimize.some((match) => match.test(commentBodyText))
  ) {
    const commentContent = timelineItem.querySelector('.edit-comment-hide')
    if (!commentContent) return
    const commentActions = timelineItem.querySelector('.timeline-comment-actions')
    if (!commentActions) return
    const headerH3 = header.querySelector('h3')
    if (!headerH3) return
    const headerDiv = headerH3.querySelector('div')
    if (!headerDiv) return

    // hide comment
    header.style.borderBottom = 'none'
    commentContent.style.display = 'none'

    // add comment excerpt
    const excerpt = document.createElement('span')
    excerpt.setAttribute('class', 'text-fg-muted text-normal text-italic css-truncate css-truncate-overflow mr-2')
    excerpt.innerHTML = commentBodyText.slice(0, 100)
    excerpt.style.opacity = '0.5'
    headerH3.classList.add('css-truncate')
    headerH3.classList.add('css-truncate-overflow')
    headerDiv.appendChild(excerpt)

    // add toggle button
    const toggleBtn = toggleComment((isShow) => {
      if (isShow) {
        header.style.borderBottom = ''
        commentContent.style.display = ''
        excerpt.style.display = 'none'
      } else {
        header.style.borderBottom = 'none'
        commentContent.style.display = 'none'
        excerpt.style.display = ''
      }
    })
    commentActions.prepend(toggleBtn)
  }
}

// test urls:
// https://github.com/bluwy/refined-github-comments/issues/1
// https://github.com/sveltejs/svelte/issues/2323
// https://github.com/pnpm/pnpm/issues/6463
/**
 * @param {HTMLElement} timelineItem
 * @param {{ text: string, id: string }[]} seenComments
 */
function minimizeBlockquote(timelineItem, seenComments) {
  const commentBody = timelineItem.querySelector('.comment-body')
  if (!commentBody) return

  const commentId = timelineItem.querySelector('.timeline-comment-group')?.id
  if (!commentId) return

  const commentText = commentBody.innerText.trim().replace(/\s+/g, ' ')

  // bail early in first comment and if comment is already checked before
  if (seenComments.length === 0 || commentBody.querySelector('.refined-github-comments-reply-text')) {
    seenComments.push({ text: commentText, id: commentId })
    return
  }

  const blockquotes = commentBody.querySelectorAll(':scope > blockquote')
  for (const blockquote of blockquotes) {
    const blockquoteText = blockquote.innerText.trim().replace(/\s+/g, ' ')

    const dupIndex = seenComments.findIndex((comment) => comment.text === blockquoteText)
    if (dupIndex >= 0) {
      // if replying to the one above, always minimize it
      if (dupIndex === seenComments.length - 1) {
        // use js-clear so github would remove this summary when re-quoting this reply,
        // add nbsp so that the summary tag has some content, that the details would also
        // get copied when re-quoting too.
        const summary = `<span class="js-clear text-italic refined-github-comments-reply-text">Replying to above entirely</span>&nbsp;`
        blockquote.innerHTML = `<details><summary>${summary}</summary>${blockquote.innerHTML}</details>`
      }
      // if replying to a long comment, or a comment with code, always minimize it
      else if (blockquoteText.length > 200 || blockquote.querySelector('pre')) {
        const dup = seenComments[dupIndex]
        // use js-clear so github would remove this summary when re-quoting this reply,
        // add nbsp so that the summary tag has some content, that the details would also
        // get copied when re-quoting too.
        const summary = `<span class="js-clear text-italic refined-github-comments-reply-text">Replying to <a href="#${dup.id}">comment</a> entirely</span>&nbsp;`
        blockquote.innerHTML = `<details><summary>${summary}</summary>${blockquote.innerHTML}</details>`
      }
      continue
    }

    const partialDupIndex = seenComments.findIndex((comment) => comment.text.includes(blockquoteText))
    if (partialDupIndex >= 0) {
      // get first four words and last four words, craft a text fragment to highlight
      const splitted = blockquoteText.split(' ')
      const textFragment =  splitted.length < 9
        ? `#:~:text=${encodeURIComponent(blockquoteText)}`
        : `#:~:text=${encodeURIComponent(splitted.slice(0, 4).join(' '))},${encodeURIComponent(splitted.slice(-4).join(' '))}`
      
      // if replying to the one above, prepend hint
      if (partialDupIndex === seenComments.length - 1) {
        const hint = `<div dir="auto" class="text-italic mb-2 refined-github-comments-reply-text">Replying to above partially (<a href="${textFragment}">go to fragment</a>):</div>`
        blockquote.innerHTML = `${hint}${blockquote.innerHTML}`
      }
      // prepend generic hint
      else {
        const dup = seenComments[partialDupIndex]
        const hint = `<div dir="auto" class="text-italic mb-2 refined-github-comments-reply-text">Replying to <a href="#${dup.id}">comment</a> partially (<a href="${textFragment}">go to fragment</a>):</div>`
        blockquote.innerHTML = `${hint}${blockquote.innerHTML}`
      }
      continue
    }
  }

  seenComments.push({ text: commentText, id: commentId })
}

// create the toggle comment like github does when you hide a comment
function toggleComment(onClick) {
  const btn = document.createElement('button')
  // copied from github hidden comment style
  btn.innerHTML = `
<div class="color-fg-muted f6 no-wrap">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-unfold position-relative mr-1">
  <path d="m8.177.677 2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25a.75.75 0 0 1-1.5 0V4H5.104a.25.25 0 0 1-.177-.427L7.823.677a.25.25 0 0 1 .354 0ZM7.25 10.75a.75.75 0 0 1 1.5 0V12h2.146a.25.25 0 0 1 .177.427l-2.896 2.896a.25.25 0 0 1-.354 0l-2.896-2.896A.25.25 0 0 1 5.104 12H7.25v-1.25Zm-5-2a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>
  </svg>
  Show comment
</div>
<div class="color-fg-muted f6 no-wrap" style="display: none">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-fold position-relative mr-1">
    <path d="M10.896 2H8.75V.75a.75.75 0 0 0-1.5 0V2H5.104a.25.25 0 0 0-.177.427l2.896 2.896a.25.25 0 0 0 .354 0l2.896-2.896A.25.25 0 0 0 10.896 2ZM8.75 15.25a.75.75 0 0 1-1.5 0V14H5.104a.25.25 0 0 1-.177-.427l2.896-2.896a.25.25 0 0 1 .354 0l2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25Zm-6.5-6.5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>
  </svg>
  Hide comment
</div>
`
  const showNode = btn.querySelector('div:nth-child(1)')
  const hideNode = btn.querySelector('div:nth-child(2)')
  let isShow = false
  btn.setAttribute('type', 'button')
  btn.setAttribute('class', 'refined-github-comments-toggle timeline-comment-action btn-link')
  btn.style.marginTop = '2px'
  btn.style.marginRight = '4px'
  btn.addEventListener('click', () => {
    isShow = !isShow
    if (isShow) {
      showNode.style.display = 'none'
      hideNode.style.display = ''
    } else {
      showNode.style.display = ''
      hideNode.style.display = 'none'
    }
    onClick(isShow)
  })
  return btn
}
