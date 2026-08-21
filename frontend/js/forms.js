document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById("community-form");

    const message =
        document.getElementById("form-message");


    if (!form) {
        return;
    }


    form.addEventListener("submit", (event) => {

        event.preventDefault();


        const formData =
            new FormData(form);


        const member = {

            name: formData.get("name"),

            email: formData.get("email"),

            phone: formData.get("phone"),

            organisation:
                formData.get("organisation"),

            interest:
                formData.get("interest")

        };


        console.log(
            "Community registration:",
            member
        );


        message.className =
            "success-message";

        message.textContent =
            "Thank you. Your community registration has been received.";

        form.reset();

    });

});
