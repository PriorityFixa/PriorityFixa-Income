/* =========================================================
   PRIORITYFIXA COMMERCE — CART
========================================================= */


const CART_KEY = "priorityfixa_cart";


/* =========================
   GET CART
========================= */

function getCart() {

    const savedCart =
        localStorage.getItem(CART_KEY);

    if (!savedCart) {
        return [];
    }

    try {

        return JSON.parse(savedCart);

    } catch (error) {

        console.error("Cart could not be loaded:", error);

        return [];

    }
}


/* =========================
   SAVE CART
========================= */

function saveCart(cart) {

    localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
    );

}


/* =========================
   ADD TO CART
========================= */

function addToCart(productId) {

    if (typeof PRODUCTS === "undefined") {

        console.error("PRODUCTS is not loaded.");

        return;

    }


    const product =
        PRODUCTS.find(
            item => String(item.id) === String(productId)
        );


    if (!product) {

        console.error(
            "Product not found:",
            productId
        );

        return;

    }


    const cart = getCart();


    const existingItem =
        cart.find(
            item => String(item.id) === String(productId)
        );


    if (existingItem) {

        existingItem.quantity += 1;

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price: Number(product.price),

            image: product.image,

            quantity: 1

        });

    }


    saveCart(cart);

    updateCartCount();


    console.log(
        `${product.name} added to cart.`
    );

}


/* =========================
   UPDATE CART COUNT
========================= */

function updateCartCount() {

    const cart = getCart();

    const count =
        cart.reduce(
            (total, item) =>
                total + Number(item.quantity),
            0
        );


    const cartCount =
        document.getElementById("cart-count");


    if (cartCount) {

        cartCount.textContent = count;

    }

}


/* =========================
   ADD-TO-CART BUTTONS
========================= */

function setupCartButtons() {

    const buttons =
        document.querySelectorAll(
            ".add-to-cart"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const productId =
                    button.dataset.productId;

                addToCart(productId);

            }
        );

    });

}


/* =========================
   INITIALIZE CART
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupCartButtons();

        updateCartCount();

    }
);
