export default {

    async fetch(request, env) {

        const url = new URL(request.url);

        /* =========================
           CORS
        ========================== */

        const corsHeaders = {

            "Access-Control-Allow-Origin": "*",

            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type"

        };


        /* =========================
           JSON RESPONSE
        ========================== */

        function jsonResponse(data, status = 200) {

            return new Response(

                JSON.stringify(data),

                {

                    status,

                    headers: {

                        ...corsHeaders,

                        "Content-Type":
                            "application/json"

                    }

                }

            );

        }


        /* =========================
           OPTIONS
        ========================== */

        if (request.method === "OPTIONS") {

            return new Response(
                null,
                {
                    status: 204,
                    headers: corsHeaders
                }
            );

        }


        /* =========================
           HEALTH CHECK
        ========================== */

        if (
            url.pathname === "/" &&
            request.method === "GET"
        ) {

            return jsonResponse({

                success: true,

                service:
                    "PriorityFixa Commerce API",

                status:
                    "online"

            });

        }


        /* =========================
           PHONE NORMALIZATION
        ========================== */

        function normalizePhoneNumber(phone) {

            let value =
                String(phone || "")
                    .replace(/\s+/g, "")
                    .replace(/^\+/, "");


            if (
                /^07\d{8}$/.test(value)
            ) {

                return "254" + value.substring(1);

            }


            if (
                /^7\d{8}$/.test(value)
            ) {

                return "254" + value;

            }


            if (
                /^2547\d{8}$/.test(value)
            ) {

                return value;

            }


            return value;

        }


        /* =========================
           MPESA TIMESTAMP
        ========================== */

        function getTimestamp() {

            const now =
                new Date();

            const year =
                now.getFullYear();

            const month =
                String(
                    now.getMonth() + 1
                ).padStart(2, "0");

            const day =
                String(
                    now.getDate()
                ).padStart(2, "0");

            const hours =
                String(
                    now.getHours()
                ).padStart(2, "0");

            const minutes =
                String(
                    now.getMinutes()
                ).padStart(2, "0");

            const seconds =
                String(
                    now.getSeconds()
                ).padStart(2, "0");


            return (
                year +
                month +
                day +
                hours +
                minutes +
                seconds
            );

        }


        /* =========================
           CREATE ORDER
        ========================== */

        if (
            url.pathname === "/orders" &&
            request.method === "POST"
        ) {

            try {

                const data =
                    await request.json();


                if (
                    !data.customer ||
                    !Array.isArray(data.items) ||
                    data.items.length === 0
                ) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Customer and items are required."

                    }, 400);

                }


                const orderId =
                    "ORD-" +
                    Date.now();


                let total = 0;


                for (
                    const item of data.items
                ) {

                    const price =
                        Number(item.price);

                    const quantity =
                        Number(item.quantity);


                    if (
                        !Number.isFinite(price) ||
                        !Number.isFinite(quantity) ||
                        quantity <= 0
                    ) {

                        return jsonResponse({

                            success: false,

                            error:
                                "Invalid product price or quantity."

                        }, 400);

                    }


                    total +=
                        price * quantity;

                }


                const now =
                    new Date().toISOString();


                const order = {

                    id:
                        orderId,

                    customer:
                        data.customer,

                    items:
                        data.items,

                    total:
                        total,

                    createdAt:
                        now,

                    updatedAt:
                        now,

                    status:
                        "pending",

                    paymentStatus:
                        "PENDING"

                };


                /* =========================
                   SAVE ORDER
                ========================== */

                await env.ORDERS_KV.put(

                    "ORDER:" +
                    orderId,

                    JSON.stringify(order)

                );


                console.log(
                    "NEW_ORDER",
                    JSON.stringify(order)
                );


                return jsonResponse({

                    success: true,

                    order:
                        order

                }, 201);


            } catch (error) {

                console.error(
                    "ORDER_CREATION_ERROR",
                    error
                );


                return jsonResponse({

                    success: false,

                    error:
                        "Invalid order request.",

                    details:
                        error.message

                }, 400);

            }

        }


        /* =========================
           M-PESA STK PUSH
        ========================== */

        if (
            url.pathname === "/payments/mpesa" &&
            request.method === "POST"
        ) {

            try {

                const data =
                    await request.json();


                const orderId =
                    String(
                        data.orderId || ""
                    ).trim();


                const amount =
                    Number(data.amount);


                const phone =
                    normalizePhoneNumber(
                        data.phone
                    );


                if (!orderId) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Order ID is required."

                    }, 400);

                }


                if (
                    !Number.isFinite(amount) ||
                    amount < 1
                ) {

                    return jsonResponse({

                        success: false,

                        error:
                            "A valid payment amount is required."

                    }, 400);

                }


                if (
                    !/^2547\d{8}$/.test(phone)
                ) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Invalid Kenyan phone number."

                    }, 400);

                }


                /* =========================
                   GET ORDER
                ========================== */

                const order =
                    await env.ORDERS_KV.get(

                        "ORDER:" +
                        orderId,

                        "json"

                    );


                if (!order) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Order not found."

                    }, 404);

                }


                /* =========================
                   VERIFY AMOUNT
                ========================== */

                if (
                    Math.round(
                        Number(order.total)
                    ) !==
                    Math.round(amount)
                ) {

                    return jsonResponse({

                        success: false,

                        error:
                            "Payment amount does not match order total."

                    }, 400);

                }


                /* =========================
                   GET MPESA TOKEN
                ========================== */

                const credentials =
                    btoa(

                        env.MPESA_CONSUMER_KEY +
                        ":" +
                        env.MPESA_CONSUMER_SECRET

                    );


                const tokenResponse =
                    await fetch(

                        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",

                        {

                            method:
                                "GET",

                            headers: {

                                "Authorization":
                                    "Basic " +
                                    credentials

                            }

                        }

                    );


                const tokenData =
                    await tokenResponse.json();


                if (
                    !tokenResponse.ok ||
                    !tokenData.access_token
                ) {

                    console.error(
                        "MPESA_TOKEN_ERROR",
                        tokenData
                    );


                    return jsonResponse({

                        success: false,

                        error:
                            "Unable to obtain M-Pesa access token."

                    }, 502);

                }


                /* =========================
                   STK PASSWORD
                ========================== */

                const timestamp =
                    getTimestamp();


                const password =
                    btoa(

                        env.MPESA_SHORTCODE +
                        env.MPESA_PASSKEY +
                        timestamp

                    );


                /* =========================
                   STK PAYLOAD
                ========================== */

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
                        Math.round(amount),

                    PartyA:
                        phone,

                    PartyB:
                        env.MPESA_SHORTCODE,

                    PhoneNumber:
                        phone,

                    CallBackURL:
                        url.origin +
                        "/mpesa/callback",

                    AccountReference:
                        orderId,

                    TransactionDesc:
                        "PriorityFixa Order " +
                        orderId

                };


                console.log(
                    "MPESA_STK_REQUEST",
                    JSON.stringify({
                        orderId,
                        amount,
                        phone,
                        callbackUrl:
                            stkPayload.CallBackURL
                    })
                );


                /* =========================
                   SEND STK PUSH
                ========================== */

                const stkResponse =
                    await fetch(

                        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",

                        {

                            method:
                                "POST",

                            headers: {

                                "Authorization":
                                    "Bearer " +
                                    tokenData.access_token,

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    stkPayload
                                )

                        }

                    );


                const stkData =
                    await stkResponse.json();


                console.log(
                    "MPESA_STK_RESPONSE",
                    JSON.stringify(stkData)
                );


                if (
                    !stkResponse.ok ||
                    stkData.ResponseCode !== "0"
                ) {

                    return jsonResponse({

                        success: false,

                        error:
                            stkData.errorMessage ||
                            stkData.ResponseDescription ||
                            "M-Pesa STK Push failed.",

                        response:
                            stkData

                    }, 502);

                }


                /* =========================
                   SAVE PAYMENT
                ========================== */

                const payment = {

                    orderId:
                        orderId,

                    checkoutRequestId:
                        stkData.CheckoutRequestID,

                    merchantRequestId:
                        stkData.MerchantRequestID,

                    amount:
                        Math.round(amount),

                    phone:
                        phone,

                    status:
                        "PENDING",

                    resultCode:
                        null,

                    resultDescription:
                        null,

                    createdAt:
                        new Date().toISOString(),

                    updatedAt:
                        new Date().toISOString()

                };


                await env.PAYMENTS_KV.put(

                    "ORDER_PAYMENT:" +
                    orderId,

                    JSON.stringify(payment)

                );


                /* =========================
                   MAP CHECKOUT REQUEST
                ========================== */

                await env.PAYMENTS_KV.put(

                    "CHECKOUT_ORDER:" +
                    stkData.CheckoutRequestID,

                    orderId

                );


                /* =========================
                   UPDATE ORDER
                ========================== */

                order.status =
                    "payment_pending";

                order.paymentStatus =
                    "PENDING";

                order.updatedAt =
                    new Date().toISOString();


                order.payment = {

                    checkoutRequestId:
                        stkData.CheckoutRequestID,

                    merchantRequestId:
                        stkData.MerchantRequestID,

                    status:
                        "PENDING"

                };


                await env.ORDERS_KV.put(

                    "ORDER:" +
                    orderId,

                    JSON.stringify(order)

                );


                return jsonResponse({

                    success: true,

                    message:
                        "M-Pesa payment request sent.",

                    response:
                        stkData

                });


            } catch (error) {

                console.error(
                    "MPESA_PAYMENT_ERROR",
                    error
                );


                return jsonResponse({

                    success: false,

                    error:
                        "M-Pesa payment could not be initiated.",

                    details:
                        error.message

                }, 500);

            }

        }


        /* =========================
           M-PESA CALLBACK
        ========================== */

        if (
            url.pathname === "/mpesa/callback" &&
            request.method === "POST"
        ) {

            try {

                const data =
                    await request.json();


                console.log(
                    "MPESA_CALLBACK",
                    JSON.stringify(data)
                );


                const callback =
                    data?.Body?.stkCallback;


                if (!callback) {

                    return jsonResponse({

                        ResultCode: 1,

                        ResultDesc:
                            "Invalid callback."

                    }, 400);

                }


                const checkoutRequestId =
                    callback.CheckoutRequestID;


                const merchantRequestId =
                    callback.MerchantRequestID;


                const resultCode =
                    Number(callback.ResultCode);


                const resultDescription =
                    callback.ResultDesc || "";


                /* =========================
                   FIND ORDER
                ========================== */

                const orderId =
                    await env.PAYMENTS_KV.get(

                        "CHECKOUT_ORDER:" +
                        checkoutRequestId

                    );


                if (!orderId) {

                    console.error(
                        "ORDER_NOT_FOUND_FOR_CALLBACK",
                        checkoutRequestId
                    );


                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Callback received."

                    });

                }


                /* =========================
                   GET ORDER
                ========================== */

                const order =
                    await env.ORDERS_KV.get(

                        "ORDER:" +
                        orderId,

                        "json"

                    );


                if (!order) {

                    return jsonResponse({

                        ResultCode: 0,

                        ResultDesc:
                            "Callback received."

                    });

                }


                const payment =
                    await env.PAYMENTS_KV.get(

                        "ORDER_PAYMENT:" +
                        orderId,

                        "json"

                    );


                const now =
                    new Date().toISOString();


                /* =========================
                   PAYMENT SUCCESS
                ========================== */

                if (resultCode === 0) {

                    const callbackMetadata =
                        callback.CallbackMetadata?.Item ||
                        [];


                    let mpesaReceiptNumber =
                        null;

                    let transactionDate =
                        null;

                    let paidAmount =
                        null;


                    for (
                        const item of callbackMetadata
                    ) {

                        if (
                            item.Name ===
                            "MpesaReceiptNumber"
                        ) {

                            mpesaReceiptNumber =
                                item.Value;

                        }


                        if (
                            item.Name ===
                            "TransactionDate"
                        ) {

                            transactionDate =
                                item.Value;

                        }


                        if (
                            item.Name ===
                            "Amount"
                        ) {

                            paidAmount =
                                item.Value;

                        }

                    }


                    order.status =
                        "paid";

                    order.paymentStatus =
                        "PAID";

                    order.updatedAt =
                        now;


                    order.payment = {

                        ...(order.payment || {}),

                        checkoutRequestId:
                            checkoutRequestId,

                        merchantRequestId:
                            merchantRequestId,

                        status:
                            "PAID",

                        resultCode:
                            resultCode,

                        resultDescription:
                            resultDescription,

                        mpesaReceiptNumber:
                            mpesaReceiptNumber,

                        transactionDate:
                            transactionDate,

                        paidAmount:
                            paidAmount,

                        updatedAt:
                            now

                    };


                    await env.ORDERS_KV.put(

                        "ORDER:" +
                        orderId,

                        JSON.stringify(order)

                    );


                    const updatedPayment = {

                        ...(payment || {}),

                        orderId:
                            orderId,

                        checkoutRequestId:
                            checkoutRequestId,

                        merchantRequestId:
                            merchantRequestId,

                        status:
                            "PAID",

                        resultCode:
                            resultCode,

                        resultDescription:
                            resultDescription,

                        mpesaReceiptNumber:
                            mpesaReceiptNumber,

                        transactionDate:
                            transactionDate,

                        paidAmount:
                            paidAmount,

                        updatedAt:
                            now

                    };


                    await env.PAYMENTS_KV.put(

                        "ORDER_PAYMENT:" +
                        orderId,

                        JSON.stringify(
                            updatedPayment
                        )

                    );

                }

                /* =========================
                   PAYMENT FAILED / CANCELLED
                ========================== */

                else {

                    order.status =
                        "payment_failed";

                    order.paymentStatus =
                        "FAILED";

                    order.updatedAt =
                        now;


                    order.payment = {

                        ...(order.payment || {}),

                        checkoutRequestId:
                            checkoutRequestId,

                        merchantRequestId:
                            merchantRequestId,

                        status:
                            "FAILED",

                        resultCode:
                            resultCode,

                        resultDescription:
                            resultDescription,

                        updatedAt:
                            now

                    };


                    await env.ORDERS_KV.put(

                        "ORDER:" +
                        orderId,

                        JSON.stringify(order)

                    );


                    const updatedPayment = {

                        ...(payment || {}),

                        orderId:
                            orderId,

                        checkoutRequestId:
                            checkoutRequestId,

                        merchantRequestId:
                            merchantRequestId,

                        status:
                            "FAILED",

                        resultCode:
                            resultCode,

                        resultDescription:
                            resultDescription,

                        updatedAt:
                            now

                    };


                    await env.PAYMENTS_KV.put(

                        "ORDER_PAYMENT:" +
                        orderId,

                        JSON.stringify(
                            updatedPayment
                        )

                    );

                }


                /* =========================
                   ACKNOWLEDGE CALLBACK
                ========================== */

                return jsonResponse({

                    ResultCode:
                        0,

                    ResultDesc:
                        "Callback received successfully."

                });


            } catch (error) {

                console.error(
                    "MPESA_CALLBACK_ERROR",
                    error
                );


                return jsonResponse({

                    ResultCode:
                        0,

                    ResultDesc:
                        "Callback received."

                });

            }

        }


        /* =========================
           NOT FOUND
        ========================== */

        return jsonResponse({

            success: false,

            error:
                "Endpoint not found."

        }, 404);

    }

};
