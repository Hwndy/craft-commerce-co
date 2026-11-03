# Product brief and requirements

## 1. What we are building

**ALL LIFE** is a creative brand and portfolio. It turns inner drives and life experiences into visible work meant to uplift people. The first commercial line is handcrafted belts made from repurposed bike tyre with sand-cast aluminium buckles. The website expresses the brand as **light entering from darkness**.

The owner's purpose statement (paraphrased): the site expresses inner drives and urges, moulds wishes into practical visible works that serve people, and turns life experiences (inner and outer) into recognitions that lead to new resolves and finished work, bringing light into a world surrounded by darkness.

### Core developmental plan (concept board)

ALL LIFE sits at the centre. Light radiates out to **spheres**: Artworks, Photography, Interactivity, Colours, Forms, Sound, Time, Design, Concepts, Communication, Processes, Experience. Spheres are foundation pillars and are expected to spawn further spheres over time. The board in the site mirrors this: ALL LIFE at the centre, regions around it. For v1 the regions are **Gallery** (film and photo collage), **Shop**, **About** and **Contact**. The other spheres are future regions and must be addable without changing the engine.

## 2. Users

1. **The Admirer**: arrives from social media on an iPhone; wants a fast, striking experience.
2. **The Buyer**: wants to see each belt closely (turntable video), read price and description, and email the maker.
3. **The Collaborator / Press**: wants the story, film and photography, and a way to reach the owner.
4. **The Owner**: non-technical; edits content from a phone or laptop.

## 3. Navigation model

One canvas. Visitors can **explore** (drag to pan, pinch or scroll to zoom), follow a **guided path** that flies the camera region to region like slides, or use a plain **list view**. Zooming into a region enters it. Every region, photo and product has a URL that sets the camera. First-time visitors default to Guided mode (see `decisions.md`, D-12).

Primary journey: Landing, "Click to enter", transition (about 7 s), film plays full screen, first complete watch, collage, open a photo, cycle through, Shop, open a belt, watch the turntable video, send an enquiry email.

## 4. Requirements

Priority: **M**ust, **S**hould, **C**ould.

### FR-1 Landing to Gallery transition
- FR-1.1 (M) A "Click to enter" button on the landing page.
- FR-1.2 (M) On click the spinning seal gradually accelerates to about 5 to 7 times its idle speed.
- FR-1.3 (M) While accelerating, light rays emerge gradually from the central star.
- FR-1.4 (M) Rays intensify until the whole screen is filled with luminous light; the seal resolves into a finer, luminous (still 3D) form.
- FR-1.5 (M) The light fades calmly, revealing the Gallery with the film in full screen.
- FR-1.6 (M) Skip control; honour reduced motion (short fade, no strobing).
- FR-1.7 (S) Preload the gallery shell, film manifest and first segment during the spin-up so the reveal has no gap.

### FR-2 Gallery film
- FR-2.1 (M) The film plays full screen on arrival. Where browsers block autoplay with sound, start muted with an unmute prompt, or start on the tap that came from "Click to enter".
- FR-2.2 (M) Exit and scroll are locked until the first complete watch. State is remembered so a refresh does not re-lock unless the film changes.
- FR-2.3 (M) Controls: play/pause, volume, high-speed scrubbing.
- FR-2.4 (M) Landscape mode on phones; iPhone users can rotate without losing position.
- FR-2.5 (M) After the first watch: replay, or scroll/swipe on to the collage.
- FR-2.6 (S) Adaptive streaming (HLS); captions supported.
- FR-2.7 (S) Branded poster frame and buffering indicator.

### FR-3 Photo-shoot collage
- FR-3.1 (M) Circular / spherical collage ("Idea 2"). Diagonal strips ("Idea 1") kept as an alternate layout setting.
- FR-3.2 (M) Wide zoom and pan (pinch, wheel, drag).
- FR-3.3 (M) Selecting an image enlarges it full screen.
- FR-3.4 (M) Cycle forward and back by swipe, click or arrows; the last image loops to the first.
- FR-3.5 (M) Each image shows a short title and date.
- FR-3.6 (M) An X button and the Escape key close the viewer.
- FR-3.7 (M) Lazy loading with blur placeholders; preload the next image.
- FR-3.8 (S) Photo sets grouped by shoot; order controlled in admin.

### FR-4 Shop
- FR-4.1 (M) A "shop wall" and a "shop floor" display area.
- FR-4.2 (M) Each product label shows name, price and description.
- FR-4.3 (M) Each product enlarges and can be viewed as pictures or video, with a toggle.
- FR-4.4 (M) The enlarged version plays a rotating turntable video of the belt, with poster and picture fallback.
- FR-4.5 (M) Detail text supports bullet lines and a story paragraph.
- FR-4.6 (S) Status badges: Available, Sold, Made to order.
- FR-4.7 (C) Optional "sale" display flag.

Sample product from the board: **Sample Belt No.5**, black tyre belt with aluminium buckle, GBP 40. Bullets: belt made from repurposed bike tyre; buckle sand-cast using discarded aluminium.

### FR-5 Purchase by email
- FR-5.1 (M) "Buy / Enquire" opens the visitor's email app with a pre-filled subject and body (`mailto:`).
- FR-5.2 (M) Fallback enquiry form sends the same details through the server to the owner's inbox.
- FR-5.3 (S) Enquiries are stored and visible in the admin; the owner is emailed.
- FR-5.4 (S) Spam protection: honeypot, rate limit, Turnstile if abuse appears.

### FR-6 About and Contact
- FR-6.1 (M) About page with the purpose statement and brand story, editable in admin.
- FR-6.2 (M) Contact page with form, email link and social links.

### FR-7 Admin / CMS
- FR-7.1 (M) Secure owner login (Supabase Auth, invite-only, MFA recommended).
- FR-7.2 (M) Manage products: create, edit, reorder, status, pictures, turntable video, price, description.
- FR-7.3 (M) Manage gallery: photo sets, captions, dates, order, publish/unpublish (the film is developer-assisted in v1).
- FR-7.4 (M) Edit page copy and SEO fields.
- FR-7.5 (S) Enquiries inbox with read/unread and CSV export.
- FR-7.6 (M) Works well in a phone browser.
- FR-7.7 (C) Audit log of content changes.

### FR-8 Spatial canvas navigation
- FR-8.1 (M) Single canvas with ALL LIFE at the centre and regions around it.
- FR-8.2 (M) Drag to pan; wheel, pinch or double-tap to zoom; inertia, zoom limits, home control.
- FR-8.3 (M) Semantic zoom: label, then cards, then full content; passing a threshold enters the region's full-screen mode.
- FR-8.4 (M) Guided mode: next/previous flies the camera along a path (Landing, Film, Collage, Shop, About, Contact); Explore and Guided switch without losing position.
- FR-8.5 (M) Deep links for every region, photo and product; back/forward move between views.
- FR-8.6 (S) Minimap, current-region title, visible way back to the centre.
- FR-8.7 (M) Touch, mouse and keyboard input; no accidental browser zoom, pull-to-refresh or edge-swipe navigation.
- FR-8.8 (M) Node types: image, video, text, product card, button, link; position, size, rotation and layer stored in the database.
- FR-8.9 (M) List view with the same content as plain semantic pages; prerendered HTML per region; reduced-motion users get instant jumps.
- FR-8.10 (M) Only nodes near the viewport are mounted; 60 fps panning on a 2021 mid-range phone; low-power devices default to Guided mode.
- FR-8.11 (S) Automatic layout (rings and spirals) with numeric overrides in admin.

## 5. Content the owner must supply

The film (source MP4, ideally with captions), the seal asset and its source files, the photo-shoot images with titles and dates, product photos and turntable videos, About and Contact copy, social links, the enquiry email address, and a share image. Build with placeholders when content is late and mark them clearly in the UI during development only.
