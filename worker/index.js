export default {

    async fetch(request, env) {

        const url =
            new URL(request.url);

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
           OPTIONS
        ========================== */

        if (request.method === "OPTIONS") {

            return new Response(
                null,
                {
                    headers: corsHeaders
                }
            );

        }


        /* =========================
           HEALTH CHECK
        ========================== */

        if (
            url.pathname ===
            "/"
        ) {

            return new Response(

                JSON.stringify({

                    success: true,

                    service:
                        "PriorityFixa Commerce API",

                    status:
                        "online"

                }),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/json"
                    }
                }

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
                    !data.items
                ) {

                    return new Response(

                        JSON.stringify({

                            success: false,

                            error:
                                "Customer and items are required."

                        }),

                        {
                            status: 400,

                            headers: {
                                ...corsHeaders,
                                "Content-Type":
                                    "application/json"
                            }
                        }

                    );

                }


                const orderId =
                    "ORD-" +
                    Date.now();


                const order = {

                    id: orderId,

                    customer:
                        data.customer,

                    items:
                        data.items,

                    createdAt:
                        new Date().toISOString(),

                    status:
                        "pending"

                };


                console.log(
                    "New order:",
                    order
                );


                return new Response(

                    JSON.stringify({

                        success: true,

                        order

                    }),

                    {
                        status: 201,

                        headers: {
                            ...corsHeaders,
                            "Content-Type":
                                "application/json"
                        }
                    }

                );


            } catch (error) {

                return new Response(

                    JSON.stringify({

                        success: false,

                        error:
                            "Invalid request."

                    }),

                    {
                        status: 400,

                        headers: {
                            ...corsHeaders,
                            "Content-Type":
                                "application/json"
                        }
                    }

                );

            }

        }


        /* =========================
           NOT FOUND
        ========================== */

        return new Response(

            JSON.stringify({

                success: false,

                error:
                    "Endpoint not found."

            }),

            {
                status: 404,

                headers: {
                    ...corsHeaders,
                    "Content-Type":
                        "application/json"
                }
            }

        );

    }

};
