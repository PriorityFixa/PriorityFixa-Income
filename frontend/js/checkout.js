/* =========================================================
   PRIORITYFIXA COMMERCE — CHECKOUT
========================================================= */


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
                    Add products before proceeding to checkout.
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


    const itemsHTML = cart.map(item => {

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
                        ${quantity} × ${formatPrice(price)}
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
   CUSTOMER INFORMATION
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
   CHECKOUT SUBMISSION
========================= */

async function handleCheckoutSubmit(event) {

    event.preventDefault();

    const cart = getCart();

    if (cart.length === 0) {

        alert("Your cart is empty.");

        return;
    }


    const customer = getCustomerDetails();


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

        const response = await fetch(
            "https://priorityfixa-income-api.priorityfixa.workers.dev/orders",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    customer: customer,

                    items: cart

                })

            }
        );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

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
            "Order created successfully. Order ID: " +
            result.order.id
        );


        /*
         * PAYMENT WILL BE CONNECTED
         * AFTER ORDER CREATION IS VERIFIED.
         */


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        alert(
            "There was a problem creating your order. Please try again."
        );


    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                "Continue to Payment";

        }

    }

}


    const customer =
        getCustomerDetails();


    console.log(
        "Customer:",
        customer
    );


    console.log(
        "Order:",
        cart
    );


    /*
       PAYMENT WILL BE CONNECTED
       IN THE NEXT STEP.
    */


    alert(
        "Customer details received. Payment will be connected next."
    );

}


/* =========================
   BUSINESS INFORMATION
========================= */

function loadCheckoutBusinessInformation() {

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

function initializeCheckout() {

    loadCheckoutBusinessInformation();

    renderCheckoutSummary();


    const form =
        document.getElementById(
            "checkout-form"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleCheckoutSubmit
        );

    }

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCheckout
    );

} else {

    initializeCheckout();

}
