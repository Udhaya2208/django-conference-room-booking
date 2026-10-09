let currentDeleteId = null;

// Read CSRF token
function getCsrfToken() {
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    if (input) return input.value;
    const cookie = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
}

// 1. ASYNC METHOD: Filter Records into Cards
async function loadBookings(recordType, btnElement) {
    // Update active tab buttons styling
    if (btnElement) {
        document.querySelectorAll("#recordsFilterBar .records-btn").forEach(btn => {
            btn.classList.remove("btn-dark", "active", "text-white");
            btn.classList.add("btn-outline-dark");
        });
        btnElement.classList.remove("btn-outline-dark");
        btnElement.classList.add("btn-dark", "active", "text-white");
    }

    const container = document.getElementById("bookingsContainer");
    if (!container) return;

    try {
        const response = await fetch(`${window.location.pathname}?record=${recordType}&ajax=1`, {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();

        container.innerHTML = "";

        const bookings = data.bookings || [];
        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="card border-0 bg-transparent py-5">
                        <h5 class="text-muted fw-bold mb-1">No Bookings Found</h5>
                        <p class="text-muted small">You don't have any bookings under this category.</p>
                    </div>
                </div>`;
            return;
        }

        // Render cards dynamically
        bookings.forEach(b => {
            const badgeHtml = b.can_modify
                ? `<span class="badge bg-success text-white rounded-pill px-3 py-1">Active</span>`
                : `<span class="badge bg-secondary text-white rounded-pill px-3 py-1" title="Locked: Cannot modify within 15 mins of start time">Locked</span>`;

            const actionHtml = b.can_modify
                ? `<a href="${b.modify_url}" class="text-decoration-none">
                       <button type="button" class="btn btn-warning btn-sm text-white fw-semibold px-3 rounded-2" style="background-color: rgb(9 15 26);">
                           Modify
                       </button>
                   </a>
                   <button type="button" 
                           class="btn btn-danger btn-sm px-3 rounded-2 cancel-trigger-btn"
                           data-id="${b.id}"
                           data-name="${b.roomName}"
                           data-date="${b.bookedDate}"
                           data-start="${b.startTime}"
                           data-end="${b.endTime}"
                           onclick="openCancelFromButton(event, this)">
                       Cancel
                   </button>`
                : `<small class="text-muted me-auto">Locked</small>
                   <button type="button" class="btn btn-secondary btn-sm px-3 rounded-2" disabled>Modify</button>
                   <button type="button" class="btn btn-secondary btn-sm px-3 rounded-2" disabled>Cancel</button>`;

            const cardHtml = `
                <div class="col-12 col-md-6 col-lg-4" id="booking-card-${b.id}">
                    <div class="card h-100 shadow-sm border rounded-3 bg-white">
                        <div class="card-body p-4 d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom">
                                <div>
                                    <h5 class="fw-bold text-dark mb-0">${b.roomName}</h5>
                                    <small class="text-muted">Booking #${b.id}</small>
                                </div>
                                ${badgeHtml}
                            </div>
                            <div class="bg-light border rounded-3 p-3 mb-3 small">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="text-secondary fw-semibold">Booked Date</span>
                                    <span class="fw-bold text-dark">${b.bookedDate}</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="text-secondary fw-semibold">Time Slot</span>
                                    <span class="fw-bold text-primary">${b.startTime} – ${b.endTime}</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-secondary fw-semibold">Room Capacity</span>
                                    <span class="fw-bold text-dark">${b.capacity || 'N/A'} People</span>
                                </div>
                            </div>
                            <div class="mt-auto pt-3 border-top d-flex gap-2 justify-content-end align-items-center">
                                ${actionHtml}
                            </div>
                        </div>
                    </div>
                </div>`;

            container.insertAdjacentHTML('beforeend', cardHtml);
        });

    } catch (err) {
        console.error("Async load error:", err);
        if (typeof showAlert === "function") {
            showAlert("Failed to load records.", "error");
        } else {
            alert("Failed to load records.");
        }
    }
}

// 2. Helper to unpack dataset and trigger dialog
function openCancelFromButton(event, button) {
    if (event) event.stopPropagation();
    const { id, name, date, start, end } = button.dataset;
    openCancelPrompt(id, name, date, start, end);
}

// 3. Open / Close Cancel Dialog
function openCancelPrompt(id, name, date, start, end) {
    currentDeleteId = id;
    document.getElementById("cancelPromptDetails").textContent = `${name}\nDate: ${date}\nTime: ${start} - ${end}`;

    const toastEl = document.getElementById("cancelToast");
    if (window.bootstrap && window.bootstrap.Toast) {
        window.bootstrap.Toast.getOrCreateInstance(toastEl).show();
    } else {
        toastEl.classList.add("show");
        toastEl.style.display = "block";
    }
}

function closeCancelPrompt() {
    currentDeleteId = null;
    const toastEl = document.getElementById("cancelToast");
    if (window.bootstrap && window.bootstrap.Toast) {
        window.bootstrap.Toast.getOrCreateInstance(toastEl).hide();
    } else {
        toastEl.classList.remove("show");
        toastEl.style.display = "none";
    }
}

// 4. Click Outside Detection
document.addEventListener("click", function (event) {
    const toastEl = document.getElementById("cancelToast");
    if (toastEl && (toastEl.classList.contains("show") || toastEl.style.display === "block")) {
        if (!toastEl.contains(event.target) && !event.target.closest(".cancel-trigger-btn")) {
            closeCancelPrompt();
        }
    }
});

// 5. ASYNC METHOD: Confirm & Delete Booking In-Place (Cards Support)
async function confirmDeleteBooking() {
    if (!currentDeleteId) return;

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Cancelling...";

    const formData = new FormData();
    formData.append("id", currentDeleteId);
    formData.append("ajax", "1");

    try {
        const response = await fetch(window.location.pathname, {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": getCsrfToken()
            },
            body: formData
        });

        const result = await response.json();
        closeCancelPrompt();

        if (response.ok && result.status === "success") {
            // Remove the card element
            const card = document.getElementById(`booking-card-${result.deleted_id}`);
            if (card) {
                card.remove();
            }

            const container = document.getElementById("bookingsContainer");
            if (container && container.querySelectorAll('[id^="booking-card-"]').length === 0) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="card border-0 bg-transparent py-5">
                            <h5 class="text-muted fw-bold mb-1">No Bookings Found</h5>
                            <p class="text-muted small">You don't have any bookings under this category.</p>
                        </div>
                    </div>`;
            }

            if (typeof showAlert === "function") {
                showAlert(result.message, "success");
            }
        } else {
            if (typeof showAlert === "function") {
                showAlert(result.message || "Could not cancel booking.", "error");
            }
        }
    } catch (err) {
        closeCancelPrompt();
        console.error("Async delete error:", err);
        if (typeof showAlert === "function") {
            showAlert("Server error during cancellation.", "error");
        }
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Yes, Cancel";
    }
}