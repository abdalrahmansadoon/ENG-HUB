# ENG HUB — Brand, Learning Experience & Product Architecture

Updated: 18 November 2026

## 1. Brand identity

### Brand idea
ENG HUB is the engineering student's academic workspace: precise, dependable, practical and collaborative. The identity is built around a compact EH monogram rather than a decorative education mascot.

### Logo system
- Primary mark: geometric E in university cobalt and H in precision teal, placed on a midnight-navy rounded square.
- Horizontal wordmark: mark + ENG HUB name + "ENGINEERING LEARNING SPACE" descriptor.
- Use the mark for the application icon, favicon, compact mobile identity and loading surface.
- Use the horizontal wordmark on wide marketing/onboarding surfaces.
- Do not recolor the mark with arbitrary per-page colors. Preserve contrast and clear space.

Assets:
- `public/brand/enghub-mark.svg`
- `public/brand/enghub-wordmark.svg`
- `public/icons/icon.svg`

### Color tokens

| Purpose | Light | Dark |
|---|---|---|
| Page | `#F4F7FC` | `#0B1423` |
| Card | `#FFFFFF` | `#111F32` |
| Soft surface | `#F7F9FD` | `#17263C` |
| Primary text | `#17243A` | `#EDF3FB` |
| Secondary text | `#536781` | `#B2C1D5` |
| Primary accent | `#4169E1` | `#8AA6FF` |
| Teal accent | `#168D83` | `#53CBB9` |
| Warning | `#A96A12` | `#F0BF75` |
| Danger | `#C44759` | `#FA8996` |

Use accent colors for actions, progress and state—not for every surface. Body text should always inherit the semantic text tokens rather than hard-coded black or white.

### Typography
- Arabic UI: IBM Plex Sans Arabic, with Cairo/system fallback.
- Latin labels, codes and numeric details: Inter.
- Use a consistent hierarchy: page title, section title, card title, body, metadata.
- Keep labels readable; metadata must not be used for primary information.
- Avoid mixing font families within a single control or message.

## 2. Layout and interaction system

- Desktop: persistent right navigation rail (264px) with the main workspace taking the remaining width.
- Tablet/phone: right-side off-canvas navigation drawer; a safe-area-aware bottom navigation remains available for primary destinations.
- Sidebar scrolling is independent from the page; account controls stay at its bottom.
- Content width, cards and forms are fluid and should not cause horizontal scrolling.
- All controls have clear hover, pressed, disabled and keyboard-focus states.
- Respect `prefers-reduced-motion`; use short transitions for state feedback, not decorative motion that delays work.
- Light/dark modes use the same semantic components and spacing. Only tokens change.

## 3. Learning-platform research translated into ENG HUB

The research focused on established course systems and the information architecture they expose to learners.

### Coursera
Observed patterns include a course divided into modules, with videos, readings, assignments and discussion prompts; course pages also make the type and estimated duration of learning activities visible. ENG HUB uses this as a guide for describing a content item and keeping related assessments/resources discoverable.
Source: https://www.coursera.org/learn/how-to-create-an-online-course/

### Open edX
Open edX uses a deliberate hierarchy of sections, subsections and units. The course outline communicates progress and lets a learner resume a recently completed unit. ENG HUB adopts the navigable hierarchy and route-per-content idea, while allowing deeper/custom folders where engineering courses need them.
Sources:
- https://docs.openedx.org/en/latest/educators/concepts/open_edx_platform/about_course_outline.html
- https://docs.openedx.org/en/latest/educators/how-tos/set_up_course/manage_course_outline.html

### Udemy
The course player keeps curriculum navigation close to the player and exposes notes, Q&A and lecture resources from the learning context. Lecture resources are discoverable from the relevant lecture rather than only from a global files page. ENG HUB's related-content links follow this pattern.
Source: https://support.udemy.com/hc/en-us/sections/206457187-Course-player

### Moodle
Moodle recommends using sections/subsections and folders for file-heavy courses; its course index provides navigation to sections and resources. ENG HUB applies the same organizational principle but does not force every engineering subject into a fixed weekly or lecturer-first structure.
Sources:
- https://docs.moodle.org/501/en/Streamline_your_course_page
- https://docs.moodle.org/503/en/Course_homepage

## 4. Academic content model

A subject presents clear entry cards:
- Lectures
- Files and references
- Exams
- Assignments
- Additional resources
- Custom content

Inside each category, an administrator can create an arbitrary tree:
- Folder
- Lecturer
- Lecture / content group
- Video
- File
- Exam
- Assignment
- External link
- Note
- Custom type (custom icon, color, label and optional nested-container behavior)

This makes these arrangements possible:
- Subject → Lecturers → Lectures → multiple videos
- Subject → Lectures directly (for a course with one fixed lecturer)
- Subject → Folder → arbitrary mixed content
- Lecture → Video + several linked files + several linked exams
- Video → related notes/files/exams and other resources

Each node has a parent relationship for hierarchy and a list of linked node IDs for cross-links. A resource can therefore appear in the folder hierarchy and also be surfaced from the lecture/video it supports.

### Content authoring safeguards
- Draft content is hidden from students until published.
- Admin-created nodes can be edited or deleted.
- Deleting a container removes its descendants; confirm before deletion.
- Uploaded files are stored through Cloudinary; Firestore stores metadata and relationships.

## 5. Shareable navigation

The route layer uses hash-based URLs:
- Global pages: `#/home`, `#/tasks`, `#/chat`, `#/profile`, etc.
- Subject: `#/courses/{subjectId}`
- Subject category: `#/courses/{subjectId}/category/{category}`
- Nested content: `#/courses/{subjectId}/category/{category}/node/{nodeId}`
- Public student profile: `#/students/{uid}`

The UI responds to browser back/forward and hash changes. Copy-link controls should always copy the current complete URL, including its hash.

## 6. Chat experience and separation of concerns

- UI: `src/app/chat/ChatPage.tsx` and focused dialog components in `src/app/chat/`.
- Data/security services: `src/lib/chat.ts` and `firestore.rules`.
- Realtime messages, attachments, image gallery, replies, reactions, edit window, own soft-delete, hide-for-me, admin deletion, pinning, room wallpaper, announcements, warnings, room locking, timed mute and slow mode are kept in the service layer.
- Mobile message gestures: directional swipe to reply; long press opens the action menu.
- Desktop message actions: right-click opens the context menu.
- Per-user read cursors provide an unread divider and jump-to-latest affordance.
- Message action controls are not permanently displayed inside each bubble.

## 7. Current technical boundaries

- Firebase Authentication and Firestore remain the identity and data platform.
- Cloudinary handles binary uploads; Firestore stores their URLs and metadata.
- Firestore security rules are not automatically published by GitHub Pages. After rules changes, publish the repository's `firestore.rules` in Firebase Console.
- The current chat supports global and course rooms; it is not yet a full one-to-one direct messaging system.
- Build/deploy and live account testing must be reported separately. A commit is not proof of a successful Pages deployment.
