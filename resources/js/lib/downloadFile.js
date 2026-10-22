// Browser file download.
//
// The admin runs inside Shopify's app iframe, which permits downloads but can
// still refuse them (an older admin, a browser setting, a blocked object URL).
// Nothing surfaces an error when that happens, so this returns a boolean and
// callers offer a copy-to-clipboard fallback rather than leaving the merchant
// clicking a button that silently does nothing.

/**
 * @param {string} filename
 * @param {string} text
 * @param {string} mimeType
 * @returns {boolean} whether the download was successfully started
 */
export function downloadTextFile(filename, text, mimeType = 'text/csv;charset=utf-8') {
    try {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        // Must be in the document for the click to count as user-initiated in
        // Firefox; removed immediately afterwards.
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoked on the next tick — revoking synchronously races the download
        // in Safari, which has not read the blob yet when click() returns.
        setTimeout(() => URL.revokeObjectURL(url), 0);

        return true;
    } catch {
        return false;
    }
}

/** Clipboard fallback for when a download cannot start. */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);

        return true;
    } catch {
        return false;
    }
}
