function formatPrice(amount) {
    const currency =
        BUSINESS_CONFIG.location.currencySymbol;

    return `${currency} ${Number(amount).toLocaleString()}`;
}


function displayProducts() {

    const productGrid =
        document.getElementById("product-grid");

    if (!productGrid) {
        console.error("Product grid not found.");
        return;
    }

    if (typeof PRODUCTS === "undefined") {
        console.error("PRODUCTS is not loaded.");
        productGrid.innerHTML = `
            <p class="error-message">
                Products could not be loaded.
            </p>
        `;
        return;
    }

    const activeProducts = PRODUCTS.filter(
        product => product.status === "active"
    );

    if (activeProducts.length === 0) {
        productGrid.innerHTML = `
            <p class="empty-cart">
                No products available.
            </p>
        `;
        return;
    }

    productGrid.innerHTML = activeProducts.map(product => {

        return `
            <article class="product-card">

                <div class="product-image">
                    <img
                        src="${product.image}"
                        alt="${product.name}"
                        loading="lazy"
                    >
                </div>

                <div class="product-content">

                    <h2 class="product-name">
                        ${product.name}
                    </h2>

                    <p class="product-description">
                        ${product.description}
                    </p>

                    <strong class="product-price">
                        ${formatPrice(product.price)}
                    </strong>

                    <button
                        type="button"
                        class="add-to-cart"
                        data-product-id="${product.id}"
                    >
                        Add to Cart
                    </button>

                </div>

            </article>
        `;

    }).join("");

}


function loadBusinessInformation() {

    if (typeof BUSINESS_CONFIG === "undefined") {
        console.error("BUSINESS_CONFIG is not loaded.");
        return;
    }

    const businessName =
        document.getElementById("business-name");

    const storeTitle =
        document.getElementById("store-title");

    const storeTagline =
        document.getElementById("store-tagline");

    const footerBusinessName =
        document.getElementById("footer-business-name");


    if (businessName) {
        businessName.textContent =
            BUSINESS_CONFIG.name;
    }

    if (storeTitle) {
        storeTitle.textContent =
            "Products";
    }

    if (storeTagline) {
        storeTagline.textContent =
            BUSINESS_CONFIG.tagline;
    }

    if (footerBusinessName) {
        footerBusinessName.textContent =
            BUSINESS_CONFIG.name;
    }
}


document.addEventListener("DOMContentLoaded", () => {

    loadBusinessInformation();

    displayProducts();

    setupCartButtons();

    updateCartCount();

});
