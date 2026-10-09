# Conference Room Booking System

A web-based conference room booking application built with **Python, Django, and MySQL**. It allows users to view conference rooms, check availability, and book rooms for specific dates and time slots.

## Features

* Conference room management
* User authentication
* Room availability checking
* Date-based room booking
* 30-minute time slot selection
* Booking validation to prevent overlapping reservations
* Responsive user interface

## Technologies Used

* **Backend:** Python, Django
* **Frontend:** HTML, CSS, JavaScript, Bootstrap
* **Database:** MySQL
* **Tools:** Git, GitHub

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Udhaya2208/django-conference-room-booking.git
   ```

2. Navigate to the project folder:

   ```bash
   cd django-conference-room-booking
   ```

3. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   ```

   Windows PowerShell:

   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

5. Create your environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

6. Update `.env` with your own Django secret key, MySQL database credentials, and email configuration.

7. Apply database migrations:

   ```bash
   python manage.py migrate
   ```

8. Start the development server:

   ```bash
   python manage.py runserver
   ```

9. Open the application:

   http://127.0.0.1:8000/

## Environment Variables

Configure the following values in your local `.env` file:

* `SECRET_KEY`
* `DEBUG`
* `DB_NAME`
* `DB_USER`
* `DB_PASSWORD`
* `DB_HOST`
* `DB_PORT`
* `EMAIL_HOST`
* `EMAIL_PORT`
* `EMAIL_USE_TLS`
* `EMAIL_HOST_USER`
* `EMAIL_HOST_PASSWORD`
* `DEFAULT_FROM_EMAIL`

**Note:** Never upload your `.env` file or real credentials to GitHub.

## Author

**Udhaya P.**

* GitHub: [Udhaya2208](https://github.com/Udhaya2208)


