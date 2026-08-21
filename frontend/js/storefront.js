function formatPrice(amount) {
    const currency = BUSINESS_CONFIG.location.currencySymbol;

    return `${currency} ${amount.toLocaleString()}`;
}


function displayProducts() {

    const productGrid = document.getElementById("product-grid");

    if (!productGrid) {
        return;
    }

    const activeProducts = PRODUCTS.filter(
        product => product.status === "active"
    );

    if (activeProducts.length === 0) {
        productGrid.innerHTML = `
            <p>No products available.</p>
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

                    <h2>${product.name}</h2>

                    <p>
                        ${product.description}
                    </p>

                    <strong>
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
            BUSINESS_CONFIG.name;
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

});
