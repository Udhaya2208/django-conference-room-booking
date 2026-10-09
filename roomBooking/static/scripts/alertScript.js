let alertTimeout = null;

function showAlert(message, type = "success", duration = 3500) {
    const alertBox = document.getElementById("custom-alert");
    const messageBox = document.getElementById("custom-alert-message");

    if (!alertBox || !messageBox) {
        console.error("Custom alert element not found!");
        return;
    }

    // Clear any running hide timer
    if (alertTimeout) {
        clearTimeout(alertTimeout);
    }

    messageBox.textContent = message;
    alertBox.className = `custom-alert ${type}`;
    alertBox.style.display = "flex";

    if (duration > 0) {
        alertTimeout = setTimeout(hideAlert, duration);
    }
}

function hideAlert() {
    const alertBox = document.getElementById("custom-alert");
    if (alertBox) {
        alertBox.style.display = "none";
    }
    if (alertTimeout) {
        clearTimeout(alertTimeout);
        alertTimeout = null;
    }
}
