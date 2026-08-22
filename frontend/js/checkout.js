/* =========================================================
   PRIORITYFIXA COMMERCE — CHECKOUT
========================================================= */


/* =========================
   API
========================= */

const API_URL =
    "https://priorityfixa-income-api.priorityfixa.workers.dev";


/* =========================
   FORMAT PRICE
========================= */

function formatPrice(amount) {

    const currency =
        BUSINESS_CONFIG.location.currencySymbol;

    return `${currency} ${Number(amount).toLocaleString()}`;

}


/* =========================
   RENDER ORDER SUMMARY
========================= */

function renderCheckoutSummary() {

    const container =
        document.getElementById("checkout-summary");

    if (!container) {
        return;
    }


    const cart = getCart();


    if (cart.length === 0) {

        container.innerHTML = `

            <div class="empty-cart">

                <h2>
                    Your cart is empty
                </h2>

                <p>
                    Add products before checkout.
                </p>

                <a
                    href="index.html"
                    class="add-to-cart"
                >
                    Continue Shopping
                </a>

            </div>

        `;

        return;
    }


    let total = 0;


    const itemsHTML =
        cart.map(item => {

            const quantity =
                Number(item.quantity);

            const price =
                Number(item.price);

            const subtotal =
                price * quantity;

            total += subtotal;


            return `

                <div class="checkout-item">

                    <div>

                        <strong>
                            ${item.name}
                        </strong>

                        <p>
                            ${quantity} ×
                            ${formatPrice(price)}
                        </p>

                    </div>

                    <strong>
                        ${formatPrice(subtotal)}
                    </strong>

                </div>

            `;

        }).join("");


    container.innerHTML = `

        <h2>
            Order Summary
        </h2>

        <div class="checkout-items">

            ${itemsHTML}

        </div>

        <div class="checkout-total">

            <span>
                Total
            </span>

            <strong>
                ${formatPrice(total)}
            </strong>

        </div>

    `;


    updateCartCount();

}


/* =========================
   CUSTOMER DETAILS
========================= */

function getCustomerDetails() {

    return {

        name:
            document
                .getElementById("customer-name")
                .value
                .trim(),

        phone:
            document
                .getElementById("customer-phone")
                .value
                .trim(),

        email:
            document
                .getElementById("customer-email")
                .value
                .trim(),

        location:
            document
                .getElementById("customer-location")
                .value
                .trim()

    };

}


/* =========================
   CREATE ORDER
========================= */

async function handleCheckoutSubmit(event) {

    event.preventDefault();


    const cart = getCart();


    if (cart.length === 0) {

        alert(
            "Your cart is empty."
        );

        return;
    }


    const customer =
        getCustomerDetails();


    const submitButton =
        event.target.querySelector(
            'button[type="submit"]'
        );


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Creating Order...";

    }


    try {

        console.log(
            "Sending order to API..."
        );


        const response =
            await fetch(
                `${API_URL}/orders`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        customer:
                            customer,

                        items:
                            cart

                    })

                }
            );


        const result =
            await response.json();


        console.log(
            "API response:",
            result
        );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Order could not be created."
            );

        }


        console.log(
            "Order created:",
            result.order
        );


        alert(
            "Order created successfully.\n\n" +
            "Order ID: " +
            result.order.id
        );


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        alert(
            "There was a problem creating your order.\n\n" +
            error.message
        );


    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                "Continue to Payment";

        }

    }

}


/* =========================
   BUSINESS INFORMATION
========================= */

function loadCheckoutBusinessInformation() {

    if (
        typeof BUSINESS_CONFIG ===
        "undefined"
    ) {

        console.error(
            "BUSINESS_CONFIG is not loaded."
        );

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

function initializeCheckout() {

    loadCheckoutBusinessInformation();

    renderCheckoutSummary();


    const form =
        document.getElementById(
            "checkout-form"
        );


    if (!form) {

        console.error(
            "Checkout form not found."
        );

        return;

    }


    form.addEventListener(
        "submit",
        handleCheckoutSubmit
    );

}


document.addEventListener(
    "DOMContentLoaded",
    initializeCheckout
);
