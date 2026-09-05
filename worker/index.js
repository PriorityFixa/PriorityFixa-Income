/**
 * ============================================================
 * PRIORITYFIXA COMMERCE API
 * Cloudflare Worker
 * ============================================================
 *
 * Handles:
 * - Orders
 * - M-Pesa STK Push
 * - M-Pesa callbacks
 * - Order/payment persistence using Cloudflare KV
 *
 * KV Bindings:
 * - ORDERS_KV
 * - PAYMENTS_KV
 *
 * Required environment variables:
 * - MPESA_CONSUMER_KEY
 * - MPESA_CONSUMER_SECRET
 * - MPESA_SHORTCODE
 * - MPESA_PASSKEY
 *
 * ============================================================
 */


/* ============================================================
   CORS
   ============================================================ */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};


/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function jsonResponse(data, status = 200) {
    return new Response(
        JSON.stringify(data, null, 2),
        {
            status,
            headers: {
                "Content-Type": "application/json",
                ...CORS_HEADERS,
            },
        }
    );
}


/* ============================================================
   PHONE NUMBER NORMALIZATION
   ============================================================ */

function normalizePhoneNumber(phone) {
    if (!phone) {
        return null;
    }

    let value = String(phone).trim();

    // Remove spaces, hyphens and other non-numeric characters
    value = value.replace(/\D/g, "");

    // 07XXXXXXXX → 2547XXXXXXXX
    if (value.startsWith("0") && value.length === 10) {
        return "254" + value.substring(1);
    }

    // 7XXXXXXXX → 2547XXXXXXXX
    if (value.startsWith("7") && value.length === 9) {
        return "254" + value;
    }

    // +2547XXXXXXXX
    if (value.startsWith("254") && value.length === 12) {
        return value;
    }

    return value;
}


/* ============================================================
   PRICE / NUMBER HELPERS
   ============================================================ */

function toNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return number;
}


/* ============================================================
   M-PESA TIMESTAMP
   ============================================================ */

function getMpesaTimestamp() {
    return new Date()
        .toISOString()
        .replace(/\D/g, "")
        .substring(0, 14);
}


/* ============================================================
   BASE64 PASSWORD
   ============================================================ */

function createMpesaPassword(shortcode, passkey, timestamp) {
    const raw = `${shortcode}${passkey}${timestamp}`;

    return btoa(raw);
}


/* ============================================================
   MAIN WORKER
   ============================================================ */

export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        console.log("--------------------------------------------------");
        console.log("PriorityFixa Commerce API request");
        console.log("Method:", request.method);
        console.log("Path:", url.pathname);
        console.log("Time:", new Date().toISOString());
        console.log("--------------------------------------------------");


        /* ======================================================
           OPTIONS / CORS PREFLIGHT
           ====================================================== */

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS,
            });
        }


        /* ======================================================
           HEALTH CHECK
           ====================================================== */

        if (
            url.pathname === "/" &&
            request.method === "GET"
        ) {
            return jsonResponse({
                success: true,
                service: "PriorityFixa Commerce API",
                status: "online",
                timestamp: new Date().toISOString(),
            });
        }


        /* ======================================================
           DEBUG: KV BINDINGS
           ====================================================== */

        if (
            url.pathname === "/debug/bindings" &&
            request.method === "GET"
        ) {
            return jsonResponse({
                success: true,
                worker: "priorityfixa-income-api",
                ordersKV: !!env.ORDERS_KV,
                paymentsKV: !!env.PAYMENTS_KV,
            });
        }


        /* ======================================================
           DEBUG: CALLBACK STATUS
           ====================================================== */

        if (
            url.pathname === "/debug/callback" &&
            request.method === "GET"
        ) {
            try {

                const lastCallback =
                    await env.PAYMENTS_KV.get(
                        "DEBUG:LAST_CALLBACK",
                        "json"
                    );

                const lastSuccess =
                    await env.PAYMENTS_KV.get(
                        "DEBUG:LAST_CALLBACK_SUCCESS",
                        "json"
                    );

                const lastError =
                    await env.PAYMENTS_KV.get(
                        "DEBUG:LAST_CALLBACK_ERROR",
                        "json"
                    );

                return jsonResponse({
                    success: true,
                    lastCallback,
                    lastSuccess,
                    lastError,
                });

            } catch (error) {

                console.error(
                    "Debug callback endpoint error:",
                    error
                );

                return jsonResponse({
                    success: false,
                    error: error.message,
                }, 500);
            }
        }


        /* ======================================================
           DEBUG: ORDER
           ====================================================== */

        if (
            url.pathname === "/debug/order" &&
            request.method === "GET"
        ) {

            const orderId =
                url.searchParams.get("orderId");

            if (!orderId) {
                return jsonResponse({
                    success: false,
                    error: "Missing orderId.",
                }, 400);
            }

            try {

                const order =
                    await env.ORDERS_KV.get(
                        `ORDER:${orderId}`,
                        "json"
                    );

                const payment =
                    await env.PAYMENTS_KV.get(
                        `ORDER_PAYMENT:${orderId}`,
                        "json"
                    );

                return jsonResponse({
                    success: true,
                    order,
                    payment,
                });

            } catch (error) {

                console.error(
                    "Debug order error:",
                    error
                );

                return jsonResponse({
                    success: false,
                    error: error.message,
                }, 500);
            }
        }


        /* ======================================================
           POST /orders
           CREATE ORDER
           ====================================================== */

        if (
            url.pathname === "/orders" &&
            request.method === "POST"
        ) {

            try {

                const body = await request.json();

                console.log("Create order request:", body);


                /* ------------------------------------------------
                   VALIDATE REQUEST
                   ------------------------------------------------ */

                if (
                    !body ||
                    !body.customer ||
                    !Array.isArray(body.items) ||
                    body.items.length === 0
                ) {
                    return jsonResponse({
                        success: false,
                        error: "Invalid order request.",
                        details:
                            "Customer information and at least one item are required.",
                    }, 400);
                }


                const customer = body.customer;

                if (!customer.name) {
                    return jsonResponse({
                        success: false,
                        error: "Customer name is required.",
                    }, 400);
                }

                if (!customer.phone) {
                    return jsonResponse({
                        success: false,
                        error: "Customer phone number is required.",
                    }, 400);
                }


                /* ------------------------------------------------
                   NORMALIZE ITEMS
                   ------------------------------------------------ */

                const items = body.items.map((item) => {

                    const price = toNumber(item.price);

                    const quantity =
                        Math.max(
                            1,
                            Math.floor(
                                toNumber(item.quantity || 1)
                            )
                        );

                    return {
                        id: item.id ?? null,
                        name: item.name ?? "Product",
                        price,
                        quantity,
                        image: item.image ?? null,
                    };
                });


                /* ------------------------------------------------
                   CALCULATE TOTAL
                   ------------------------------------------------ */

                const total = items.reduce(
                    (sum, item) => {
                        return sum +
                            (item.price * item.quantity);
                    },
                    0
                );


                if (total <= 0) {
                    return jsonResponse({
                        success: false,
                        error: "Order total must be greater than zero.",
                    }, 400);
                }


                /* ------------------------------------------------
                   CREATE ORDER ID
                   ------------------------------------------------ */

                const orderId =
                    `ORD-${Date.now()}`;


                const now =
                    new Date().toISOString();


                const order = {
                    id: orderId,

                    customer: {
                        name:
                            String(customer.name).trim(),

                        phone:
                            normalizePhoneNumber(
                                customer.phone
                            ),

                        email:
                            customer.email
                                ? String(customer.email).trim()
                                : "",

                        location:
                            customer.location
                                ? String(customer.location).trim()
                                : "",
                    },

                    items,

                    total,

                    currency: "KES",

                    status: "created",

                    paymentStatus: "UNPAID",

                    createdAt: now,

                    updatedAt: now,
                };


                /* ------------------------------------------------
                   SAVE ORDER
                   ------------------------------------------------ */

                await env.ORDERS_KV.put(
                    `ORDER:${orderId}`,
                    JSON.stringify(order)
                );


                console.log(
                    "Order created:",
                    orderId
                );


                return jsonResponse({
                    success: true,
                    orderId,
                    order,
                });

            } catch (error) {

                console.error(
                    "Create order error:",
                    error
                );

                return jsonResponse({
                    success: false,
                    error: "Failed to create order.",
                    details: error.message,
                }, 500);
            }
        }


        /* ======================================================
           POST /payments/mpesa
           INITIATE M-PESA STK PUSH
           ====================================================== */

        if (
            url.pathname === "/payments/mpesa" &&
            request.method === "POST"
        ) {

            try {

                const body = await request.json();

                console.log(
                    "M-Pesa payment request:",
                    body
                );


                /* ------------------------------------------------
                   VALIDATE REQUEST
                   ------------------------------------------------ */

                const orderId =
                    body?.orderId;

                const requestedAmount =
                    toNumber(body?.amount);

                const phone =
                    normalizePhoneNumber(
                        body?.phone
                    );


                if (!orderId) {
                    return jsonResponse({
                        success: false,
                        error: "Missing orderId.",
                    }, 400);
                }


                if (!phone) {
                    return jsonResponse({
                        success: false,
                        error: "Invalid phone number.",
                    }, 400);
                }


                if (!requestedAmount || requestedAmount <= 0) {
                    return jsonResponse({
                        success: false,
                        error: "Invalid payment amount.",
                    }, 400);
                }


                /* ------------------------------------------------
                   LOAD ORDER
                   ------------------------------------------------ */

                const order =
                    await env.ORDERS_KV.get(
                        `ORDER:${orderId}`,
                        "json"
                    );


                if (!order) {
                    return jsonResponse({
                        success: false,
                        error: "Order not found.",
                        orderId,
                    }, 404);
                }


                /* ------------------------------------------------
                   VERIFY PAYMENT AMOUNT
                   ------------------------------------------------ */

                const orderTotal =
                    toNumber(order.total);


                if (
                    Math.round(requestedAmount) !==
                    Math.round(orderTotal)
                ) {

                    return jsonResponse({
                        success: false,
                        error: "Payment amount does not match order total.",
                        orderTotal,
                        requestedAmount,
                    }, 400);
                }


                /* ------------------------------------------------
                   CHECK M-PESA CONFIGURATION
                   ------------------------------------------------ */

                if (
                    !env.MPESA_CONSUMER_KEY ||
                    !env.MPESA_CONSUMER_SECRET ||
                    !env.MPESA_SHORTCODE ||
                    !env.MPESA_PASSKEY
                ) {

                    console.error(
                        "M-Pesa environment variables are missing."
                    );

                    return jsonResponse({
                        success: false,
                        error: "M-Pesa configuration is incomplete.",
                    }, 500);
                }


                /* =================================================
                   GET SAFARICOM OAUTH TOKEN
                   ================================================= */

                const credentials =
                    btoa(
                        `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
                    );


                const tokenResponse =
                    await fetch(
                        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                        {
                            method: "GET",

                            headers: {
                                "Authorization":
                                    `Basic ${credentials}`,
                            },
                        }
                    );


                const tokenText =
                    await tokenResponse.text();


                console.log(
                    "OAuth status:",
                    tokenResponse.status
                );


                if (!tokenResponse.ok) {

                    console.error(
                        "OAuth error:",
                        tokenText
                    );

                    return jsonResponse({
                        success: false,
                        error: "Failed to authenticate with M-Pesa.",
                        details: tokenText,
                    }, 502);
                }


                let tokenData;

                try {

                    tokenData =
                        JSON.parse(tokenText);

                } catch {

                    return jsonResponse({
                        success: false,
                        error: "Invalid OAuth response from M-Pesa.",
                    }, 502);
                }


                const accessToken =
                    tokenData.access_token;


                if (!accessToken) {

                    return jsonResponse({
                        success: false,
                        error: "M-Pesa access token was not returned.",
                    }, 502);
                }


                /* =================================================
                   CREATE STK PUSH
                   ================================================= */

                const timestamp =
                    getMpesaTimestamp();


                const password =
                    createMpesaPassword(
                        env.MPESA_SHORTCODE,
                        env.MPESA_PASSKEY,
                        timestamp
                    );


                const callbackUrl =
                    `${url.origin}/mpesa/callback`;


                const stkPayload = {

                    BusinessShortCode:
                        env.MPESA_SHORTCODE,

                    Password:
                        password,

                    Timestamp:
                        timestamp,

                    TransactionType:
                        "CustomerPayBillOnline",

                    Amount:
                        Math.round(orderTotal),

                    PartyA:
                        phone,

                    PartyB:
                        env.MPESA_SHORTCODE,

                    PhoneNumber:
                        phone,

                    CallBackURL:
                        callbackUrl,

                    AccountReference:
                        orderId,

                    TransactionDesc:
                        `PriorityFixa order ${orderId}`,
                };


                console.log(
                    "M-Pesa STK callback URL:",
                    callbackUrl
                );

                console.log(
                    "M-Pesa STK request:",
                    {
                        ...stkPayload,
                        Password: "[HIDDEN]",
                    }
                );


                const stkResponse =
                    await fetch(
                        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                        {
                            method: "POST",

                            headers: {
                                "Authorization":
                                    `Bearer ${accessToken}`,

                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify(
                                    stkPayload
                                ),
                        }
                    );


                const stkText =
                    await stkResponse.text();


                console.log(
                    "STK response status:",
                    stkResponse.status
                );

                console.log(
                    "STK response:",
                    stkText
                );


                let stkData;

                try {

                    stkData =
                        JSON.parse(stkText);

                } catch {

                    return jsonResponse({
                        success: false,
                        error: "Invalid response from M-Pesa.",
                        details: stkText,
                    }, 502);
                }


                /* ------------------------------------------------
                   CHECK SAFARICOM RESPONSE
                   ------------------------------------------------ */

                if (
                    !stkResponse.ok ||
                    String(stkData.ResponseCode) !== "0"
                ) {

                    console.error(
                        "M-Pesa STK initiation failed:",
                        stkData
                    );

                    return jsonResponse({
                        success: false,
                        error:
                            stkData.errorMessage ||
                            stkData.ResponseDescription ||
                            "M-Pesa payment request failed.",

                        mpesa: stkData,
                    }, 502);
                }


                /* =================================================
                   SAVE PAYMENT
                   ================================================= */

                const payment = {

                    orderId,

                    checkoutRequestId:
                        stkData.CheckoutRequestID,

                    merchantRequestId:
                        stkData.MerchantRequestID,

                    amount:
                        Math.round(orderTotal),

                    phone,

                    status:
                        "PENDING",

                    createdAt:
                        new Date().toISOString(),

                    updatedAt:
                        new Date().toISOString(),
                };


                await env.PAYMENTS_KV.put(
                    `ORDER_PAYMENT:${orderId}`,
                    JSON.stringify(payment)
                );


                /* ------------------------------------------------
                   SAVE CHECKOUT → ORDER MAPPING
                   ------------------------------------------------ */

                if (stkData.CheckoutRequestID) {

                    await env.PAYMENTS_KV.put(

                        `CHECKOUT_ORDER:${stkData.CheckoutRequestID}`,

                        JSON.stringify({
                            orderId,
                            checkoutRequestId:
                                stkData.CheckoutRequestID,

                            createdAt:
                                new Date().toISOString(),
                        })
                    );
                }


                /* ------------------------------------------------
                   UPDATE ORDER
                   ------------------------------------------------ */

                order.status =
                    "payment_pending";

                order.paymentStatus =
                    "PENDING";

                order.updatedAt =
                    new Date().toISOString();

                order.payment =
                    payment;


                await env.ORDERS_KV.put(
                    `ORDER:${orderId}`,
                    JSON.stringify(order)
                );


                console.log(
                    "STK Push initiated successfully:",
                    {
                        orderId,
                        checkoutRequestId:
                            stkData.CheckoutRequestID,
                    }
                );


                /* ------------------------------------------------
                   RESPONSE TO FRONTEND
                   ------------------------------------------------ */

                return jsonResponse({

                    success: true,

                    message:
                        "STK Push initiated successfully.",

                    orderId,

                    payment,

                    mpesa: {

                        MerchantRequestID:
                            stkData.MerchantRequestID,

                        CheckoutRequestID:
                            stkData.CheckoutRequestID,

                        ResponseCode:
                            stkData.ResponseCode,

                        ResponseDescription:
                            stkData.ResponseDescription,

                        CustomerMessage:
                            stkData.CustomerMessage ||
                            "Please check your phone and enter your M-Pesa PIN.",
                    },
                });

            } catch (error) {

                console.error(
                    "M-Pesa payment error:",
                    error
                );

                return jsonResponse({

                    success: false,

                    error:
                        "Failed to initiate M-Pesa payment.",

                    details:
                        error.message,

                }, 500);
            }
        }


        /* ======================================================
           POST /mpesa/callback
           SAFARICOM CALLBACK
           ====================================================== */

        if (
            url.pathname === "/mpesa/callback" &&
            request.method === "POST"
        ) {

            try {

                console.log(
                    "=================================================="
                );

                console.log(
                    "M-PESA CALLBACK RECEIVED"
                );

                console.log(
                    "=================================================="
                );


                /* ------------------------------------------------
                   READ CALLBACK BODY
                   ------------------------------------------------ */

                const callbackBody =
                    await request.json();


                console.log(
                    "Raw callback received:",
                    JSON.stringify(callbackBody)
                );


                /* ------------------------------------------------
                   EXTRACT STK CALLBACK
                   ------------------------------------------------ */

                const stkCallback =
                    callbackBody?.Body?.stkCallback;


                if (!stkCallback) {

                    console.error(
                        "Invalid M-Pesa callback structure."
                    );


                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            receivedAt:
                                new Date().toISOString(),

                            error:
                                "Invalid M-Pesa callback structure.",

                            callbackBody,
                        })
                    );


                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Accepted",

                    });
                }


                /* ------------------------------------------------
                   EXTRACT CALLBACK VALUES
                   ------------------------------------------------ */

                const checkoutRequestId =
                    stkCallback.CheckoutRequestID ||
                    null;


                const merchantRequestId =
                    stkCallback.MerchantRequestID ||
                    null;


                const resultCode =
                    Number(
                        stkCallback.ResultCode
                    );


                const resultDescription =
                    stkCallback.ResultDesc ||
                    "";


                console.log(
                    "Callback details:",
                    {
                        checkoutRequestId,
                        merchantRequestId,
                        resultCode,
                        resultDescription,
                    }
                );


                /* =================================================
                   SAVE CALLBACK DIAGNOSTIC
                   ================================================= */

                await env.PAYMENTS_KV.put(

                    "DEBUG:LAST_CALLBACK",

                    JSON.stringify({

                        receivedAt:
                            new Date().toISOString(),

                        checkoutRequestId,

                        merchantRequestId,

                        resultCode,

                        resultDescription,

                        stkCallback,
                    })
                );


                /* ------------------------------------------------
                   CHECK CHECKOUT REQUEST ID
                   ------------------------------------------------ */

                if (!checkoutRequestId) {

                    console.error(
                        "Callback does not contain CheckoutRequestID."
                    );


                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            receivedAt:
                                new Date().toISOString(),

                            error:
                                "Missing CheckoutRequestID.",

                            resultCode,

                            resultDescription,

                            stkCallback,
                        })
                    );


                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Accepted",

                    });
                }


                /* =================================================
                   FIND ORDER FROM CHECKOUT REQUEST ID
                   ================================================= */

                const mapping =
                    await env.PAYMENTS_KV.get(

                        `CHECKOUT_ORDER:${checkoutRequestId}`,

                        "json"
                    );


                console.log(
                    "Checkout → Order mapping:",
                    mapping
                );


                if (!mapping) {

                    console.error(
                        "No order mapping found for callback:",
                        checkoutRequestId
                    );


                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            receivedAt:
                                new Date().toISOString(),

                            error:
                                "No order mapping found.",

                            checkoutRequestId,

                            merchantRequestId,

                            resultCode,

                            resultDescription,

                        })
                    );


                    /*
                     * We still acknowledge the callback so
                     * Safaricom does not keep retrying indefinitely.
                     */

                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Accepted",

                    });
                }


                const orderId =
                    mapping.orderId;


                console.log(
                    "Callback belongs to order:",
                    orderId
                );


                /* =================================================
                   LOAD ORDER
                   ================================================= */

                const order =
                    await env.ORDERS_KV.get(

                        `ORDER:${orderId}`,

                        "json"
                    );


                if (!order) {

                    console.error(
                        "Order not found:",
                        orderId
                    );


                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            receivedAt:
                                new Date().toISOString(),

                            error:
                                "Order not found.",

                            orderId,

                            checkoutRequestId,

                            merchantRequestId,

                            resultCode,

                            resultDescription,

                        })
                    );


                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Accepted",

                    });
                }


                /* =================================================
                   LOAD PAYMENT
                   ================================================= */

                let payment =
                    await env.PAYMENTS_KV.get(

                        `ORDER_PAYMENT:${orderId}`,

                        "json"
                    );


                if (!payment) {

                    /*
                     * Create a fallback payment record if the
                     * original payment record cannot be found.
                     */

                    payment = {

                        orderId,

                        checkoutRequestId,

                        merchantRequestId,

                        amount:
                            toNumber(order.total),

                        phone:
                            order.customer?.phone ||
                            null,

                        status:
                            "PENDING",

                        createdAt:
                            new Date().toISOString(),

                        updatedAt:
                            new Date().toISOString(),
                    };
                }


                /* =================================================
                   SUCCESSFUL PAYMENT
                   ================================================= */

                if (resultCode === 0) {

                    console.log(
                        "M-PESA PAYMENT SUCCESSFUL:",
                        orderId
                    );


                    /* ---------------------------------------------
                       EXTRACT CALLBACK METADATA
                       --------------------------------------------- */

                    const callbackMetadata =
                        Array.isArray(
                            stkCallback.CallbackMetadata?.Item
                        )
                            ? stkCallback.CallbackMetadata.Item
                            : [];


                    const metadata = {};


                    for (
                        const item
                        of callbackMetadata
                    ) {

                        if (
                            item &&
                            item.Name
                        ) {

                            metadata[item.Name] =
                                item.Value;
                        }
                    }


                    console.log(
                        "Callback metadata:",
                        metadata
                    );


                    /* ---------------------------------------------
                       UPDATE PAYMENT
                       --------------------------------------------- */

                    payment.status =
                        "SUCCESS";

                    payment.updatedAt =
                        new Date().toISOString();

                    payment.resultCode =
                        resultCode;

                    payment.resultDescription =
                        resultDescription;

                    payment.mpesaReceiptNumber =
                        metadata.MpesaReceiptNumber ||
                        null;

                    payment.transactionDate =
                        metadata.TransactionDate ||
                        null;

                    payment.phoneNumber =
                        metadata.PhoneNumber ||
                        payment.phone;

                    payment.amount =
                        metadata.Amount !== undefined
                            ? toNumber(metadata.Amount)
                            : payment.amount;


                    /* ---------------------------------------------
                       UPDATE ORDER
                       --------------------------------------------- */

                    order.status =
                        "paid";

                    order.paymentStatus =
                        "PAID";

                    order.updatedAt =
                        new Date().toISOString();

                    order.payment =
                        payment;


                    /* ---------------------------------------------
                       SAVE PAYMENT
                       --------------------------------------------- */

                    await env.PAYMENTS_KV.put(

                        `ORDER_PAYMENT:${orderId}`,

                        JSON.stringify(payment)
                    );


                    /* ---------------------------------------------
                       SAVE ORDER
                       --------------------------------------------- */

                    await env.ORDERS_KV.put(

                        `ORDER:${orderId}`,

                        JSON.stringify(order)
                    );


                    /* ---------------------------------------------
                       SAVE SUCCESS DIAGNOSTIC
                       --------------------------------------------- */

                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_SUCCESS",

                        JSON.stringify({

                            processedAt:
                                new Date().toISOString(),

                            orderId,

                            checkoutRequestId,

                            merchantRequestId,

                            resultCode,

                            resultDescription,

                            paymentStatus:
                                payment.status,

                            orderStatus:
                                order.status,

                            mpesaReceiptNumber:
                                payment.mpesaReceiptNumber,
                        })
                    );


                    console.log(
                        "Payment and order updated successfully."
                    );


                } else {

                    /* =================================================
                       FAILED / CANCELLED PAYMENT
                       ================================================= */

                    console.log(
                        "M-PESA PAYMENT FAILED/CANCELLED:",
                        {
                            orderId,
                            resultCode,
                            resultDescription,
                        }
                    );


                    /* ---------------------------------------------
                       UPDATE PAYMENT
                       --------------------------------------------- */

                    payment.status =
                        "FAILED";

                    payment.updatedAt =
                        new Date().toISOString();

                    payment.resultCode =
                        resultCode;

                    payment.resultDescription =
                        resultDescription;


                    /* ---------------------------------------------
                       UPDATE ORDER
                       --------------------------------------------- */

                    order.status =
                        "payment_failed";

                    order.paymentStatus =
                        "FAILED";

                    order.updatedAt =
                        new Date().toISOString();

                    order.payment =
                        payment;


                    /* ---------------------------------------------
                       SAVE PAYMENT
                       --------------------------------------------- */

                    await env.PAYMENTS_KV.put(

                        `ORDER_PAYMENT:${orderId}`,

                        JSON.stringify(payment)
                    );


                    /* ---------------------------------------------
                       SAVE ORDER
                       --------------------------------------------- */

                    await env.ORDERS_KV.put(

                        `ORDER:${orderId}`,

                        JSON.stringify(order)
                    );


                    /* ---------------------------------------------
                       SAVE FAILURE DIAGNOSTIC
                       --------------------------------------------- */

                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            processedAt:
                                new Date().toISOString(),

                            error:
                                "M-Pesa payment failed or was cancelled.",

                            orderId,

                            checkoutRequestId,

                            merchantRequestId,

                            resultCode,

                            resultDescription,

                            paymentStatus:
                                payment.status,

                            orderStatus:
                                order.status,

                        })
                    );
                }


                /* =================================================
                   ACKNOWLEDGE SAFARICOM
                   ================================================= */

                return jsonResponse({

                    ResultCode: 0,

                    ResultDesc:
                        "Accepted",

                });


            } catch (error) {

                /* =================================================
                   CALLBACK ERROR
                   ================================================= */

                console.error(
                    "=================================================="
                );

                console.error(
                    "M-PESA CALLBACK PROCESSING ERROR"
                );

                console.error(
                    error
                );

                console.error(
                    "=================================================="
                );


                /* ------------------------------------------------
                   SAVE ERROR TO KV
                   ------------------------------------------------ */

                try {

                    await env.PAYMENTS_KV.put(

                        "DEBUG:LAST_CALLBACK_ERROR",

                        JSON.stringify({

                            receivedAt:
                                new Date().toISOString(),

                            error:
                                error.message,

                            stack:
                                error.stack ||
                                null,
                        })
                    );

                } catch (kvError) {

                    console.error(
                        "Could not save callback error to KV:",
                        kvError
                    );
                }


                /*
                 * Acknowledge Safaricom even if internal
                 * processing fails.
                 */

                return jsonResponse({

                    ResultCode: 0,

                    ResultDesc:
                        "Accepted",

                });
            }
        }


        /* ======================================================
           GET ORDER STATUS
           ======================================================
           
           This endpoint will also be useful for the frontend
           later so the checkout page can poll payment status.
           
           Example:
           /orders/status?orderId=ORD-123
           
           ====================================================== */

        if (
            url.pathname === "/orders/status" &&
            request.method === "GET"
        ) {

            const orderId =
                url.searchParams.get("orderId");


            if (!orderId) {

                return jsonResponse({

                    success: false,

                    error:
                        "Missing orderId.",

                }, 400);
            }


            try {

                const order =
                    await env.ORDERS_KV.get(

                        `ORDER:${orderId}`,

                        "json"
                    );


                if (!order) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Order not found.",

                        orderId,

                    }, 404);
                }


                const payment =
                    await env.PAYMENTS_KV.get(

                        `ORDER_PAYMENT:${orderId}`,

                        "json"
                    );


                return jsonResponse({

                    success: true,

                    orderId,

                    status:
                        order.status,

                    paymentStatus:
                        order.paymentStatus,

                    order,

                    payment,

                });

            } catch (error) {

                console.error(
                    "Order status error:",
                    error
                );


                return jsonResponse({

                    success: false,

                    error:
                        "Failed to retrieve order status.",

                    details:
                        error.message,

                }, 500);
            }
        }


        /* ======================================================
           404
           ====================================================== */

        return jsonResponse({

            success: false,

            error:
                "Endpoint not found.",

            path:
                url.pathname,

            method:
                request.method,

        }, 404);
    },
};
