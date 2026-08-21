const EVENTS = [
    {
        id: "event-001",
        title: "Business Growth Workshop",
        description: "A practical session for businesses looking to improve their operations, customer experience and growth.",
        date: "2026-09-15",
        time: "10:00 AM",
        location: "Nairobi, Kenya",
        price: 0,
        status: "upcoming"
    },
    {
        id: "event-002",
        title: "Digital Business Forum",
        description: "Learn how digital tools, automation and online systems can help growing businesses save time and generate more opportunities.",
        date: "2026-10-10",
        time: "9:00 AM",
        location: "Nairobi, Kenya",
        price: 0,
        status: "upcoming"
    }
];


function formatEventDate(date) {
    const eventDate = new Date(date + "T00:00:00");

    return eventDate.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}


function displayEvents() {

    const eventGrid =
        document.getElementById("event-grid");

    if (!eventGrid) {
        return;
    }

    const upcomingEvents = EVENTS.filter(
        event => event.status === "upcoming"
    );

    if (upcomingEvents.length === 0) {

        eventGrid.innerHTML = `
            <div class="empty-cart">
                <h2>No upcoming events</h2>
                <p>Check back soon for new events.</p>
            </div>
        `;

        return;
    }


    eventGrid.innerHTML = upcomingEvents.map(event => {

        const price =
            event.price > 0
                ? `KSh ${event.price.toLocaleString()}`
                : "Free";


        return `
            <article class="event-card">

                <div class="event-content">

                    <p class="event-date">
                        ${formatEventDate(event.date)}
                    </p>

                    <h2>
                        ${event.title}
                    </h2>

                    <p>
                        ${event.description}
                    </p>

                    <div class="event-details">

                        <span>
                            ${event.time}
                        </span>

                        <span>
                            ${event.location}
                        </span>

                    </div>

                    <strong class="event-price">
                        ${price}
                    </strong>

                    <a
                        href="register.html?event=${event.id}"
                        class="add-to-cart event-button"
                    >
                        Register
                    </a>

                </div>

            </article>
        `;

    }).join("");
}


document.addEventListener(
    "DOMContentLoaded",
    displayEvents
);
