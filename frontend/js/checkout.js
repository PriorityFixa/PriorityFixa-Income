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
   PAYMENT POLLING STATE
========================= */

let paymentPollingTimer = null;
let paymentPollingActive = false;
let paymentPollingStartedAt = null;

const PAYMENT_POLLING_TIMEOUT = 5 * 60 * 1000;


/* =========================
   FORMAT PRICE
========================= */

function formatPrice(amount) {
  const currency =
    typeof BUSINESS_CONFIG !== "undefined" &&
    BUSINESS_CONFIG.location &&
    BUSINESS_CONFIG.location.currencySymbol
      ? BUSINESS_CONFIG.location.currencySymbol
      : "KSh";

  const numericAmount = Number(amount);

  return (
    currency +
    " " +
    (Number.isFinite(numericAmount) ? numericAmount : 0).toLocaleString()
  );
}


/* =========================
   BASIC HTML ESCAPE
========================= */

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================
   CHECKOUT FORM VISIBILITY
========================= */

function setCheckoutFormVisible(visible) {
  const form = document.getElementById("checkout-form");

  if (!form) {
    return;
  }

  const formContainer =
    form.closest(".checkout-form-container");

  const target =
    formContainer || form;

  if (visible) {
    target.style.display = "";
    target.removeAttribute("aria-hidden");
  } else {
    target.style.display = "none";
    target.setAttribute("aria-hidden", "true");
  }
}


/* =========================
   RENDER ORDER SUMMARY
========================= */

function renderCheckoutSummary() {
  const container =
    document.getElementById("checkout-summary");

  if (!container) {
    console.warn(
      "Checkout summary container not found."
    );
    return;
  }

  const cart = getCart();

  if (!Array.isArray(cart) || cart.length === 0) {
    container.innerHTML =
      '<div class="empty-cart">' +
      "<h2>Your cart is empty</h2>" +
      "<p>Add products before checkout.</p>" +
      '<a href="index.html" class="add-to-cart">Continue Shopping</a>' +
      "</div>";

    if (typeof updateCartCount === "function") {
      updateCartCount();
    }

    return;
  }

  let total = 0;

  const itemsHTML = cart
    .map((item) => {
      const quantity = Number(item.quantity);
      const price = Number(item.price);

      const safeQuantity =
        Number.isFinite(quantity) && quantity > 0
          ? quantity
          : 1;

      const safePrice =
        Number.isFinite(price) && price >= 0
          ? price
          : 0;

      const subtotal =
        safePrice * safeQuantity;

      total += subtotal;

      return (
        '<div class="checkout-item">' +
        "<div>" +
        "<strong>" +
        escapeHTML(item.name || "Product") +
        "</strong>" +
        "<p>" +
        safeQuantity +
        " &times; " +
        formatPrice(safePrice) +
        "</p>" +
        "</div>" +
        "<strong>" +
        formatPrice(subtotal) +
        "</strong>" +
        "</div>"
      );
    })
    .join("");

  container.innerHTML =
    "<h2>Order Summary</h2>" +
    '<div class="checkout-items">' +
    itemsHTML +
    "</div>" +
    '<div class="checkout-total">' +
    "<span>Total</span>" +
    "<strong>" +
    formatPrice(total) +
    "</strong>" +
    "</div>";

  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
}


/* =========================
   CUSTOMER DETAILS
========================= */

function getCustomerDetails() {
  const nameInput =
    document.getElementById("customer-name");

  const phoneInput =
    document.getElementById("customer-phone");

  const emailInput =
    document.getElementById("customer-email");

  const locationInput =
    document.getElementById("customer-location");

  return {
    name: nameInput
      ? nameInput.value.trim()
      : "",

    phone: phoneInput
      ? phoneInput.value.trim()
      : "",

    email: emailInput
      ? emailInput.value.trim()
      : "",

    location: locationInput
      ? locationInput.value.trim()
      : "",
  };
}


/* =========================
   VALIDATE CUSTOMER DETAILS
========================= */

function validateCustomerDetails(customer) {
  if (!customer.name) {
    return "Please enter your name.";
  }

  if (!customer.phone) {
    return "Please enter your M-Pesa phone number.";
  }

  if (!customer.email) {
    return "Please enter your email address.";
  }

  if (!customer.location) {
    return "Please enter your location.";
  }

  return null;
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
    document.getElementById("payment-status");

  if (!statusContainer) {
    const formContainer =
      document.querySelector(
        ".checkout-form-container"
      );

    const form =
      document.getElementById("checkout-form");

    const parent =
      formContainer ||
      (form ? form.parentNode : null);

    if (!parent) {
      console.warn(
        "Checkout form container not found."
      );
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

    statusContainer.setAttribute(
      "aria-live",
      "polite"
    );

    parent.insertBefore(
      statusContainer,
      parent.firstChild
    );
  }

  let receiptHTML = "";

  if (receipt) {
    receiptHTML =
      '<p class="payment-receipt">' +
      "<strong>M-Pesa Receipt:</strong> " +
      escapeHTML(receipt) +
      "</p>";
  }

  statusContainer.className =
    "payment-status " + type;

  statusContainer.innerHTML =
    '<div class="payment-status-content">' +
    "<h3>" +
    escapeHTML(title) +
    "</h3>" +
    "<p>" +
    escapeHTML(message) +
    "</p>" +
    receiptHTML +
    "</div>";

  statusContainer.style.display = "block";

  statusContainer.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}


/* =========================
   HIDE PAYMENT STATUS
========================= */

function hidePaymentStatus() {
  const statusContainer =
    document.getElementById(
      "payment-status"
    );

  if (!statusContainer) {
    return;
  }

  statusContainer.style.display = "none";
}


/* =========================
   STOP PAYMENT POLLING
========================= */

function stopPaymentPolling() {
  paymentPollingActive = false;
  paymentPollingStartedAt = null;

  if (paymentPollingTimer) {
    clearTimeout(paymentPollingTimer);
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
    console.error(
      "Cannot check payment status: order ID missing."
    );
    return;
  }

  if (!paymentPollingActive) {
    return;
  }

  /* =========================
     POLLING TIMEOUT
  ========================= */

  if (
    paymentPollingStartedAt &&
    Date.now() -
      paymentPollingStartedAt >=
      PAYMENT_POLLING_TIMEOUT
  ) {
    stopPaymentPolling();

    setCheckoutFormVisible(true);

    showPaymentStatus(
      "error",
      "Payment Confirmation Timed Out",
      "We could not confirm your M-Pesa payment automatically. If you completed the payment, please contact us with your order details."
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "Check Payment Again";
    }

    return;
  }


  try {
    console.log(
      "Checking payment status:",
      orderId
    );

    const response =
      await fetch(
        `${API_URL}/orders/status?orderId=${encodeURIComponent(
          orderId
        )}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    let result;

    try {
      result =
        await response.json();
    } catch (jsonError) {
      throw new Error(
        "The payment status API returned an invalid response."
      );
    }

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


    /* =====================================================
       PAYMENT SUCCESS
    ===================================================== */

    if (
      result.paymentStatus === "PAID" ||
      result.paymentStatus === "paid" ||
      result.status === "paid" ||
      result.status === "PAID" ||
      result.payment?.status === "SUCCESS" ||
      result.payment?.status === "PAID"
    ) {
      console.log(
        "PAYMENT SUCCESS — PAID"
      );

      stopPaymentPolling();

      /*
        Keep the customer form hidden.
      */
      setCheckoutFormVisible(false);

      const receipt =
        result.payment
          ?.mpesaReceiptNumber ||
        result.payment
          ?.MpesaReceiptNumber ||
        result.payment
          ?.receiptNumber ||
        result.order
          ?.payment
          ?.mpesaReceiptNumber ||
        result.order
          ?.payment
          ?.MpesaReceiptNumber ||
        null;

      const orderNumber =
        result.orderId ||
        result.order?.id ||
        orderId;

      const amount =
        result.order?.total ??
        result.amount ??
        null;


      /* =========================
         SUCCESS MESSAGE
      ========================= */

      let successMessage =
        "Your M-Pesa payment has been received. Your order is now confirmed.";

      if (orderNumber) {
        successMessage +=
          ` Order number: ${orderNumber}.`;
      }

      if (amount !== null) {
        successMessage +=
          ` Amount paid: ${formatPrice(amount)}.`;
      }

      showPaymentStatus(
        "success",
        "✓ Payment Successful",
        successMessage,
        receipt
      );


      /* =========================
         UPDATE BUTTON
      ========================= */

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

      if (
        typeof updateCartCount ===
        "function"
      ) {
        updateCartCount();
      }

      return;
    }


    /* =====================================================
       PAYMENT FAILED
    ===================================================== */

    if (
      result.paymentStatus === "FAILED" ||
      result.paymentStatus === "failed" ||
      result.status === "payment_failed" ||
      result.status === "FAILED" ||
      result.payment?.status === "FAILED"
    ) {
      stopPaymentPolling();

      setCheckoutFormVisible(true);

      const reason =
        result.payment
          ?.resultDescription ||
        result.payment
          ?.ResultDescription ||
        result.error ||
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


    /* =====================================================
       PAYMENT CANCELLED
    ===================================================== */

    if (
      result.paymentStatus === "CANCELLED" ||
      result.paymentStatus === "cancelled" ||
      result.status === "cancelled" ||
      result.payment?.status === "CANCELLED"
    ) {
      stopPaymentPolling();

      setCheckoutFormVisible(true);

      showPaymentStatus(
        "error",
        "Payment Cancelled",
        "The M-Pesa payment request was cancelled."
      );

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          "Try Payment Again";
      }

      return;
    }


    /* =====================================================
       STILL WAITING
    ===================================================== */

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
      Network/API errors do not mean
      that the M-Pesa payment failed.
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
  if (!orderId) {
    console.error(
      "Cannot start payment polling: order ID missing."
    );
    return;
  }

  stopPaymentPolling();

  paymentPollingActive = true;
  paymentPollingStartedAt =
    Date.now();


  /*
    IMPORTANT:
    Hide the customer details form
    immediately after STK Push starts.
  */

  setCheckoutFormVisible(false);


  showPaymentStatus(
    "pending",
    "Waiting for M-Pesa Payment",
    "An M-Pesa payment request has been sent to your phone. Check your phone and enter your M-Pesa PIN. Please keep this page open while we confirm your payment."
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

  const form =
    event.target;

  stopPaymentPolling();

  const cart =
    getCart();

  if (
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    alert(
      "Your cart is empty."
    );
    return;
  }

  const customer =
    getCustomerDetails();

  const validationError =
    validateCustomerDetails(
      customer
    );

  if (validationError) {
    showPaymentStatus(
      "error",
      "Missing Information",
      validationError
    );

    alert(
      validationError
    );

    return;
  }

  const total =
    cart.reduce(
      (sum, item) => {
        const price =
          Number(item.price);

        const quantity =
          Number(item.quantity);

        const safePrice =
          Number.isFinite(price)
            ? price
            : 0;

        const safeQuantity =
          Number.isFinite(quantity) &&
          quantity > 0
            ? quantity
            : 1;

        return (
          sum +
          safePrice *
            safeQuantity
        );
      },
      0
    );

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    alert(
      "Your order total is invalid. Please return to your cart and try again."
    );

    return;
  }

  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled =
      true;

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
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            customer:
              customer,
            items:
              cart,
          }),
        }
      );

    let orderResult;

    try {
      orderResult =
        await orderResponse.json();
    } catch (jsonError) {
      throw new Error(
        "The order API returned an invalid response."
      );
    }

    console.log(
      "Order API response:",
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

    if (
      !order ||
      !order.id
    ) {
      throw new Error(
        "The order was created but no order ID was returned."
      );
    }

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
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            orderId:
              order.id,
            amount:
              total,
            phone:
              customer.phone,
          }),
        }
      );

    let paymentResult;

    try {
      paymentResult =
        await paymentResponse.json();
    } catch (jsonError) {
      throw new Error(
        "The M-Pesa API returned an invalid response."
      );
    }

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
          paymentResult.message ||
          "M-Pesa payment could not be initiated."
      );
    }


    /* =========================
       GET CHECKOUT REQUEST ID
    ========================= */

    const checkoutRequestId =
      paymentResult.payment
        ?.checkoutRequestId ||
      paymentResult.payment
        ?.CheckoutRequestID ||
      paymentResult.mpesa
        ?.checkoutRequestId ||
      paymentResult.mpesa
        ?.CheckoutRequestID ||
      paymentResult.CheckoutRequestID ||
      paymentResult.checkoutRequestId ||
      null;

    console.log(
      "STK Push initiated:",
      checkoutRequestId
    );

    if (!checkoutRequestId) {
      throw new Error(
        "M-Pesa payment was initiated, but no CheckoutRequestID was returned by the payment API."
      );
    }


    /* =========================
       START WAITING SCREEN
    ========================= */

    if (submitButton) {
      submitButton.textContent =
        "Waiting for Payment...";
    }

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

    /*
      If order/payment setup failed,
      show the form again.
    */

    setCheckoutFormVisible(
      true
    );

    const message =
      error &&
      error.message
        ? error.message
        : "Something went wrong during checkout.";

    showPaymentStatus(
      "error",
      "Checkout Error",
      message
    );

    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Try Again";
    }

    alert(
      "There was a problem with your order or payment.\n\n" +
        message
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
      BUSINESS_CONFIG.name ||
      "";
  }

  if (footerBusinessName) {
    footerBusinessName.textContent =
      BUSINESS_CONFIG.name ||
      "";
  }
}


/* =========================
   INITIALIZE
========================= */

function initializeCheckout() {
  console.log(
    "PriorityFixa Checkout initializing..."
  );

  loadCheckoutBusinessInformation();

  if (
    typeof getCart !==
    "function"
  ) {
    console.error(
      "getCart() is not defined. Make sure the cart JavaScript loads before checkout.js."
    );

    return;
  }

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

  if (
    form.dataset.checkoutInitialized ===
    "true"
  ) {
    return;
  }

  form.dataset.checkoutInitialized =
    "true";

  form.addEventListener(
    "submit",
    handleCheckoutSubmit
  );

  /*
    Make sure the form is visible
    when checkout initially loads.
  */

  setCheckoutFormVisible(
    true
  );

  console.log(
    "PriorityFixa Checkout initialized successfully."
  );
}


/* =========================
   DOM READY
========================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeCheckout
);
```
