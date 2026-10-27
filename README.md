# alire.org

Static site served by GitHub Pages.

- `/` redirects to the warehouse map (Google Apps Script web app), as before.
- `/tool/label-sorter/` is the Whatnot Label Sorter, a single HTML file that runs entirely in the browser.

The sorter's source of truth is `whatnot-pick-list/label-sorter.html` (artifact body); `build-standalone.sh`
there produces the copy committed here. To update: rebuild, copy to `tool/label-sorter/index.html`, commit, push.
