  const dropdown = document.getElementById('nav-dropdown');
        for (let option of dropdown.options) {
            if (option.value === window.location.pathname) {
                option.selected = true;
                break;
            }
        }