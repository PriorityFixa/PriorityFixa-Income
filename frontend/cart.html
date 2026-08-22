/* =========================================================
   PRIORITYFIXA COMMERCE — CART PAGE
========================================================= */


function renderCart() {

    const container =
        document.getElementById("cart-container");

    if (!container) {
        return;
    }


    const cart = getCart();


    /* =========================
       EMPTY CART
    ========================== */

    if (cart.length === 0) {

        container.innerHTML = `

            <div class="empty-cart">

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    You haven't added any products yet.
                </p>

                <a
                    href="index.html"
                    class="add-to-cart"
                >
                    Continue Shopping
                </a>

            </div>

        `;

        updateCartCount();

        return;
    }


    /* =========================
       CART ITEMS
    ========================== */

    let cartTotal = 0;


    const itemsHTML = cart.map(item => {

        const quantity =
            Number(item.quantity);

        const price =
            Number(item.price);

        const subtotal =
            price * quantity;

        cartTotal += subtotal;


        return `

            <article
                class="cart-item"
                data-product-id="${item.id}"
            >

                <div class="cart-item-image">

                    <img
                        src="${item.image}"
                        alt="${item.name}"
                    >

                </div>


                <div class="cart-item-details">

                    <h2>
                        ${item.name}
                    </h2>

                    <p>
                        ${formatPrice(price)}
                    </p>


                    <div class="cart-quantity">

                        <button
                            type="button"
                            class="quantity-minus"
                            data-product-id="${item.id}"
                        >
                            −
                        </button>


                        <span>
                            ${quantity}
                        </span>


                        <button
                            type="button"
                            class="quantity-plus"
                            data-product-id="${item.id}"
                        >
                            +
                        </button>

                    </div>


                    <strong>
                        ${formatPrice(subtotal)}
                    </strong>


                    <button
                        type="button"
                        class="remove-item"
                        data-product-id="${item.id}"
                    >
                        Remove
                    </button>

                </div>

            </article>

        `;

    }).join("");


    /* =========================
       CART OUTPUT
    ========================== */

    container.innerHTML = `

        <div class="cart-list">

            ${itemsHTML}

        </div>


        <div class="cart-summary">

            <h2>
                Order Summary
            </h2>


            <div class="cart-total">

                <span>
                    Total
                </span>

                <strong>
                    ${formatPrice(cartTotal)}
                </strong>

            </div>


            <a
                href="index.html"
                class="secondary-button"
            >
                Continue Shopping
            </a>


            <a
                href="checkout.html"
                class="add-to-cart"
            >
                Proceed to Checkout
            </a>

        </div>

    `;


    setupCartPageButtons();

    updateCartCount();

}


/* =========================
   QUANTITY UPDATE
========================= */

function changeQuantity(productId, change) {

    const cart = getCart();


    const item =
        cart.find(
            product =>
                String(product.id) === String(productId)
        );


    if (!item) {
        return;
    }


    item.quantity =
        Number(item.quantity) + change;


    if (item.quantity <= 0) {

        const updatedCart =
            cart.filter(
                product =>
                    String(product.id) !==
                    String(productId)
            );

        saveCart(updatedCart);

    } else {

        saveCart(cart);

    }


    renderCart();

}


/* =========================
   REMOVE ITEM
========================= */

function removeFromCart(productId) {

    const cart = getCart();


    const updatedCart =
        cart.filter(
            item =>
                String(item.id) !== String(productId)
        );


    saveCart(updatedCart);

    renderCart();

}


/* =========================
   BUTTON EVENTS
========================= */

function setupCartPageButtons() {

    const plusButtons =
        document.querySelectorAll(
            ".quantity-plus"
        );


    const minusButtons =
        document.querySelectorAll(
            ".quantity-minus"
        );


    const removeButtons =
        document.querySelectorAll(
            ".remove-item"
        );


    plusButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                changeQuantity(
                    button.dataset.productId,
                    1
                );

            }
        );

    });


    minusButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                changeQuantity(
                    button.dataset.productId,
                    -1
                );

            }
        );

    });


    removeButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                removeFromCart(
                    button.dataset.productId
                );

            }
        );

    });

}


/* =========================
   BUSINESS INFORMATION
========================= */

function loadCartBusinessInformation() {

    if (
        typeof BUSINESS_CONFIG ===
        "undefined"
    ) {
        return;
    }


    const businessName =
        document.getElementById(
            "business-name"
        );


    const footerBusinessName =
        document.getElementById(
            "footer-business-name"
        );


    if (businessName) {

        businessName.textContent =
            BUSINESS_CONFIG.name;

    }


    if (footerBusinessName) {

        footerBusinessName.textContent =
            BUSINESS_CONFIG.name;

    }

}


/* =========================
   INITIALIZE
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadCartBusinessInformation();

        renderCart();

    }
);
