# GlassPad for GeForce NOW (Safari userscript)

An on-screen controller you can fully customize for **GeForce NOW** (play.geforcenow.com) in Safari on iPhone and iPad.
It adds a **virtual Xbox controller** to the page. GFN treats it like a real Bluetooth gamepad, so it works in
any game that supports controllers. It can also send **keyboard keys** and act as a **mouse**, for keyboard + mouse
games.

## Features
- Two analog sticks, a D-pad, ABXY, LB/RB/LT/RT, View/Menu, and L3/R3.
- Drag any control to move it. Change its size, opacity, colour, label and shape. Delete, duplicate or add controls.
- Each button can send **one or more** gamepad buttons, so you can make combos such as LB+RB.
- **Toggle mode** for a button: tap once to hold it, tap again to release. Handy for sprint or crouch.
- Stick modes:
  - **Fixed**: a normal stick.
  - **Floating**: the stick centres wherever your thumb lands.
  - **Swipe-to-look**: works like a touchpad for aiming the camera.
- Per-stick sensitivity, deadzone, touch-area size and invert Y.
- Slide your thumb from one button to another (for example A → B) without lifting it.
- Multi-touch, so you can move, aim and press buttons at the same time.
- **Profiles**, for example one layout per game, plus export and import as JSON.
- Hides itself when a real controller connects (you can turn this off).
- Clean frosted-glass look. If the stream stutters on an older device, turn off **Settings → Appearance → Frosted
  glass**. That keeps the look but skips the blur.
- **Fullscreen** button. See [Fullscreen](#fullscreen).
- Touches on the controls never reach the stream. Touches anywhere else still work as normal GFN mouse/touch input.

## Keyboard + mouse
There is a built-in **"Keyboard + Mouse"** profile. Pick it from **Settings → Layout profile**.
- **Left stick → W A S D.** Under *Key at the rim* you can add a key that is pressed when you push the stick all
  the way out (for example Shift to sprint).
- **Right side = mouse area.** Swipe to move the mouse or aim. A quick tap is a left click (you can turn this off).
- **Buttons:** Fire = left mouse, Aim = right mouse, plus Jump (Space), R, E, Q, Ctrl, Shift, 1/2/3, Esc and Tab.
- **🖱 button:** toggles GFN's mouse mode by hand. See "How the mouse works" below.

Any button can send keys:
- In edit mode, tap a button and type into *Keyboard / mouse*, for example `Shift + W`, `Space`, `F`, `Esc`, `LMB`,
  `RMB`, `WheelUp` or `WheelDown`.
- Or pick keys from the **+ Add key…** list.
- A single button can send keys and gamepad buttons together.

Other controls:
- **Sticks:** under *Output*, choose **Gamepad stick**, **Keys** (any four keys) or **Mouse**.
- **D-pad:** can send four keys instead, for example `Up, Left, Down, Right` for the arrow keys.
- **New controls:** use **+ Key** and **+ Mouse area** in edit mode. A mouse area has its own width, height,
  sensitivity and **Smoothing**. Higher smoothing gives silkier but slightly laggier aim; lower is snappier.
  The default is 0.35.

### How the mouse works
Safari on iPhone/iPad can't simulate mouse clicks or relative mouse movement for GFN, so the script uses GFN's
built-in **controller-as-mouse mode** instead:
- Double-pressing R3 switches that mode on. The script does this for you the first time you touch a mouse control.
- While the mode is on, the virtual controller's right stick moves the cursor, A is left click and LT is right
  click. The script turns your swipes into exactly those inputs.
- While mouse mode is on, GFN stops passing gamepad buttons to the game. Keyboard + mouse layouts aren't affected
  because they send real keys. Switching back to a gamepad-only profile turns the mode off again.
- Switching the mode on or off produces one left click at the cursor. GFN does the same with a real controller.
- The script can't see whether GFN's mouse mode is actually on, so it keeps its own record. If they get out of
  sync, tap the **🖱** button or **Settings → Mouse → Toggle** once. Symptoms of being out of sync:
  - swipes don't move the cursor, or move the camera like a stick instead;
  - in a gamepad layout, buttons do nothing.

## Install (iPhone / iPad)
1. Install **Userscripts** from the App Store (free, by Justin Wasack).
2. Open the **Userscripts** app and tap **Set Userscripts Directory**. Pick a folder, for example
   `iCloud Drive/Userscripts`.
3. Put `gfn-touch-controls.user.js` into that folder. From this PC you can use iCloud for Windows, or email or
   message the file to yourself and choose **Save to Files** on the phone.
4. Go to **Settings → Apps → Safari → Extensions → Userscripts**. Turn it **on** and set
   **play.geforcenow.com** to **Allow** (or allow All Websites).
5. Open **https://play.geforcenow.com** in a normal Safari tab. Tap the puzzle/**ᴀA** icon → **Userscripts** and
   check that "GlassPad for GeForce NOW" is enabled. Then reload the page.
6. A small glass pill appears at the top centre with three buttons:
   - **fullscreen**
   - **eye**: show or hide the controls
   - **settings** (the sliders icon): opens the menu

The **eye** hides the on-screen controls so you can tap GFN's own menus and the game directly, for example to pick
things in a menu. Tap it again to bring the controls back. The virtual controller stays connected while hidden, so
mouse mode and the game's input don't reset. To switch the virtual controller off completely, use
**Settings → Input → Virtual controller**.

> ⚠️ Safari extensions **do not run in Home Screen web apps**. Launch GFN from a normal Safari tab, not from the
> GeForce NOW icon on your Home Screen. If GFN insists you add it to the Home Screen before it will stream, the menu
> option **"Pretend to be the Home Screen app"** (on by default on iOS) makes the page think it already is.
> Turn it off and reload if it causes layout problems.

## Gyro aim
Aim by moving the phone. Turn it on under **Settings → Gyro aim**:
- **Off**
- **Always on**
- **While aiming:** only while you hold Aim / right-click, LT, or any button you give the **Gyro** key in edit mode.

Where the motion goes:
- **Keyboard + mouse layouts:** gyro moves the mouse through the same smooth mouse engine as the aim area. This is
  the real gyro-aim feel, and you can swipe and use gyro at the same time.
- **Gamepad layouts:** gyro tilts the right stick and adds to whatever your thumb is doing.

Details:
- **Axis layout:** Safari on iPhone labels the rotation axes differently from other browsers. The script works out
  the right layout by itself within a second or two of normal movement, by checking the rotation against how gravity
  shifts. The gyro status in the menu shows which layout it found.
- **Turning:** left/right follows real-world turning, using gravity to know which way is up. It works whether you
  hold the phone upright or tilted back like a handheld console. Tilting the top towards or away from you looks up
  or down.
- **Hand shake** is filtered out, so the aim stays steady when you hold still.
- **Paused** while the controls are hidden (eye button), the menu is open, or you're editing.
- **Settings:** sensitivity (default 10 cursor px per degree) and invert left/right or up/down. If a direction feels
  backwards on your phone, flip the matching invert switch.
- **Permission:** iPhone asks for motion access. Tap **Allow** in the Gyro section. After a reload, iOS asks again on
  your first tap of any control.

## Fullscreen
Tap the fullscreen icon in the top pill, or **Settings → Fullscreen**. Tap it again to exit.
- **iPad:** Safari supports fullscreen for web pages, so the whole page goes fullscreen and the controls stay on top.
- **iPhone:** Safari doesn't let websites go fullscreen; only videos can, and a fullscreen video would hide the
  controls. The button shows a hint instead. The closest you can get is to turn the phone to landscape and tap
  **ᴀA → Hide Toolbar**. That removes Safari's bars and leaves only a thin status strip.

## Customizing
- **Settings → ✎ Edit layout**
  - Drag controls to move them.
  - Tap a control to open its settings: size, opacity, label, colour, shape, toggle mode, which gamepad buttons it
    sends, and stick options.
  - Use **+ Button / + Key / + Stick / + D-pad / + Mouse area** to add controls.
  - Use **↺ Reset** to restore the defaults for the current profile.
  - Tap **✓ Done** when you're finished.
- While editing, the settings button can be dragged too.
- **Profiles**: **New** copies the current layout into a new profile. Switch profiles with the dropdown.
- **Export** copies the layout JSON to the clipboard. Paste JSON into the box and tap **Import** to load it.

Settings are saved per site in `localStorage`.

## Troubleshooting
- **No settings button**
  - Check the extension is allowed on play.geforcenow.com and the script is enabled.
  - Check you're in a Safari tab, not the Home Screen app.
  - Reload the page.
- **Controls show but the game ignores them**
  - Open settings. The status line should say `Virtual pad: connected` and `GFN reading it: yes`.
  - If GFN isn't reading the pad, tap **Reconnect virtual pad** once the game has started.
  - Make sure the game itself supports controllers.
- **Controls vanished**: a real controller was detected. Turn off "Hide when a real controller is connected".
- **Stuck input**: lift every finger. Inputs also reset when you leave Safari.
- **Keys do nothing**
  - Tap the game picture once so the stream has focus.
  - Check the game reacts to a real keyboard on GFN.
- **Mouse doesn't move**: tap **🖱** once to resync GFN's mouse mode (see above).

## Testing on a computer
Serve this folder (for example `python -m http.server`) and open `test.html`. The page loads the script and shows
the virtual gamepad's buttons and axes live. Use mouse clicks or touch emulation in DevTools.

The test page also logs key events and copies GFN's controller-as-mouse mode. The yellow dot is the cursor; it turns
red while the left button is held and blue while the right button is held.

## How it works
- The script runs in the page at `document-start`.
- It replaces `navigator.getGamepads()` so the result also includes a virtual pad using the `standard` mapping.
  The pad is a real `Gamepad` instance, gets a fresh snapshot on every state change, and fires `gamepadconnected`.
- One capture-phase listener on `window` is registered before GFN's own listeners. It handles touches on the
  overlay and stops them reaching GFN. All other events pass through untouched.
- The UI lives in a Shadow DOM, so GFN's CSS can't affect it.
- When GFN goes fullscreen (on iPad), the overlay moves into the fullscreen element so it stays visible.
- Keys are sent as synthetic `keydown`/`keyup` events with the right `code` and `keyCode`. GFN's streamer reads them
  from `document`.
- Mouse movement: finger movement is collected in pixels. Each time GFN polls the controller, the script sets the
  right-stick tilt that moves the cursor by that amount, using GFN's own speed formula.
  - **Smoothing window:** the movement is spread over a short window, so cursor speed follows your finger without
    bursts.
  - **Pixel tracking:** the script tracks GFN's whole-pixel stepping, including the leftover fraction GFN discards
    when the stick re-centres, so no movement is lost.
  - **Slow aim:** very slow movement, below GFN's minimum stick tilt, is sent as short, even one-pixel pulses.
  - **Timer correction:** it measures how fast GFN's 8 ms mouse timer really runs and adjusts, so speed stays
    consistent when the phone is busy.
