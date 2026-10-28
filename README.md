
# File Integrity Checker

> An Information Security lab project that verifies file and text integrity using the SHA-256 cryptographic hash algorithm — entirely in the browser, with no backend.

---

## Objective

Demonstrate how cryptographic hash functions can be used to detect file and text modifications. A SHA-256 hash is a fixed-length "fingerprint" of any content. Even a single changed character produces a completely different hash, making it a reliable method for detecting tampering or accidental corruption.

---
<img width="1917" height="973" alt="Screenshot 2026-10-28 155205" src="https://github.com/user-attachments/assets/3fc1cbc8-736a-4315-b536-51d6b7814ad8" />

## What is SHA-256?

SHA-256 (Secure Hash Algorithm 256-bit) is a one-way cryptographic hash function that:

- Produces a fixed 256-bit (64 hexadecimal character) output for any input size.
- Is deterministic — the same content always produces the same hash.
- Is sensitive — a one-bit change in the input completely changes the output (avalanche effect).
- Is one-way — you cannot recover the original content from its hash.

SHA-256 is widely used in digital certificates, blockchain, file verification, and password storage.

---

## Features

### File Verification (Mode A)
- Upload any file from your computer (text, image, binary, or empty file).
- Calculates the SHA-256 hash of the **exact raw file bytes**.
- Displays file name, size, and MIME type.
- Save the hash as the original reference; verify any file against it.
- Drag-and-drop file support.

### Text Verification (Mode B)
- Type or paste any text into the text area.
- Calculates SHA-256 of the **exact UTF-8 encoded bytes** — no trimming or modification.
- Whitespace, punctuation, capitalisation, and line breaks are fully preserved.
- Save the hash; edit the text; verify to detect even a one-character change.
- Clear text and Copy Hash convenience buttons.

### Light / Dark Theme
- Toggle between light mode (warm off-white) and dark mode (deep charcoal) with a single click.
- Theme preference is **saved to `localStorage`** and restored on refresh.
- System theme preference is detected on first visit.
- Theme applied before paint to prevent a flash of the wrong theme.

### General
- Copy hash to clipboard.
- Reset each mode independently — reference hashes for file and text modes are always separate.
- Privacy notice: all processing is local; nothing is uploaded.
- Responsive layout for desktop and mobile.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 | Theming, layout, responsive design |
| JavaScript (ES2017+) | Application logic and DOM manipulation |
| Web Crypto API (`crypto.subtle.digest`) | SHA-256 hash computation |
| `TextEncoder` API | UTF-8 encoding for text mode |
| `localStorage` | Persisting theme preference |

**No frameworks, libraries, bundlers, or external dependencies are required.**

---

## Project Structure

```
file-integrity-checker/
├── index.html      ← Application layout (mode tabs, theme toggle, all workflow steps)
├── style.css       ← Full light/dark theming and all component styles
├── script.js       ← SHA-256 hashing for files and text, theme toggle, mode switching
├── .gitignore      ← Files excluded from version control
└── README.md       ← This file
```

---

## How to Run Locally

### Option 1 — Open directly in a browser (simplest)

1. Clone or download this repository.
2. Open `index.html` in **Google Chrome**, **Microsoft Edge**, or **Mozilla Firefox**.

> **Note:** The Web Crypto API requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). Opening with `file://` works in Chrome and Edge. For Firefox, use Option 2.

### Option 2 — Serve over localhost (recommended for Firefox)

If you have Python installed:

```bash
# Python 3
python -m http.server 8080

# Then open: http://localhost:8080
```

If you have Node.js installed:

```bash
npx serve .
```

---

## Testing — Step-by-Step Instructions

### File Mode

#### Test 1 — Verify an Unchanged File

1. Create `test.txt` with content: `Hello, World!`
2. Open the app → **Verify a File** tab → select `test.txt`.
3. Click **Calculate Hash** — note the 64-character hash.
4. Click **Save as Original**.
5. Select the same `test.txt` again.
6. Click **Verify Integrity**.
7. **Expected:** ✓ "File Integrity Verified — No Changes Detected."

#### Test 2 — Detect a Modified File

1. Using `test.txt` from Test 1 (with its hash saved), edit the file: change `Hello, World!` to `Hello, World!!` and save.
2. Select the modified `test.txt` in the app.
3. Click **Verify Integrity**.
4. **Expected:** ✗ "File Modified — Integrity Check Failed."

#### Test 3 — Same Name, Different Contents

1. Create two files both named `document.txt` but with different content.
2. Hash and save the first file's hash.
3. Select the second file (same name).
4. Click **Verify Integrity**.
5. **Expected:** Integrity check fails — proving content is checked, not just the filename.

#### Test 4 — Empty File

1. Create an empty file (`0 bytes`).
2. Select it and click **Calculate Hash**.
3. **Expected:** A valid 64-character hash is displayed.
   (SHA-256 of an empty file = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`)

#### Test 5 — Verify Without Saving a Reference

1. Calculate a hash without clicking Save.
2. Click **Verify Integrity**.
3. **Expected:** Warning — "Please calculate a hash and click Save as Original before verifying."

---

### Text Mode

#### Test 6 — Verify Unchanged Text

1. Switch to the **Verify Text** tab.
2. Type: `The quick brown fox jumps over the lazy dog`
3. Click **Calculate Hash** — note the hash.
4. Click **Save as Original**.
5. Do not change the text.
6. Click **Verify Integrity**.
7. **Expected:** ✓ "Text Integrity Verified — No Changes Detected."

#### Test 7 — Detect a One-Character Change

1. Using the saved hash from Test 6, change the text: replace `dog` with `Dog` (capitalise one letter).
2. Click **Verify Integrity**.
3. **Expected:** ✗ "Text Modified — Integrity Check Failed."

#### Test 8 — Detect a Trailing Space

1. Save the hash of `Hello` (no trailing space).
2. Add a trailing space: `Hello ` (one space after).
3. Verify.
4. **Expected:** Integrity check fails — confirming whitespace is preserved.

#### Test 9 — Empty Text

1. Leave the text area empty.
2. Click **Calculate Hash**.
3. **Expected:** A valid 64-character hash is displayed.
   (SHA-256 of empty UTF-8 = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`)

---

### Theme Tests

#### Test 10 — Light/Dark Toggle

1. Click the ☀/🌙 button in the top-right corner.
2. **Expected:** All components switch theme — background, cards, buttons, text area, hash display, saved hash panel, result panel, and footer all adapt.

#### Test 11 — Theme Persists After Refresh

1. Switch to dark mode.
2. Refresh the page.
3. **Expected:** Dark mode is restored; no flash of light mode.

#### Test 12 — Mode Isolation

1. In File mode, calculate and save a hash.
2. Switch to Text mode.
3. Try to Verify — it should ask you to save a Text mode reference, not use the file hash.
4. **Expected:** File and text reference hashes are completely separate.

---

## Sample Workflow

```
=== File Mode ===
Select:   report.pdf  (original, 48 KB)
Hash:     a3f1c9b2...d847e501  (64 hex chars)
Action:   Save as Original ✓

Select:   report.pdf  (after editing)
Hash:     7c2e4d81...b193f064  (completely different)
Result:   ✗ File Modified — Integrity Check Failed

=== Text Mode ===
Text:     "Access code: 4521"
Hash:     b9c3e1f0...a872d304
Action:   Save as Original ✓

Text:     "Access code: 4522"  (one digit changed)
Hash:     2d5f8c71...e139b047  (completely different)
Result:   ✗ Text Modified — Integrity Check Failed
```

---

## How SHA-256 Detects Changes

```
Original:   "Grade: A"   →  SHA-256: 4a9f3c...  (64 chars)
Modified:   "Grade: B"   →  SHA-256: d87b21...  (completely different)

Original:   "Hello"      →  SHA-256: 185f8db...
Modified:   "Hello "     →  SHA-256: 7509e5b...  (one trailing space — different!)
```

The avalanche effect ensures even a one-bit input change produces a completely different hash, making SHA-256 a reliable integrity check.

---

## Privacy and Security Notes

- **No data leaves your device.** All hashing is performed locally in the browser.
- **The Web Crypto API** is a browser built-in — no external libraries are needed.
- **Reference hashes** are stored only in JavaScript memory (not `localStorage`, cookies, or `indexedDB`). They disappear when you reset or close the tab.
- **Theme preference** is the only value written to `localStorage` — no hashes or file contents are ever persisted.
- This tool is designed for **educational purposes only**.

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Google Chrome 37+ | ✅ Full support |
| Microsoft Edge 79+ | ✅ Full support |
| Mozilla Firefox 34+ | ✅ (requires localhost or HTTPS) |
| Safari 11+ | ✅ Full support |

---

## Git Setup and GitHub Instructions

### Initialise a local repository

```bash
git init
git add .
git commit -m "Initial commit: File Integrity Checker using SHA-256"
```

### Push to GitHub

1. Create a new empty repository on [github.com](https://github.com).
2. Copy the remote URL.
3. Run:

```bash
git remote add origin https://github.com/your-username/file-integrity-checker.git
git branch -M main
git push -u origin main
```

---

## Educational Note

This project was built as part of an **Information Security laboratory activity** to demonstrate:

- The practical application of cryptographic hash functions (SHA-256).
- The avalanche effect — one-bit changes produce completely different hashes.
- How browsers can perform cryptographic operations securely using the Web Crypto API.
- File integrity verification as used in digital forensics and secure software distribution.
- Text integrity checking as a foundation for message authentication concepts.

---
<img width="1917" height="973" alt="Screenshot 2026-10-28 155205" src="https://github.com/user-attachments/assets/31b7e4d5-22d2-4ae6-a732-5beb7bb509ba" />

<img width="1917" height="976" alt="Screenshot 2026-10-28 155424" src="https://github.com/user-attachments/assets/e603306e-dbfd-4611-b625-d0d6da120f0f" />

*Information Security Lab | SHA-256 File Verification*
