```javascript
/* =========================================================
   PRIORITYFIXA COMMERCE — CHECKOUT
========================================================= */


/* =========================
   API
========================= */

const API_URL =
    "https://priorityfixa-income-api.priorityfixa.workers.dev";


/* =========================
   PAYMENT POLLING
========================= */

let paymentPollingTimer = null;
let paymentPollingActive = false;


/* =========================
   FORMAT PRICE
========================= */

function formatPrice(amount) {

    const currency =
        BUSINESS_CONFIG.location.currencySymbol;

  
      return currency + " " + Number(amount).toLocaleString();
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
   PAYMENT STATUS UI
========================= */

function showPaymentStatus(
    type,
    title,
    message,
    receipt = null
) {

    let statusContainer =
        document.getElementById(
            "payment-status"
        );

    if (!statusContainer) {

        const form =
            document.getElementById(
                "checkout-form"
            );

        if (!form) {
            return;
        }

        statusContainer =
            document.createElement("div");

        statusContainer.id =
            "payment-status";

        statusContainer.setAttribute(
            "role",
            "status"
        );

        form.parentNode.insertBefore(
            statusContainer,
            form
        );

    }

    let receiptHTML = "";

    if (receipt) {

        receiptHTML = `

            <p class="payment-receipt">

                <strong>
                    M-Pesa Receipt:
                </strong>

                ${receipt}

            </p>

        `;

    }

    statusContainer.className =
        `payment-status ${type}`;

    statusContainer.innerHTML = `

        <div class="payment-status-content">

            <h3>
                ${title}
            </h3>

            <p>
                ${message}
            </p>

            ${receiptHTML}

        </div>

    `;

    statusContainer.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================
   STOP PAYMENT POLLING
========================= */

function stopPaymentPolling() {

    paymentPollingActive = false;

    if (paymentPollingTimer) {

        clearTimeout(
            paymentPollingTimer
        );

        paymentPollingTimer = null;

    }

}


/* =========================
   CHECK PAYMENT STATUS
========================= */

async function checkPaymentStatus(
    orderId,
    submitButton
) {

    if (!orderId) {
        return;
    }

    if (!paymentPollingActive) {
        return;
    }

    try {

        console.log(
            "Checking payment status:",
            orderId
        );

        const response =
            await fetch(
                `${API_URL}/orders/status?orderId=${encodeURIComponent(orderId)}`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        const result =
            await response.json();

        console.log(
            "Payment status response:",
            result
        );

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Could not check payment status."
            );

        }


        /* =========================
           PAYMENT SUCCESS
        ========================= */

        if (
            result.paymentStatus === "PAID" ||
            result.status === "paid" ||
            result.payment?.status === "SUCCESS"
        ) {

            stopPaymentPolling();

            const receipt =
                result.payment?.mpesaReceiptNumber ||
                result.order?.payment?.mpesaReceiptNumber ||
                null;

            showPaymentStatus(
                "success",
                "✓ Payment Successful",
                "Your M-Pesa payment has been received. Your order is now confirmed.",
                receipt
            );

            if (submitButton) {

                submitButton.disabled = true;

                submitButton.textContent =
                    "Payment Confirmed";

            }


            /* =========================
               CLEAR CART
            ========================= */

            try {

                localStorage.removeItem(
                    "priorityfixa_cart"
                );

            } catch (storageError) {

                console.warn(
                    "Could not clear cart:",
                    storageError
                );

            }

            updateCartCount();

            return;

        }


        /* =========================
           PAYMENT FAILED
        ========================= */

        if (
            result.paymentStatus === "FAILED" ||
            result.status === "payment_failed" ||
            result.payment?.status === "FAILED"
        ) {

            stopPaymentPolling();

            const reason =
                result.payment?.resultDescription ||
                "The M-Pesa payment was not completed.";

            showPaymentStatus(
                "error",
                "Payment Not Completed",
                reason
            );

            if (submitButton) {

                submitButton.disabled = false;

                submitButton.textContent =
                    "Try Payment Again";

            }

            return;

        }


        /* =========================
           STILL WAITING
        ========================= */

        if (paymentPollingActive) {

            paymentPollingTimer =
                setTimeout(
                    () => {

                        checkPaymentStatus(
                            orderId,
                            submitButton
                        );

                    },
                    3000
                );

        }

    } catch (error) {

        console.warn(
            "Payment status check failed:",
            error
        );


        /*
         * A temporary status-request failure
         * should NOT immediately tell the
         * customer that payment failed.
         */

        if (paymentPollingActive) {

            paymentPollingTimer =
                setTimeout(
                    () => {

                        checkPaymentStatus(
                            orderId,
                            submitButton
                        );

                    },
                    5000
                );

        }

    }

}


/* =========================
   START PAYMENT POLLING
========================= */

function startPaymentPolling(
    orderId,
    submitButton
) {

    stopPaymentPolling();

    paymentPollingActive = true;

    showPaymentStatus(
        "pending",
        "Payment Request Sent",
        "Check your phone and enter your M-Pesa PIN. We are waiting for payment confirmation..."
    );

    checkPaymentStatus(
        orderId,
        submitButton
    );

}


/* =========================
   CREATE ORDER + PAYMENT
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


    /* =========================
       CALCULATE TOTAL
    ========================= */

    const total =
        cart.reduce(
            (sum, item) =>
                sum +
                (
                    Number(item.price) *
                    Number(item.quantity)
                ),
            0
        );


    /* =========================
       GET SUBMIT BUTTON
    ========================= */

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

        /* =========================
           CREATE ORDER
        ========================= */

        console.log(
            "Sending order to API..."
        );

        const orderResponse =
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


        const orderResult =
            await orderResponse.json();


        console.log(
            "API response:",
            orderResult
        );


        if (
            !orderResponse.ok ||
            !orderResult.success
        ) {

            throw new Error(
                orderResult.error ||
                "Order could not be created."
            );

        }


        const order =
            orderResult.order;


        console.log(
            "Order created:",
            order
        );


        /* =========================
           START M-PESA
        ========================= */

        if (submitButton) {

            submitButton.textContent =
                "Requesting M-Pesa...";

        }


        console.log(
            "Starting M-Pesa payment..."
        );


        const paymentResponse =
            await fetch(
                `${API_URL}/payments/mpesa`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        orderId:
                            order.id,

                        amount:
                            total,

                        phone:
                            customer.phone

                    })

                }
            );


        const paymentResult =
            await paymentResponse.json();


        console.log(
            "M-Pesa response:",
            paymentResult
        );


        if (
            !paymentResponse.ok ||
            !paymentResult.success
        ) {

            throw new Error(
                paymentResult.error ||
                "M-Pesa payment could not be initiated."
            );

        }


        /* =========================
           STK PUSH SUCCESS
        ========================= */

        if (submitButton) {

            submitButton.textContent =
                "Waiting for Payment...";

        }


        const checkoutRequestId =
            paymentResult.payment?.checkoutRequestId ||
            paymentResult.mpesa?.CheckoutRequestID ||
            null;


        console.log(
            "STK Push initiated:",
            checkoutRequestId
        );


        showPaymentStatus(
            "pending",
            "M-Pesa Request Sent",
            "A payment request has been sent to your phone. Enter your M-Pesa PIN to complete the payment."
        );


        /* =========================
           BEGIN POLLING
        ========================= */

        startPaymentPolling(
            order.id,
            submitButton
        );


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        stopPaymentPolling();


        showPaymentStatus(
            "error",
            "Checkout Error",
            error.message
        );


        alert(

            "There was a problem with your order or payment.\n\n" +

            error.message

        );


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
```
