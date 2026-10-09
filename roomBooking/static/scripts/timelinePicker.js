(function initTimelinePicker() {
    const TOTAL_SLOTS = 48;
    const SLOT_WIDTH = 60;

    const datePicker = document.getElementById("bookingDate");
    const formBookingDate = document.getElementById("formBookingDate");
    const summaryDateText = document.getElementById("summaryDateText");
    const grid = document.getElementById("timelineGrid");
    const scrollContainer = document.getElementById("timelineScroll");
    const timeRangeText = document.getElementById("timeRangeText");
    const durationText = document.getElementById("durationText");
    const bookBtn = document.getElementById("bookBtn");
    const formStartTime = document.getElementById("formStartTime");
    const formEndTime = document.getElementById("formEndTime");
    const bookingForm = document.getElementById("bookingForm");

    // Confirmation Box Elements
    const confirmBox = document.getElementById("bookingConfirmToast");
    const confirmBookingYesBtn = document.getElementById("confirmBookingYesBtn");
    const confirmBookingNoBtn = document.getElementById("confirmBookingNoBtn");
    const toastHeaderPrompt = document.getElementById("toastHeaderPrompt");
    const toastDateText = document.getElementById("toastDateText");
    const toastTimeText = document.getElementById("toastTimeText");

    if (!grid) return;

    // 1. Parse existing bookings data
    let bookingsData = {};
    const rawBookingsScript = document.getElementById("existingBookingsData");
    if (rawBookingsScript && rawBookingsScript.textContent.trim()) {
        try {
            bookingsData = JSON.parse(rawBookingsScript.textContent);
            if (typeof bookingsData === "string") {
                bookingsData = JSON.parse(bookingsData);
            }
        } catch (e) {
            bookingsData = {};
        }
    }

    // 2. Parse modification data (if coming from "Modify" button)
    let modifyData = null;
    const rawModifyScript = document.getElementById("modifyingBookingData");
    if (rawModifyScript && rawModifyScript.textContent.trim()) {
        try {
            modifyData = JSON.parse(rawModifyScript.textContent);
            if (typeof modifyData === "string") {
                modifyData = JSON.parse(modifyData);
            }
        } catch (e) {
            modifyData = null;
        }
    }

    // Helper: Formats ISO date 'YYYY-MM-DD' into 'Sept. 22, 2026'
    function formatDisplayDate(dateStr) {
        if (!dateStr) return "-";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    // 3. Asynchronous Submission Logic
    async function submitBookingRequest() {
        if (confirmBox) confirmBox.style.display = "none";

        bookBtn.disabled = true;
        const originalText = bookBtn.textContent;
        bookBtn.textContent = modifyData ? "Updating..." : "Reserving...";

        const formData = new FormData(bookingForm);

        try {
            const response = await fetch(bookingForm.action || window.location.href, {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.status === "success") {
                const newBooking = data.booking;

                if (!bookingsData[newBooking.date]) {
                    bookingsData[newBooking.date] = [];
                }
                bookingsData[newBooking.date].push({
                    start: newBooking.start,
                    end: newBooking.end,
                    userName: newBooking.userName
                });

                refreshTimelineState();

                if (typeof showAlert === "function") {
                    showAlert(data.message, "success");
                } else {
                    alert(data.message);
                }
            } else {
                const errorMsg = data.message || "Failed to save booking.";
                if (typeof showAlert === "function") {
                    showAlert(errorMsg, "error");
                } else {
                    alert(errorMsg);
                }
                bookBtn.disabled = false;
            }
        } catch (err) {
            if (typeof showAlert === "function") {
                showAlert("A network error occurred. Please try again.", "error");
            } else {
                alert("A network error occurred. Please try again.");
            }
            bookBtn.disabled = false;
        } finally {
            bookBtn.textContent = originalText;
        }
    }

    // 4. Confirmation Popup Triggers
    if (bookBtn) {
        bookBtn.addEventListener("click", function (e) {
            e.stopPropagation();

            if (!formStartTime.value || !formEndTime.value) {
                if (typeof showAlert === "function") {
                    showAlert("Please drag to select a slot first.", "warning");
                }
                return;
            }

            if (toastHeaderPrompt) {
                toastHeaderPrompt.textContent = modifyData
                    ? "Are you sure you want to update this booking?"
                    : "Are you sure you want to book this room?";
            }
            if (confirmBookingYesBtn) {
                confirmBookingYesBtn.textContent = modifyData ? "Yes, Update" : "Yes, Book";
            }

            if (toastDateText) toastDateText.textContent = formatDisplayDate(formBookingDate.value);
            if (toastTimeText) toastTimeText.textContent = timeRangeText.textContent;

            if (confirmBox) {
                confirmBox.style.display = "block";
            }
        });
    }

    if (confirmBookingNoBtn) {
        confirmBookingNoBtn.addEventListener("click", function () {
            if (confirmBox) confirmBox.style.display = "none";
        });
    }

    if (confirmBookingYesBtn) {
        confirmBookingYesBtn.addEventListener("click", submitBookingRequest);
    }

    document.addEventListener("click", function (e) {
        if (confirmBox && confirmBox.style.display === "block") {
            if (!confirmBox.contains(e.target) && !bookBtn.contains(e.target)) {
                confirmBox.style.display = "none";
            }
        }
    });

    function formatDate(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 5. Date Constraints and Defaults (FIXED: Prioritizes URL and template dates)
    const now = new Date();
    const todayStr = formatDate(now);

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    const maxDateStr = formatDate(maxDate);

    datePicker.min = todayStr;
    datePicker.max = maxDateStr;

    // Checks: 1. Modify Data -> 2. URL ?date= query -> 3. Template input value -> 4. todayStr
    const urlParams = new URLSearchParams(window.location.search);
    const queryDate = urlParams.get('date');

    const initialDate = (modifyData && modifyData.date)
        ? modifyData.date
        : (queryDate || datePicker.value || todayStr);

    datePicker.value = initialDate;
    if (formBookingDate) formBookingDate.value = initialDate;
    if (summaryDateText) summaryDateText.textContent = (initialDate === todayStr) ? "Today" : initialDate;

    if (modifyData && bookBtn) {
        bookBtn.textContent = "Update Booking";
    }

    // 6. Build Grid: 24 Hours & 48 Slots
    grid.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        const hourCell = document.createElement("div");
        hourCell.className = "hour-cell";
        const suffix = h >= 12 ? "PM" : "AM";
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        hourCell.textContent = `${displayHour} ${suffix}`;
        grid.appendChild(hourCell);
    }

    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const slot = document.createElement("div");
        slot.className = `slot-cell ${i % 2 === 0 ? 'slot-half' : 'slot-full'}`;
        slot.dataset.index = i;
        grid.appendChild(slot);
    }

    let isMouseDown = false;
    let dragStartIndex = null;
    let selectionOverlay = null;

    function getBookedRangesForSelectedDate() {
        const selected = datePicker.value;
        return bookingsData[selected] || [];
    }

    function isSlotBooked(slotIdx) {
        const ranges = getBookedRangesForSelectedDate();
        return ranges.some(r => slotIdx >= r.start && slotIdx <= r.end);
    }

    function isSlotPast(slotIdx) {
        if (datePicker.value < todayStr) return true;
        if (datePicker.value > todayStr) return false;
        const current = new Date();
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        const slotStartMinutes = slotIdx * 30;
        return slotStartMinutes < currentMinutes;
    }

    function isSlotDisabled(slotIdx) {
        return isSlotPast(slotIdx) || isSlotBooked(slotIdx);
    }

    function refreshTimelineState() {
        clearSelection();

        document.querySelectorAll(".booked-overlay-badge").forEach(el => el.remove());

        const slots = grid.querySelectorAll(".slot-cell");
        const currentBookings = getBookedRangesForSelectedDate();

        const isToday = (datePicker.value === todayStr);
        const currentMinutes = (new Date()).getHours() * 60 + (new Date()).getMinutes();
        const currentSlotIdx = Math.floor(currentMinutes / 30);

        slots.forEach(s => {
            const idx = parseInt(s.dataset.index);
            s.classList.remove("past", "booked");

            if (isSlotPast(idx)) {
                s.classList.add("past");
            } else if (isSlotBooked(idx)) {
                s.classList.add("booked");
            }
        });

        currentBookings.forEach(range => {
            let start = range.start;
            let end = range.end;

            if (isToday) {
                if (end < currentSlotIdx) return;
                start = Math.max(start, currentSlotIdx);
            }

            const span = end - start + 1;
            if (span <= 0) return;

            const badge = document.createElement("div");
            badge.className = "booked-overlay-badge";
            const bookedBy = range.userName || range.user || "Unknown";
            badge.textContent = `${bookedBy}`;
            badge.style.left = `${start * SLOT_WIDTH}px`;
            badge.style.width = `${span * SLOT_WIDTH}px`;
            grid.appendChild(badge);
        });
    }

    function indexTo12Hour(idx) {
        const totalMinutes = idx * 30;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        const suffix = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 === 0 ? 12 : h => (h % 12 === 0 ? 12 : h % 12);
        const displayMinutes = minutes === 0 ? "00" : minutes;
        return `${hours % 12 === 0 ? 12 : hours % 12}:${displayMinutes} ${suffix}`;
    }

    function indexTo24Hour(idx) {
        const totalMinutes = idx * 30;
        const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
        const minutes = String(totalMinutes % 60).padStart(2, "0");
        return `${hours}:${minutes}:00`;
    }

    // 7. Drag Range Interaction
    grid.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const rect = grid.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const slotIndex = Math.floor(x / SLOT_WIDTH);

        if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS || isSlotDisabled(slotIndex)) return;

        isMouseDown = true;
        dragStartIndex = slotIndex;
        applySelection(slotIndex, slotIndex);
    });

    window.addEventListener("mousemove", (e) => {
        if (!isMouseDown || dragStartIndex === null) return;

        const rect = grid.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let currentIndex = Math.floor(x / SLOT_WIDTH);
        currentIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, currentIndex));

        let start = Math.min(dragStartIndex, currentIndex);
        let end = Math.max(dragStartIndex, currentIndex);

        if (currentIndex >= dragStartIndex) {
            for (let i = dragStartIndex; i <= end; i++) {
                if (isSlotDisabled(i)) { end = i - 1; break; }
            }
        } else {
            for (let i = dragStartIndex; i >= start; i--) {
                if (isSlotDisabled(i)) { start = i + 1; break; }
            }
        }

        applySelection(start, end);
    });

    window.addEventListener("mouseup", () => {
        isMouseDown = false;
    });

    function applySelection(start, end) {
        if (start > end) return;

        if (!selectionOverlay) {
            selectionOverlay = document.createElement("div");
            selectionOverlay.className = "selection-highlight";
            grid.appendChild(selectionOverlay);
        }

        const slotSpan = end - start + 1;
        selectionOverlay.style.left = `${start * SLOT_WIDTH}px`;
        selectionOverlay.style.width = `${slotSpan * SLOT_WIDTH}px`;

        const startStr = indexTo12Hour(start);
        const endStr = indexTo12Hour(end + 1);
        const totalMinutes = slotSpan * 30;
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        let dur = "";
        if (hrs > 0) dur += `${hrs} hr `;
        if (mins > 0) dur += `${mins} min`;

        selectionOverlay.innerHTML = `<span class="selection-badge">${startStr} - ${endStr}</span>`;

        timeRangeText.textContent = `${startStr} - ${endStr}`;
        durationText.textContent = dur.trim();

        formStartTime.value = indexTo24Hour(start);
        formEndTime.value = indexTo24Hour(end + 1);
        bookBtn.disabled = false;
    }

    function clearSelection() {
        if (selectionOverlay) {
            selectionOverlay.remove();
            selectionOverlay = null;
        }
        timeRangeText.textContent = "None";
        durationText.textContent = "0 min";
        formStartTime.value = "";
        formEndTime.value = "";
        bookBtn.disabled = true;
    }

    datePicker.addEventListener("change", (e) => {
        formBookingDate.value = e.target.value;
        summaryDateText.textContent = (e.target.value === todayStr) ? "Today" : e.target.value;
        refreshTimelineState();
    });

    // 8. Initial Execution & Scrolling (Respects Future Date from URL)
    refreshTimelineState();

    if (modifyData && modifyData.date === datePicker.value) {
        applySelection(modifyData.start_idx, modifyData.end_idx);
        scrollContainer.scrollLeft = Math.max(0, (modifyData.start_idx - 2) * SLOT_WIDTH);
    } else if (datePicker.value === todayStr) {
        const currentHour = new Date().getHours();
        scrollContainer.scrollLeft = (currentHour * 2) * SLOT_WIDTH;
    } else {
        // For future dates, default view starts at 9:00 AM
        scrollContainer.scrollLeft = (9 * 2) * SLOT_WIDTH;
    }
})();