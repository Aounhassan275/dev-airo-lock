/* assets/access_product.js */
if (window.AccessControl) {
    window.AccessControl.init('product');
} else {
    document.addEventListener('AccessControlReady', () => {
        window.AccessControl.init('product');
    });
}
