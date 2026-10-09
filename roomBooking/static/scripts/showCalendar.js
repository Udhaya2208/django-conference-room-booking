(function initRoomCalendar() {
    const TOTAL_SLOTS = 48;
    const SLOT_WIDTH = 60;

    const datePicker = document.getElementById("calDatePicker");
    const hoursHeaderRow = document.getElementById("hoursHeaderRow");
    const scrollContainer = document.getElementById("calendarScrollContainer");
    const roomRows = document.querySelectorAll(".timeline-row[data-room-id]");

    // In-memory cache to avoid re-fetching the same date twice
    const bookingsCache = {};

    function formatDate(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const now = new Date();
    const todayStr = formatDate(now);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);

    datePicker.removeAttribute("min");
    datePicker.max = formatDate(maxDate);
    if (!datePicker.value) {
        datePicker.value = todayStr;
    }

    // 1. Build 24-Hour Headers (Only runs once)
    hoursHeaderRow.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        const hCell = document.createElement("div");
        hCell.className = "hour-header-item";
        const suffix = h >= 12 ? "PM" : "AM";
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        hCell.textContent = `${displayHour} ${suffix}`;
        hoursHeaderRow.appendChild(hCell);
    }

    // 2. Build Room Grid Slots (Only runs once)
    roomRows.forEach(row => {
        const roomId = row.dataset.roomId;
        const track = document.getElementById(`roomTrack_${roomId}`);
        if (!track) return;

        track.innerHTML = "";
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const slot = document.createElement("div");
            slot.className = `cal-slot ${i % 2 === 0 ? 'slot-half' : 'slot-full'}`;
            slot.dataset.index = i;

            slot.addEventListener("click", () => {
            if (datePicker.value < todayStr) return;
            if (slot.classList.contains("booked") || slot.classList.contains("past")) return;

            const roomName = (row.dataset.roomName || "").toLowerCase().replace(/\s+/g, '-');
            const selectedDate = datePicker.value; // Get the chosen calendar date

            // Pass the date in the query string
            window.location.href = `/Book_Room/${roomId}/${roomName}/?date=${selectedDate}`;
        });

            track.appendChild(slot);
        }
    });

    function isSlotPast(slotIdx, selectedDate) {
        if (selectedDate < todayStr) return true;
        if (selectedDate > todayStr) return false;

        const current = new Date();
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        return (slotIdx * 30) < currentMinutes;
    }

    function mergeBookings(ranges) {
        if (!ranges || ranges.length === 0) return [];
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged = [];
        let current = { ...sorted[0] };

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            const currentUser = current.userName || current.user;
            const nextUser = next.userName || next.user;

            if (next.start <= current.end + 1 && currentUser === nextUser) {
                current.end = Math.max(current.end, next.end);
            } else {
                merged.push(current);
                current = { ...next };
            }
        }
        merged.push(current);
        return merged;
    }

    // 3. Render Calendar Slots and Badges
    function renderCalendarView(dayBookings, selectedDate) {
        // Clear existing red badges
        document.querySelectorAll(".cal-booked-badge").forEach(el => el.remove());

        roomRows.forEach(row => {
            const roomId = row.dataset.roomId;
            const track = document.getElementById(`roomTrack_${roomId}`);
            if (!track) return;

            const slots = track.querySelectorAll(".cal-slot");
            const rawRoomBookings = dayBookings[roomId] || [];
            const roomBookedList = mergeBookings(rawRoomBookings);

            // Color base cells
            slots.forEach(s => {
                const idx = parseInt(s.dataset.index);
                const isBooked = roomBookedList.some(r => idx >= r.start && idx <= r.end);

                s.classList.remove("past", "booked");

                if (isBooked) {
                    s.classList.add("booked");
                } else if (isSlotPast(idx, selectedDate)) {
                    s.classList.add("past");
                }
            });

            // Render Red Booking Badges
            roomBookedList.forEach(range => {
                const span = range.end - range.start + 1;
                if (span <= 0) return;

                const badge = document.createElement("div");
                badge.className = "cal-booked-badge";
                const bookedBy = range.userName || range.user || "Unknown";

                badge.textContent = `${bookedBy}`;
                badge.style.left = `${range.start * SLOT_WIDTH}px`;
                badge.style.width = `${span * SLOT_WIDTH}px`;
                track.appendChild(badge);
            });
        });

        // Auto-align scroll
        if (selectedDate === todayStr) {
            const currentHour = new Date().getHours();
            scrollContainer.scrollLeft = (currentHour * 2) * SLOT_WIDTH;
        } else {
            scrollContainer.scrollLeft = (9 * 2) * SLOT_WIDTH;
        }
    }

    // 4. AJAX Fetch Function
    async function refreshCalendarView() {
        const selectedDate = datePicker.value;

        // Use cache if already loaded
        if (bookingsCache[selectedDate]) {
            renderCalendarView(bookingsCache[selectedDate], selectedDate);
            return;
        }

        try {
            const response = await fetch(`${window.location.pathname}?date=${selectedDate}&ajax=1`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const data = await response.json();

            if (data.status === 'success') {
                bookingsCache[data.date] = data.bookings || {};

                // Only render if user is still on this date
                if (datePicker.value === data.date) {
                    renderCalendarView(bookingsCache[data.date], data.date);
                }
            }
        } catch (err) {
            console.error("AJAX calendar load error:", err);
        }
    }

    datePicker.addEventListener("change", refreshCalendarView);
    refreshCalendarView(); // Initial load for today
})();