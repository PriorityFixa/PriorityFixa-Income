const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
    });
}

function normalizePhoneNumber(phone) {
    const value = String(phone || "").trim();

    if (value.startsWith("254")) {
        return value;
    }

    if (value.startsWith("+254")) {
        return value.substring(1);
    }

    if (value.startsWith("0")) {
        return "254" + value.substring(1);
    }

    return value;
}

function getTimestamp() {
    return new Date().toISOString();
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // ---------------------------------------
        // HEALTH CHECK
        // ---------------------------------------
        if (url.pathname === "/" && request.method === "GET") {
            return jsonResponse({
                success: true,
                service: "PriorityFixa Commerce API",
                status: "online"
            });
        }

        // ---------------------------------------
        // CREATE ORDER
        // ---------------------------------------
        if (
            url.pathname === "/orders" &&
            request.method === "POST"
        ) {
            try {
                const data = await request.json();

                if (!data.customer || !data.items) {
                    return jsonResponse(
                        {
                            success: false,
                            error: "Customer and items are required."
                        },
                        400
                    );
                }

                if (!Array.isArray(data.items) || data.items.length === 0) {
                    return jsonResponse(
                        {
                            success: false,
                            error: "Order must contain at least one item."
                        },
                        400
                    );
                }

                const orderId = "ORD-" + Date.now();

                let total = 0;

                const items = data.items.map((item) => {
                    const price = Number(item.price);
                    const quantity = Number(item.quantity);

                    if (
                        !Number.isFinite(price) ||
                        !Number.isFinite(quantity) ||
                        quantity <= 0
                    ) {
                        throw new Error("Invalid product price or quantity.");
                    }

                    total += price * quantity;

                    return {
                        id: item.id,
                        name: item.name,
                        price,
                        image: item.image || "",
                        quantity
                    };
                });

                const order = {
                    id: orderId,

                    customer: {
                        name: String(data.customer.name || "").trim(),
                        phone: String(data.customer.phone || "").trim(),
                        email: String(data.customer.email || "").trim(),
                        location: String(data.customer.location || "").trim()
                    },

                    items,

                    total,

                    createdAt: getTimestamp(),
                    updatedAt: getTimestamp(),

                    status: "pending",
                    paymentStatus: "PENDING"
                };

                // Save order to ORDERS_KV
                await env.ORDERS_KV.put(
                    `ORDER:${orderId}`,
                    JSON.stringify(order)
                );

                console.log("New order:", order);

                return jsonResponse(
                    {
                        success: true,
                        order
                    },
                    201
                );

            } catch (error) {
                console.error("Order creation error:", error);

                return jsonResponse(
                    {
                        success: false,
                        error: error.message || "Unable to create order."
                    },
                    400
                );
            }
        }

        // ---------------------------------------
        // INITIATE M-PESA STK PUSH
        // ---------------------------------------
        if (
            url.pathname === "/payments/mpesa" &&
            request.method === "POST"
        ) {
            try {
                const data = await request.json();

                const orderId = String(data.orderId || "").trim();
                const phone = normalizePhoneNumber(data.phone);
                const amount = Number(data.amount);

                if (!orderId || !phone || !amount) {
                    return jsonResponse(
                        {
                            success: false,
                            error: "orderId, amount and phone are required."
                        },
                        400
                    );
                }

                // Get order
                const orderData = await env.ORDERS_KV.get(
                    `ORDER:${orderId}`
                );

                if (!orderData) {
                    return jsonResponse(
                        {
                            success: false,
                            error: "Order not found."
                        },
                        404
                    );
                }

                const order = JSON.parse(orderData);

                // Make sure payment amount matches order
                if (Number(order.total) !== amount) {
                    return jsonResponse(
                        {
                            success: false,
                            error: "Payment amount does not match order total."
                        },
                        400
                    );
                }

                // ---------------------------------------
                // GET SAFARICOM ACCESS TOKEN
                // ---------------------------------------
                const credentials = btoa(
                    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
                );

                const tokenResponse = await fetch(
                    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Basic ${credentials}`
                        }
                    }
                );

                const tokenData = await tokenResponse.json();

                if (
                    !tokenResponse.ok ||
                    !tokenData.access_token
                ) {
                    console.error(
                        "M-Pesa token error:",
                        tokenData
                    );

                    return jsonResponse(
                        {
                            success: false,
                            error: "Unable to authenticate with M-Pesa."
                        },
                        500
                    );
                }

                const timestamp = getTimestamp()
                    .replace(/\D/g, "")
                    .substring(0, 14);

                const password = btoa(
                    `${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`
                );

                // ---------------------------------------
                // STK PUSH
                // ---------------------------------------
                const stkPayload = {
                    BusinessShortCode: env.MPESA_SHORTCODE,
                    Password: password,
                    Timestamp: timestamp,
                    TransactionType: "CustomerPayBillOnline",
                    Amount: Math.round(amount),
                    PartyA: phone,
                    PartyB: env.MPESA_SHORTCODE,
                    PhoneNumber: phone,
                    CallBackURL: `${url.origin}/mpesa/callback`,
                    AccountReference: orderId,
                    TransactionDesc: `PriorityFixa order ${orderId}`
                };

                console.log("Sending STK Push:", stkPayload);

                const stkResponse = await fetch(
                    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${tokenData.access_token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(stkPayload)
                    }
                );

                const stkData = await stkResponse.json();

                console.log("STK Push response:", stkData);

                if (
                    !stkResponse.ok ||
                    stkData.ResponseCode !== "0"
                ) {
                    return jsonResponse(
                        {
                            success: false,
                            error:
                                stkData.errorMessage ||
                                stkData.ResponseDescription ||
                                "M-Pesa STK Push failed.",
                            response: stkData
                        },
                        400
                    );
                }

                // ---------------------------------------
                // SAVE PAYMENT
                // ---------------------------------------
                const payment = {
                    orderId,

                    checkoutRequestId:
                        stkData.CheckoutRequestID,

                    merchantRequestId:
                        stkData.MerchantRequestID,

                    amount,

                    phone,

                    status: "PENDING",

                    createdAt: getTimestamp(),
                    updatedAt: getTimestamp()
                };

                await env.PAYMENTS_KV.put(
                    `ORDER_PAYMENT:${orderId}`,
                    JSON.stringify(payment)
                );

                await env.PAYMENTS_KV.put(
                    `CHECKOUT_ORDER:${stkData.CheckoutRequestID}`,
                    orderId
                );

                // Update order
                order.status = "payment_pending";
                order.paymentStatus = "PENDING";
                order.updatedAt = getTimestamp();
                order.payment = payment;

                await env.ORDERS_KV.put(
                    `ORDER:${orderId}`,
                    JSON.stringify(order)
                );

                return jsonResponse({
                    success: true,
                    message: "M-Pesa payment request sent.",
                    orderId,
                    response: stkData
                });

            } catch (error) {
                console.error(
                    "M-Pesa payment error:",
                    error
                );

                return jsonResponse(
                    {
                        success: false,
                        error:
                            error.message ||
                            "Unable to initiate M-Pesa payment."
                    },
                    500
                );
            }
        }

        // ---------------------------------------
        // M-PESA CALLBACK
        // ---------------------------------------
        if (
            url.pathname === "/mpesa/callback" &&
            request.method === "POST"
        ) {
            try {
                const callbackData = await request.json();

                console.log(
                    "M-Pesa callback:",
                    JSON.stringify(callbackData)
                );

                const stkCallback =
                    callbackData?.Body?.stkCallback;

                if (!stkCallback) {
                    return jsonResponse({
                        ResultCode: 0,
                        ResultDesc: "Accepted"
                    });
                }

                const checkoutRequestId =
                    stkCallback.CheckoutRequestID;

                const resultCode =
                    Number(stkCallback.ResultCode);

                const resultDescription =
                    stkCallback.ResultDesc || "";

                // Find order from payment KV
                const orderId =
                    await env.PAYMENTS_KV.get(
                        `CHECKOUT_ORDER:${checkoutRequestId}`
                    );

                if (!orderId) {
                    console.error(
                        "Order not found for CheckoutRequestID:",
                        checkoutRequestId
                    );

                    return jsonResponse({
                        ResultCode: 0,
                        ResultDesc: "Accepted"
                    });
                }

                const orderData =
                    await env.ORDERS_KV.get(
                        `ORDER:${orderId}`
                    );

                if (!orderData) {
                    return jsonResponse({
                        ResultCode: 0,
                        ResultDesc: "Accepted"
                    });
                }

                const order = JSON.parse(orderData);

                const paymentKey =
                    `ORDER_PAYMENT:${orderId}`;

                const paymentData =
                    await env.PAYMENTS_KV.get(paymentKey);

                const payment = paymentData
                    ? JSON.parse(paymentData)
                    : {
                        orderId,
                        checkoutRequestId
                    };

                payment.updatedAt = getTimestamp();
                payment.resultCode = resultCode;
                payment.resultDescription =
                    resultDescription;

                // ---------------------------------------
                // SUCCESSFUL PAYMENT
                // ---------------------------------------
                if (resultCode === 0) {
                    payment.status = "SUCCESS";

                    const metadata =
                        stkCallback.CallbackMetadata?.Item ||
                        [];

                    for (const item of metadata) {
                        if (item.Name === "Amount") {
                            payment.mpesaAmount =
                                item.Value;
                        }

                        if (item.Name === "MpesaReceiptNumber") {
                            payment.mpesaReceiptNumber =
                                item.Value;
                        }

                        if (item.Name === "TransactionDate") {
                            payment.transactionDate =
                                item.Value;
                        }

                        if (item.Name === "PhoneNumber") {
                            payment.phone =
                                item.Value;
                        }
                    }

                    order.status = "paid";
                    order.paymentStatus = "PAID";
                }

                // ---------------------------------------
                // FAILED / CANCELLED PAYMENT
                // ---------------------------------------
                else {
                    payment.status = "FAILED";

                    order.status = "payment_failed";
                    order.paymentStatus = "FAILED";
                }

                order.updatedAt = getTimestamp();
                order.payment = payment;

                // Save payment
                await env.PAYMENTS_KV.put(
                    paymentKey,
                    JSON.stringify(payment)
                );

                // Save updated order
                await env.ORDERS_KV.put(
                    `ORDER:${orderId}`,
                    JSON.stringify(order)
                );

                console.log(
                    "Payment updated:",
                    payment
                );

                console.log(
                    "Order updated:",
                    order
                );

                // Safaricom expects acknowledgement
                return jsonResponse({
                    ResultCode: 0,
                    ResultDesc: "Accepted"
                });

            } catch (error) {
                console.error(
                    "Callback error:",
                    error
                );

                // Always acknowledge callback
                return jsonResponse({
                    ResultCode: 0,
                    ResultDesc: "Accepted"
                });
            }
        }

        // ---------------------------------------
        // UNKNOWN ENDPOINT
        // ---------------------------------------
        return jsonResponse(
            {
                success: false,
                error: "Endpoint not found."
            },
            404
        );
    }
};
