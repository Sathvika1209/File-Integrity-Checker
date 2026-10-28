/**
 * File Integrity Checker — script.js
 *
 * Two independent verification modes:
 *   Mode A (file)  — hashes raw file bytes via File.arrayBuffer()
 *   Mode B (text)  — hashes UTF-8 encoded text via TextEncoder
 *
 * Both modes use crypto.subtle.digest('SHA-256', ...) from the
 * Web Crypto API.  Nothing is uploaded or sent to a server.
 *
 * Reference hashes for each mode are stored in plain variables
 * (session memory only) and cannot cross-contaminate each other.
 */

'use strict';

// ─── Shared utilities ────────────────────────────────────────────────────────

/**
 * Converts an ArrayBuffer of bytes into a lowercase hex string.
 * @param {ArrayBuffer} buffer
 * @returns {string} 64-character hex digest for SHA-256
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns a human-readable file size string.
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 bytes';
  if (bytes < 1024) return `${bytes} byte${bytes === 1 ? '' : 's'}`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/** Toast element (shared) */
const toast = document.getElementById('toast');
let toastTimer = null;

/**
 * Briefly shows a toast notification.
 * @param {string} message
 */
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

/**
 * Copies a string to the clipboard, with an execCommand fallback.
 * @param {string} text
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  showToast('Hash copied to clipboard.');
}

/**
 * Checks that crypto.subtle is available (requires a secure context).
 * @returns {boolean}
 */
function cryptoAvailable() {
  return !!(window.crypto && window.crypto.subtle);
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

const btnTheme  = document.getElementById('btn-theme');
const themeIcon = document.getElementById('theme-icon');

/**
 * Applies the given theme ('light' | 'dark') to the <html> element
 * and updates the toggle button icon.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // ☀ for light mode (click to switch to dark), 🌙 for dark mode (click to switch to light)
  themeIcon.textContent = theme === 'dark' ? '🌙' : '☀';
  themeIcon.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

/**
 * Reads the saved theme from localStorage, falling back to the OS preference.
 * @returns {'light'|'dark'}
 */
function resolveTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* localStorage blocked */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Initialise icon (the <html> data-theme was already set by the inline script in <head>)
applyTheme(resolveTheme());

btnTheme.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch { /* blocked */ }
});

// ─── Tab switching ─────────────────────────────────────────────────────────────

const tabFile  = document.getElementById('tab-file');
const tabText  = document.getElementById('tab-text');
const panelFile = document.getElementById('panel-file');
const panelText = document.getElementById('panel-text');

function switchTab(mode) {
  const isFile = (mode === 'file');

  tabFile.classList.toggle('active', isFile);
  tabText.classList.toggle('active', !isFile);
  tabFile.setAttribute('aria-selected', String(isFile));
  tabText.setAttribute('aria-selected', String(!isFile));

  panelFile.hidden = !isFile;
  panelText.hidden =  isFile;
}

tabFile.addEventListener('click', () => switchTab('file'));
tabText.addEventListener('click', () => switchTab('text'));

// ═══════════════════════════════════════════════════════════════════════════════
// MODE A — FILE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
/**
 * Reference SHA-256 hash saved for file mode.
 * Stored as a plain variable — session memory only.
 * @type {string|null}
 */
let fileSavedHash   = null;

/** Most recently computed hash in file mode. @type {string|null} */
let fileCurrentHash = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const fileInput         = document.getElementById('file-input');
const uploadArea        = document.getElementById('upload-area');
const fileInfoPanel     = document.getElementById('file-info-panel');
const fileNameEl        = document.getElementById('file-name');
const fileSizeEl        = document.getElementById('file-size');
const fileTypeEl        = document.getElementById('file-type');
const fileHashBlock     = document.getElementById('file-hash-block');
const fileHashValue     = document.getElementById('file-hash-value');
const fileHashStatus    = document.getElementById('file-hash-status');
const fileSavedPanel    = document.getElementById('file-saved-panel');
const fileSavedValue    = document.getElementById('file-saved-value');
const fileResultPanel   = document.getElementById('file-result-panel');
const fileResultStatus  = document.getElementById('file-result-status');
const fileResultDesc    = document.getElementById('file-result-desc');
const fileBtnCalc       = document.getElementById('file-btn-calculate');
const fileBtnCopy       = document.getElementById('file-btn-copy');
const fileBtnSave       = document.getElementById('file-btn-save');
const fileBtnVerify     = document.getElementById('file-btn-verify');
const fileBtnReset      = document.getElementById('file-btn-reset');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Show / hide the spinner in the file hash block. */
function setFileHashLoading(loading) {
  if (loading) {
    fileHashStatus.innerHTML = '<span class="spinner"></span> Calculating…';
    fileHashValue.textContent = '';
    fileHashValue.classList.add('empty');
    fileBtnCalc.disabled = true;
  } else {
    fileHashStatus.textContent = '';
    fileBtnCalc.disabled = false;
  }
}

/** Hide the file verification result panel. */
function clearFileResult() {
  fileResultPanel.classList.remove('visible', 'success', 'failure', 'warning');
}

/**
 * Display a result in the file result panel.
 * @param {'success'|'failure'|'warning'} type
 * @param {string} headline
 * @param {string} detail
 */
function showFileResult(type, headline, detail) {
  fileResultPanel.classList.remove('success', 'failure', 'warning');
  fileResultPanel.classList.add(type, 'visible');
  fileResultStatus.textContent = headline;
  fileResultDesc.textContent   = detail;
}

/** Reset all file-mode state and UI to the initial state. */
function resetFileMode() {
  fileSavedHash   = null;
  fileCurrentHash = null;
  fileInput.value = '';

  fileInfoPanel.classList.remove('visible');
  fileSavedPanel.classList.remove('visible');
  clearFileResult();

  // Keep hash block visible but restore placeholder
  fileHashBlock.classList.add('visible');
  fileHashValue.textContent = 'Select a file above to begin.';
  fileHashValue.classList.add('empty');
  fileHashStatus.textContent = '';
  fileSavedValue.textContent  = '';

  fileBtnCalc.disabled   = true;
  fileBtnCopy.disabled   = true;
  fileBtnSave.disabled   = true;
  fileBtnVerify.disabled = true;
}

// ── Event: file selected (change + drag-drop) ─────────────────────────────────

/**
 * Called when the user picks or drops a file.
 * Shows metadata and enables the Calculate button.
 * @param {File} file
 */
function handleFileSelected(file) {
  if (!file) return;

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatSize(file.size);
  fileTypeEl.textContent = file.type || 'Unknown / binary';
  fileInfoPanel.classList.add('visible');

  // Reset hash display but keep any saved reference
  fileCurrentHash = null;
  fileHashValue.textContent = 'Click "Calculate Hash" to generate the SHA-256 hash.';
  fileHashValue.classList.add('empty');
  fileHashStatus.textContent = '';
  fileHashBlock.classList.add('visible');
  clearFileResult();

  fileBtnCalc.disabled   = false;
  fileBtnCopy.disabled   = true;
  fileBtnSave.disabled   = true;
  // Allow Verify immediately only if we already have a reference
  fileBtnVerify.disabled = (fileSavedHash === null);
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
});

// Drag-and-drop
uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

['dragleave', 'dragend'].forEach(evt =>
  uploadArea.addEventListener(evt, () => uploadArea.classList.remove('drag-over'))
);

uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Sync with the hidden file input
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  handleFileSelected(file);
});

// Keyboard accessibility for the upload area
uploadArea.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// ── Event: Calculate Hash ─────────────────────────────────────────────────────

fileBtnCalc.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) { showToast('Please choose a file first.'); return; }
  if (!cryptoAvailable()) {
    showFileResult('failure', '✗ Error',
      'Your browser does not support the Web Crypto API. Please use a modern browser over HTTPS or localhost.');
    return;
  }

  clearFileResult();
  setFileHashLoading(true);
  fileBtnSave.disabled = true;
  fileBtnCopy.disabled = true;

  try {
    // Hash the raw file bytes
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer  = await crypto.subtle.digest('SHA-256', arrayBuffer);
    fileCurrentHash   = bufferToHex(hashBuffer);

    fileHashValue.textContent = fileCurrentHash;
    fileHashValue.classList.remove('empty');
    fileBtnSave.disabled   = false;
    fileBtnCopy.disabled   = false;
    fileBtnVerify.disabled = (fileSavedHash === null);
  } catch (err) {
    showFileResult('failure', '✗ Hashing Error', err.message);
    fileCurrentHash = null;
  } finally {
    setFileHashLoading(false);
  }
});

// ── Event: Save Original Hash ─────────────────────────────────────────────────

fileBtnSave.addEventListener('click', () => {
  if (!fileCurrentHash) { showToast('Calculate a hash first.'); return; }
  fileSavedHash = fileCurrentHash;
  fileSavedValue.textContent = fileSavedHash;
  fileSavedPanel.classList.add('visible');
  fileBtnVerify.disabled = false;
  clearFileResult();
  showToast('Original file hash saved for this session.');
});

// ── Event: Verify Integrity ───────────────────────────────────────────────────

fileBtnVerify.addEventListener('click', async () => {
  if (!fileSavedHash) {
    showFileResult('warning', '⚠ No Reference Hash',
      'Please calculate a hash and click "Save as Original" before verifying.');
    return;
  }

  const file = fileInput.files[0];
  if (!file) { showToast('Please choose a file to verify.'); return; }

  // If no hash yet for the current file, compute it now
  if (!fileCurrentHash) {
    if (!cryptoAvailable()) {
      showFileResult('failure', '✗ Error', 'Web Crypto API unavailable.');
      return;
    }
    setFileHashLoading(true);
    try {
      const buf     = await file.arrayBuffer();
      const hBuf    = await crypto.subtle.digest('SHA-256', buf);
      fileCurrentHash = bufferToHex(hBuf);
      fileHashValue.textContent = fileCurrentHash;
      fileHashValue.classList.remove('empty');
      fileBtnSave.disabled = false;
      fileBtnCopy.disabled = false;
    } catch (err) {
      showFileResult('failure', '✗ Hashing Error', err.message);
      setFileHashLoading(false);
      return;
    }
    setFileHashLoading(false);
  }

  // Compare hashes
  if (fileCurrentHash === fileSavedHash) {
    showFileResult('success',
      '✓ File Integrity Verified — No Changes Detected',
      'The SHA-256 hash of the selected file matches the saved original hash exactly. The file has not been altered.');
  } else {
    showFileResult('failure',
      '✗ File Modified — Integrity Check Failed',
      'The SHA-256 hash does not match the saved original hash. The file content has changed or a different file was selected.');
  }
});

// ── Event: Copy Hash ──────────────────────────────────────────────────────────

fileBtnCopy.addEventListener('click', async () => {
  if (!fileCurrentHash) { showToast('No hash to copy yet.'); return; }
  await copyToClipboard(fileCurrentHash);
});

// ── Event: Reset ──────────────────────────────────────────────────────────────

fileBtnReset.addEventListener('click', () => {
  resetFileMode();
  showToast('File mode reset. Ready for a new file.');
});

// Initialise disabled states for file mode
fileBtnCalc.disabled   = true;
fileBtnCopy.disabled   = true;
fileBtnSave.disabled   = true;
fileBtnVerify.disabled = true;


// ═══════════════════════════════════════════════════════════════════════════════
// MODE B — TEXT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
/**
 * Reference SHA-256 hash saved for text mode.
 * Completely separate from fileSavedHash — the two can never interfere.
 * @type {string|null}
 */
let textSavedHash   = null;

/** Most recently computed hash in text mode. @type {string|null} */
let textCurrentHash = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const textInput        = document.getElementById('text-input');
const textHashBlock    = document.getElementById('text-hash-block');
const textHashValue    = document.getElementById('text-hash-value');
const textHashStatus   = document.getElementById('text-hash-status');
const textSavedPanel   = document.getElementById('text-saved-panel');
const textSavedValue   = document.getElementById('text-saved-value');
const textResultPanel  = document.getElementById('text-result-panel');
const textResultStatus = document.getElementById('text-result-status');
const textResultDesc   = document.getElementById('text-result-desc');
const textBtnCalc      = document.getElementById('text-btn-calculate');
const textBtnCopy      = document.getElementById('text-btn-copy');
const textBtnSave      = document.getElementById('text-btn-save');
const textBtnVerify    = document.getElementById('text-btn-verify');
const textBtnReset     = document.getElementById('text-btn-reset');
const textBtnClearInput = document.getElementById('text-btn-clear-input');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Show / hide the spinner in the text hash block. */
function setTextHashLoading(loading) {
  if (loading) {
    textHashStatus.innerHTML = '<span class="spinner"></span> Calculating…';
    textHashValue.textContent = '';
    textHashValue.classList.add('empty');
    textBtnCalc.disabled = true;
  } else {
    textHashStatus.textContent = '';
    textBtnCalc.disabled = false;
  }
}

/** Hide the text verification result panel. */
function clearTextResult() {
  textResultPanel.classList.remove('visible', 'success', 'failure', 'warning');
}

/**
 * Display a result in the text result panel.
 * @param {'success'|'failure'|'warning'} type
 * @param {string} headline
 * @param {string} detail
 */
function showTextResult(type, headline, detail) {
  textResultPanel.classList.remove('success', 'failure', 'warning');
  textResultPanel.classList.add(type, 'visible');
  textResultStatus.textContent = headline;
  textResultDesc.textContent   = detail;
}

/** Reset all text-mode state and UI to the initial state. */
function resetTextMode() {
  textSavedHash   = null;
  textCurrentHash = null;
  textInput.value = '';

  textSavedPanel.classList.remove('visible');
  clearTextResult();

  textHashBlock.classList.add('visible');
  textHashValue.textContent = 'Enter text above and click Calculate Hash.';
  textHashValue.classList.add('empty');
  textHashStatus.textContent = '';
  textSavedValue.textContent  = '';

  textBtnCopy.disabled   = true;
  textBtnSave.disabled   = true;
  textBtnVerify.disabled = true;
}

/**
 * Computes the SHA-256 hash of a plain string using UTF-8 encoding.
 * Whitespace, punctuation, capitalisation, and line breaks are preserved.
 * @param {string} text
 * @returns {Promise<string>} 64-character hex digest
 */
async function computeTextSHA256(text) {
  // Encode the string to UTF-8 bytes — no trimming, no normalisation
  const encoded     = new TextEncoder().encode(text);
  const hashBuffer  = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

// ── Event: Calculate Hash ─────────────────────────────────────────────────────

textBtnCalc.addEventListener('click', async () => {
  // Empty text is valid — SHA-256 of empty input is a well-defined value
  const text = textInput.value; // NOT trimmed — preserve exact bytes

  if (!cryptoAvailable()) {
    showTextResult('failure', '✗ Error',
      'Your browser does not support the Web Crypto API. Please use a modern browser over HTTPS or localhost.');
    return;
  }

  clearTextResult();
  setTextHashLoading(true);
  textBtnSave.disabled = true;
  textBtnCopy.disabled = true;

  try {
    textCurrentHash = await computeTextSHA256(text);

    textHashValue.textContent = textCurrentHash;
    textHashValue.classList.remove('empty');
    textBtnSave.disabled   = false;
    textBtnCopy.disabled   = false;
    textBtnVerify.disabled = (textSavedHash === null);
  } catch (err) {
    showTextResult('failure', '✗ Hashing Error', err.message);
    textCurrentHash = null;
  } finally {
    setTextHashLoading(false);
  }
});

// ── Event: Save Original Hash ─────────────────────────────────────────────────

textBtnSave.addEventListener('click', () => {
  if (!textCurrentHash) { showToast('Calculate a hash first.'); return; }
  textSavedHash = textCurrentHash;
  textSavedValue.textContent = textSavedHash;
  textSavedPanel.classList.add('visible');
  textBtnVerify.disabled = false;
  clearTextResult();
  showToast('Original text hash saved for this session.');
});

// ── Event: Verify Integrity ───────────────────────────────────────────────────

textBtnVerify.addEventListener('click', async () => {
  if (!textSavedHash) {
    showTextResult('warning', '⚠ No Reference Hash',
      'Please calculate a hash and click "Save as Original" before verifying.');
    return;
  }

  if (!cryptoAvailable()) {
    showTextResult('failure', '✗ Error', 'Web Crypto API unavailable.');
    return;
  }

  // Always re-hash the current textarea contents at verify time
  // so the comparison reflects any edits made since the last Calculate
  setTextHashLoading(true);
  try {
    // Read the exact current value — no trimming
    textCurrentHash = await computeTextSHA256(textInput.value);
    textHashValue.textContent = textCurrentHash;
    textHashValue.classList.remove('empty');
    textBtnSave.disabled = false;
    textBtnCopy.disabled = false;
  } catch (err) {
    showTextResult('failure', '✗ Hashing Error', err.message);
    setTextHashLoading(false);
    return;
  }
  setTextHashLoading(false);

  // Compare
  if (textCurrentHash === textSavedHash) {
    showTextResult('success',
      '✓ Text Integrity Verified — No Changes Detected',
      'The SHA-256 hash of the current text matches the saved original hash exactly. The text has not been altered.');
  } else {
    showTextResult('failure',
      '✗ Text Modified — Integrity Check Failed',
      'The SHA-256 hash does not match the saved original. Even a single character change — including spaces, punctuation, or capitalisation — produces a different hash.');
  }
});

// ── Event: Copy Hash ──────────────────────────────────────────────────────────

textBtnCopy.addEventListener('click', async () => {
  if (!textCurrentHash) { showToast('No hash to copy yet.'); return; }
  await copyToClipboard(textCurrentHash);
});

// ── Event: Clear text input ───────────────────────────────────────────────────

textBtnClearInput.addEventListener('click', () => {
  textInput.value = '';
  textInput.focus();
  // Invalidate the current hash since the input changed
  textCurrentHash = null;
  textHashValue.textContent = 'Enter text above and click Calculate Hash.';
  textHashValue.classList.add('empty');
  textHashStatus.textContent = '';
  textBtnCopy.disabled   = true;
  textBtnSave.disabled   = true;
  textBtnVerify.disabled = (textSavedHash === null);
  clearTextResult();
});

// ── Event: Reset ──────────────────────────────────────────────────────────────

textBtnReset.addEventListener('click', () => {
  resetTextMode();
  showToast('Text mode reset. Ready for new text.');
});

// Initialise disabled states for text mode
textBtnCopy.disabled   = true;
textBtnSave.disabled   = true;
textBtnVerify.disabled = true;
