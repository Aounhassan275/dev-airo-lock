/* assets/access_page.js */
if (window.AccessControl) {
    window.AccessControl.init('page'); // Handles page and blog
} else {
    document.addEventListener('AccessControlReady', () => {
        window.AccessControl.init('page');
    });
}
