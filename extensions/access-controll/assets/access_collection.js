/* assets/access_collection.js */
if (window.AccessControl) {
    window.AccessControl.init('collection');
} else {
    document.addEventListener('AccessControlReady', () => {
        window.AccessControl.init('collection');
    });
}
