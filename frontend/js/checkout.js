```javascript
/* =========================================================
   PRIORITYFIXA COMMERCE — CHECKOUT
   Complete checkout + M-Pesa payment polling
========================================================= */


/* =========================================================
   API
========================================================= */

const API_URL =
  "https://priorityfixa-income-api.priorityfixa.workers.dev";


/* =========================================================
   PAYMENT POLLING STATE
========================================================= */

let paymentPollingTimer = null;
let paymentPollingActive = false;
let paymentPollingStartedAt = null;

const PAYMENT_POLLING_TIMEOUT = 5 * 60 * 1000;


/* =========================================================
   FORMAT PRICE
========================================================= */

function formatPrice(amount) {
  let currency = "KSh";

  if (
    typeof BUSINESS_CONFIG !== "undefined" &&
    BUSINESS_CONFIG.location &&
    BUSINESS_CONFIG.location.currencySymbol
  ) {
    currency =
      BUSINESS_CONFIG.location.currencySymbol;
  }

  const numericAmount = Number(amount);

  const safeAmount =
    Number.isFinite(numericAmount)
      ? numericAmount
      : 0;

  return (
    currency +
    " " +
    safeAmount.toLocaleString()
  );
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   CHECKOUT FORM VISIBILITY
========================================================= */

function setCheckoutFormVisible(visible) {
  const form =
    document.getElementById(
      "checkout-form"
    );

  if (!form) {
    return;
  }

  const formContainer =
    form.closest(
      ".checkout-form-container"
    );

  const target =
    formContainer || form;

  if (visible) {
    target.style.display = "";
    target.removeAttribute(
      "aria-hidden"
    );
  } else {
    target.style.display = "none";
    target.setAttribute(
      "aria-hidden",
      "true"
    );
  }
}


/* =========================================================
   PAYMENT STATUS CONTAINER
========================================================= */

/*
  IMPORTANT:

  The payment status container is inserted as a
  SIBLING of .checkout-form-container.

  We do NOT put it inside the form container because
  the form container gets hidden during M-Pesa payment.
*/

function getPaymentStatusContainer() {
  let statusContainer =
    document.getElementById(
      "payment-status"
    );

  if (statusContainer) {
    return statusContainer;
  }

  const formContainer =
    document.querySelector(
      ".checkout-form-container"
    );

  if (
    !formContainer ||
    !formContainer.parentNode
  ) {
    console.warn(
      "Checkout form container not found."
    );

    return null;
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

  statusContainer.style.display =
    "none";

  /*
    Insert BEFORE the form container.
  */

  formContainer.parentNode.insertBefore(
    statusContainer,
    formContainer
  );

  return statusContainer;
}


/* =========================================================
   SHOW PAYMENT STATUS
========================================================= */

function showPaymentStatus(
  type,
  title,
  message,
  receipt
) {
  const statusContainer =
    getPaymentStatusContainer();

  if (!statusContainer) {
    return;
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

  statusContainer.style.display =
    "block";

  /*
    Scroll the payment message into view.
  */

  try {
    statusContainer.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } catch (scrollError) {
    console.warn(
      "Could not scroll payment status into view:",
      scrollError
    );
  }
}


/* =========================================================
   HIDE PAYMENT STATUS
========================================================= */

function hidePaymentStatus() {
  const statusContainer =
    document.getElementById(
      "payment-status"
    );

  if (!statusContainer) {
    return;
  }

  statusContainer.style.display =
    "none";
}


/* =========================================================
   RENDER CHECKOUT SUMMARY
========================================================= */

function renderCheckoutSummary() {
  const container =
    document.getElementById(
      "checkout-summary"
    );

  if (!container) {
    console.warn(
      "Checkout summary container not found."
    );

    return;
  }

  if (
    typeof getCart !==
    "function"
  ) {
    console.error(
      "getCart() is not available."
    );

    return;
  }

  const cart = getCart();

  if (
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    container.innerHTML =
      '<div class="empty-cart">' +
      "<h2>Your cart is empty</h2>" +
      "<p>Add products before checkout.</p>" +
      '<a href="index.html" class="add-to-cart">' +
      "Continue Shopping" +
      "</a>" +
      "</div>";

    if (
      typeof updateCartCount ===
      "function"
    ) {
      updateCartCount();
    }

    return;
  }

  let total = 0;

  const itemsHTML =
    cart
      .map(function (item) {
        const quantity =
          Number(item.quantity);

        const price =
          Number(item.price);

        const safeQuantity =
          Number.isFinite(quantity) &&
          quantity > 0
            ? quantity
            : 1;

        const safePrice =
          Number.isFinite(price) &&
          price >= 0
            ? price
            : 0;

        const subtotal =
          safePrice *
          safeQuantity;

        total += subtotal;

        return (
          '<div class="checkout-item">' +

          "<div>" +

          "<strong>" +
          escapeHTML(
            item.name ||
            "Product"
          ) +
          "</strong>" +

          "<p>" +
          safeQuantity +
          " &times; " +
          formatPrice(
            safePrice
          ) +
          "</p>" +

          "</div>" +

          "<strong>" +
          formatPrice(
            subtotal
          ) +
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

  if (
    typeof updateCartCount ===
    "function"
  ) {
    updateCartCount();
  }
}


/* =========================================================
   GET CUSTOMER DETAILS
========================================================= */

function getCustomerDetails() {
  const nameInput =
    document.getElementById(
      "customer-name"
    );

  const phoneInput =
    document.getElementById(
      "customer-phone"
    );

  const emailInput =
    document.getElementById(
      "customer-email"
    );

  const locationInput =
    document.getElementById(
      "customer-location"
    );

  return {
    name:
      nameInput
        ? nameInput.value.trim()
        : "",

    phone:
      phoneInput
        ? phoneInput.value.trim()
        : "",

    email:
      emailInput
        ? emailInput.value.trim()
        : "",

    location:
      locationInput
        ? locationInput.value.trim()
        : ""
  };
}


/* =========================================================
   VALIDATE CUSTOMER DETAILS
========================================================= */

function validateCustomerDetails(
  customer
) {
  if (!customer.name) {
    return (
      "Please enter your name."
    );
  }

  if (!customer.phone) {
    return (
      "Please enter your M-Pesa phone number."
    );
  }

  if (!customer.email) {
    return (
      "Please enter your email address."
    );
  }

  if (!customer.location) {
    return (
      "Please enter your location."
    );
  }

  return null;
}


/* =========================================================
   STOP PAYMENT POLLING
========================================================= */

function stopPaymentPolling() {
  paymentPollingActive =
    false;

  paymentPollingStartedAt =
    null;

  if (paymentPollingTimer) {
    clearTimeout(
      paymentPollingTimer
    );

    paymentPollingTimer =
      null;
  }
}


/* =========================================================
   CHECK PAYMENT STATUS
========================================================= */

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


  /* =======================================================
     TIMEOUT
  ======================================================= */

  if (
    paymentPollingStartedAt &&
    Date.now() -
      paymentPollingStartedAt >=
      PAYMENT_POLLING_TIMEOUT
  ) {
    stopPaymentPolling();

    setCheckoutFormVisible(
      true
    );

    showPaymentStatus(
      "error",
      "Payment Confirmation Timed Out",
      "We could not confirm your M-Pesa payment automatically. If you completed the payment, please contact us with your order details."
    );

    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Check Payment Again";
    }

    return;
  }


  /* =======================================================
     REQUEST PAYMENT STATUS
  ======================================================= */

  try {
    console.log(
      "Checking payment status:",
      orderId
    );

    const statusURL =
      API_URL +
      "/orders/status?orderId=" +
      encodeURIComponent(
        orderId
      );

    const response =
      await fetch(
        statusURL,
        {
          method: "GET",

          cache: "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );


    /* =====================================================
       PARSE RESPONSE
    ===================================================== */

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


    /* =====================================================
       API ERROR
    ===================================================== */

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
       NORMALIZE STATUS
    ===================================================== */

    const paymentStatus =
      String(
        result.paymentStatus ||
        ""
      ).toUpperCase();

    const orderStatus =
      String(
        result.status ||
        ""
      ).toUpperCase();

    const nestedPaymentStatus =
      String(
        result.payment &&
        result.payment.status
          ? result.payment.status
          : ""
      ).toUpperCase();


    /* =====================================================
       PAYMENT SUCCESS
    ===================================================== */

    const paymentSuccessful =
      paymentStatus === "PAID" ||
      orderStatus === "PAID" ||
      orderStatus === "PAYMENT_PAID" ||
      nestedPaymentStatus ===
        "PAID" ||
      nestedPaymentStatus ===
        "SUCCESS";

    if (paymentSuccessful) {
      console.log(
        "PAYMENT SUCCESS — PAID"
      );

      stopPaymentPolling();


      /*
        Keep the customer form hidden.
      */

      setCheckoutFormVisible(
        false
      );


      /* ===================================================
         FIND RECEIPT
      =================================================== */

      const payment =
        result.payment ||
        {};

      const order =
        result.order ||
        {};

      const receipt =
        payment.mpesaReceiptNumber ||
        payment.MpesaReceiptNumber ||
        payment.receiptNumber ||
        payment.mpesa_receipt_number ||
        order.mpesaReceiptNumber ||
        order.MpesaReceiptNumber ||
        (
          order.payment &&
          (
            order.payment
              .mpesaReceiptNumber ||
            order.payment
              .MpesaReceiptNumber ||
            order.payment
              .receiptNumber
          )
        ) ||
        null;


      /* ===================================================
         FIND ORDER NUMBER
      =================================================== */

      const orderNumber =
        result.orderId ||
        order.id ||
        orderId;


      /* ===================================================
         FIND AMOUNT
      =================================================== */

      const amount =
        order.total !== undefined &&
        order.total !== null
          ? order.total
          : result.amount !== undefined &&
            result.amount !== null
            ? result.amount
            : null;


      /* ===================================================
         SUCCESS MESSAGE
      =================================================== */

      let successMessage =
        "Your M-Pesa payment has been received. Your order is now confirmed.";

      if (orderNumber) {
        successMessage +=
          " Order number: " +
          orderNumber +
          ".";
      }

      if (amount !== null) {
        successMessage +=
          " Amount paid: " +
          formatPrice(amount) +
          ".";
      }


      showPaymentStatus(
        "success",
        "✓ Payment Successful",
        successMessage,
        receipt
      );


      /* ===================================================
         UPDATE BUTTON
      =================================================== */

      if (submitButton) {
        submitButton.disabled =
          true;

        submitButton.textContent =
          "Payment Confirmed";
      }


      /* ===================================================
         CLEAR CART
      =================================================== */

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

    const paymentFailed =
      paymentStatus === "FAILED" ||
      paymentStatus ===
        "FAILURE" ||
      orderStatus === "FAILED" ||
      orderStatus ===
        "PAYMENT_FAILED" ||
      nestedPaymentStatus ===
        "FAILED";

    if (paymentFailed) {
      stopPaymentPolling();

      setCheckoutFormVisible(
        true
      );

      const reason =
        payment.resultDescription ||
        payment.ResultDescription ||
        payment.resultDesc ||
        result.error ||
        "The M-Pesa payment was not completed.";

      showPaymentStatus(
        "error",
        "Payment Not Completed",
        reason
      );

      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          "Try Payment Again";
      }

      return;
    }


    /* =====================================================
       PAYMENT CANCELLED
    ===================================================== */

    const paymentCancelled =
      paymentStatus ===
        "CANCELLED" ||
      paymentStatus ===
        "CANCELED" ||
      orderStatus ===
        "CANCELLED" ||
      orderStatus ===
        "CANCELED" ||
      nestedPaymentStatus ===
        "CANCELLED" ||
      nestedPaymentStatus ===
        "CANCELED";

    if (paymentCancelled) {
      stopPaymentPolling();

      setCheckoutFormVisible(
        true
      );

      showPaymentStatus(
        "error",
        "Payment Cancelled",
        "The M-Pesa payment request was cancelled."
      );

      if (submitButton) {
        submitButton.disabled =
          false;

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
          function () {
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
      IMPORTANT:

      A temporary API/network error does NOT mean
      the customer's M-Pesa payment failed.

      Continue polling.
    */

    if (paymentPollingActive) {
      paymentPollingTimer =
        setTimeout(
          function () {
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


/* =========================================================
   START PAYMENT POLLING
========================================================= */

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

  paymentPollingActive =
    true;

  paymentPollingStartedAt =
    Date.now();


  /* =======================================================
     HIDE CUSTOMER FORM
  ======================================================= */

  setCheckoutFormVisible(
    false
  );


  /* =======================================================
     SHOW WAITING MESSAGE
  ======================================================= */

  showPaymentStatus(
    "pending",
    "Waiting for M-Pesa Payment",
    "An M-Pesa payment request has been sent to your phone. Check your phone and enter your M-Pesa PIN. Please keep this page open while we confirm your payment."
  );


  /* =======================================================
     START FIRST STATUS CHECK
  ======================================================= */

  checkPaymentStatus(
    orderId,
    submitButton
  );
}


/* =========================================================
   CREATE ORDER + PAYMENT
========================================================= */

async function handleCheckoutSubmit(
  event
) {
  event.preventDefault();

  const form =
    event.target;

  stopPaymentPolling();


  /* =======================================================
     GET CART
  ======================================================= */

  if (
    typeof getCart !==
    "function"
  ) {
    showPaymentStatus(
      "error",
      "Checkout Error",
      "The shopping cart could not be loaded."
    );

    return;
  }

  const cart =
    getCart();


  /* =======================================================
     EMPTY CART
  ======================================================= */

  if (
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    alert(
      "Your cart is empty."
    );

    return;
  }


  /* =======================================================
     CUSTOMER DETAILS
  ======================================================= */

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


  /* =======================================================
     CALCULATE TOTAL
  ======================================================= */

  const total =
    cart.reduce(
      function (
        sum,
        item
      ) {
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


  /* =======================================================
     SUBMIT BUTTON
  ======================================================= */

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

    /* =====================================================
       CREATE ORDER
    ===================================================== */

    console.log(
      "Sending order to API..."
    );


    const orderURL =
      API_URL +
      "/orders";


    const orderResponse =
      await fetch(
        orderURL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
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


    /* =====================================================
       PARSE ORDER RESPONSE
    ===================================================== */

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
        orderResult.message ||
        "Order could not be created."
      );
    }


    /* =====================================================
       GET ORDER
    ===================================================== */

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


    /* =====================================================
       START M-PESA
    ===================================================== */

    if (submitButton) {
      submitButton.textContent =
        "Requesting M-Pesa...";
    }


    console.log(
      "Starting M-Pesa payment..."
    );


    const paymentURL =
      API_URL +
      "/payments/mpesa";


    const paymentResponse =
      await fetch(
        paymentURL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
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


    /* =====================================================
       PARSE PAYMENT RESPONSE
    ===================================================== */

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


    /* =====================================================
       GET CHECKOUT REQUEST ID
    ===================================================== */

    const paymentObject =
      paymentResult.payment ||
      {};

    const mpesaObject =
      paymentResult.mpesa ||
      {};


    const checkoutRequestId =
      paymentObject.checkoutRequestId ||
      paymentObject.CheckoutRequestID ||
      paymentObject.checkout_request_id ||
      mpesaObject.checkoutRequestId ||
      mpesaObject.CheckoutRequestID ||
      mpesaObject.checkout_request_id ||
      paymentResult.CheckoutRequestID ||
      paymentResult.checkoutRequestId ||
      paymentResult.checkout_request_id ||
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


    /* =====================================================
       START WAITING SCREEN
    ===================================================== */

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
      Show the customer form again
      when checkout setup fails.
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


/* =========================================================
   BUSINESS INFORMATION
========================================================= */

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


/* =========================================================
   INITIALIZE CHECKOUT
========================================================= */

function initializeCheckout() {
  console.log(
    "PriorityFixa Checkout initializing..."
  );


  loadCheckoutBusinessInformation();


  /* =======================================================
     CHECK CART FUNCTION
  ======================================================= */

  if (
    typeof getCart !==
    "function"
  ) {
    console.error(
      "getCart() is not defined. Make sure cart.js loads before checkout.js."
    );

    return;
  }


  /* =======================================================
     RENDER SUMMARY
  ======================================================= */

  renderCheckoutSummary();


  /* =======================================================
     FIND FORM
  ======================================================= */

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


  /* =======================================================
     PREVENT DOUBLE INITIALIZATION
  ======================================================= */

  if (
    form.dataset.checkoutInitialized ===
    "true"
  ) {
    return;
  }


  form.dataset.checkoutInitialized =
    "true";


  /* =======================================================
     ADD SUBMIT HANDLER
  ======================================================= */

  form.addEventListener(
    "submit",
    handleCheckoutSubmit
  );


  /* =======================================================
     INITIAL FORM STATE
  ======================================================= */

  setCheckoutFormVisible(
    true
  );


  hidePaymentStatus();


  console.log(
    "PriorityFixa Checkout initialized successfully."
  );
}


/* =========================================================
   DOM READY
========================================================= */

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
```
