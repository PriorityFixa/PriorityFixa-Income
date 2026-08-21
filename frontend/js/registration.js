document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById(
            "event-registration-form"
        );

    const eventIdInput =
        document.getElementById("event-id");

    const eventTitle =
        document.getElementById(
            "registration-event-title"
        );

    const eventInfo =
        document.getElementById(
            "registration-event-info"
        );

    const message =
        document.getElementById(
            "registration-message"
        );


    if (!form) {
        return;
    }


    /*
     * Get the event ID from the URL.
     *
     * Example:
     *
     * register.html?event=event-001
     */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const eventId =
        params.get("event");


    if (!eventId) {

        eventTitle.textContent =
            "No Event Selected";

        eventInfo.textContent =
            "Please return to the events page and select an event.";

        form.style.display = "none";

        return;
    }


    /*
     * Make sure EVENTS exists.
     */

    if (typeof EVENTS === "undefined") {

        eventInfo.textContent =
            "Events could not be loaded.";

        return;
    }


    /*
     * Find the selected event.
     */

    const event =
        EVENTS.find(
            item => item.id === eventId
        );


    if (!event) {

        eventTitle.textContent =
            "Event Not Found";

        eventInfo.textContent =
            "The event you selected could not be found.";

        form.style.display = "none";

        return;
    }


    /*
     * Display event information.
     */

    eventTitle.textContent =
        event.title;

    eventInfo.textContent =
        `${event.date} • ${event.time} • ${event.location}`;


    /*
     * Store event ID in hidden form field.
     */

    eventIdInput.value =
        event.id;


    /*
     * Handle registration.
     *
     * For now this only demonstrates
     * the registration flow.
     *
     * We will connect this to the backend later.
     */

    form.addEventListener(
        "submit",
        (eventObject) => {

            eventObject.preventDefault();


            const formData =
                new FormData(form);


            const registration = {

                eventId:
                    formData.get("eventId"),

                name:
                    formData.get("name"),

                email:
                    formData.get("email"),

                phone:
                    formData.get("phone"),

                organisation:
                    formData.get("organisation"),

                attendees:
                    formData.get("attendees")

            };


            console.log(
                "Event registration:",
                registration
            );


            message.className =
                "success-message";

            message.textContent =
                "Registration received successfully.";

            form.reset();

            eventIdInput.value =
                event.id;

        }
    );

});
