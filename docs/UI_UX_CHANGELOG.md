# ENG HUB — UI/UX update log

Date: 2026-11-18

## Responsive application shell
- Consolidated the final responsive rules at the end of the active stylesheet so the latest layout rules override older accumulated styles.
- Desktop (901px and wider): fixed right-hand navigation rail with a content column whose width and right margin are calculated from the same 272px rail width.
- Tablet and phone (900px and narrower): full-width content with a right-side off-canvas navigation drawer, scrim, and safe-area-aware bottom navigation.
- Sidebar navigation scrolls independently; account/help controls remain anchored at the bottom.
- Refined page padding, topbar geometry, search sizing, avatar cropping, and focus-visible states.

## Chat workspace
- Made the chat page a real flex column bounded by the available viewport height.
- Kept the conversation header, pinned-message strip, and composer fixed in the chat layout while the message history owns vertical scrolling.
- Added narrow-screen sizing for message bubbles, sender avatars, pinned messages, search, attachments, and the composer.
- Preserved existing Firebase realtime messaging and Cloudinary attachment flows, plus replies, editing, reactions, pinning, context actions, moderation, and image lightbox.

## Accessibility and usability
- Added Ctrl/Cmd+K to focus global search.
- Added Escape handling to close the mobile drawer and clear/blur focused global search.
- Strengthened keyboard focus rings and touch interaction feedback.
- Kept reduced-motion preferences respected.

## Cache refresh
- Bumped the service-worker shell cache to v6 and the registration query to v6 so clients can replace stale cached shell files after deployment.

## Scope and verification
- These changes are a layout and usability pass; they do not introduce direct messages or multiple chat rooms.
- Build/deploy status must be checked in GitHub Actions after this commit. A successful code commit alone is not proof of a successful Pages deployment.
- Firestore security rules remain separately deployed through Firebase Console.
