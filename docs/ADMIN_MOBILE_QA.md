# Admin Mobile QA

Check `/admin` while authenticated at these viewport widths:

- 360 x 800
- 390 x 844
- 430 x 932
- 768 x 1024
- Desktop regression at 1440 x 900

For every viewport:

- Open and close the burger menu; verify every permitted section is reachable.
- Open the notification center, mark one item and all items as read.
- Confirm no horizontal page overflow or controls outside the viewport.
- Verify tables render as labeled cards below 650px.
- Create or edit a house, service, review and user; verify modal actions remain visible.
- Open Calendar; switch between Day, Week and 2 weeks, filter by house and return to Today.
- Verify the calendar alone scrolls horizontally without moving the whole page.
- Open Settings; install the PWA when supported, enable push and send a test notification.
- Relaunch the installed PWA and confirm it opens at `/admin` without browser chrome.
- Sign out and confirm notification links require authentication.
