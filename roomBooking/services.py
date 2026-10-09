import threading
from django.core.mail import send_mail
from django.conf import settings

def _send_booking_email_task(recipient_email, room_name, date, start_time, end_time, action):

    print(f"\n--- [EMAIL TRIGGERED] ---")
    print(f"Recipient: '{recipient_email}'")
    print(f"Room: {room_name}, Action: {action}")

    # 1. Check if recipient email actually exists
    if not recipient_email:
        print("[EMAIL FAILED]: request.user.email is EMPTY! Please set an email for this user in Django Admin.")
        return

    subject = f"Room Booking {action.capitalize()}: {room_name}"
    message = (
        f"Hello,\n\n"
        f"Your booking for room '{room_name}' has been {action}.\n\n"
        f"Details:\n"
        f"• Room: {room_name}\n"
        f"• Date: {date}\n"
        f"• Time: {start_time} - {end_time}\n\n"
        f"Regards,\n"
        f"Room Booking Team"
    )

    # 2. Send email with fail_silently=False so errors print to terminal
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        print(f"[EMAIL SUCCESS]: Email successfully sent to {recipient_email}!\n")
    except Exception as e:
        print(f"[EMAIL ERROR]: SMTP failed with error -> {e}\n")

def send_booking_email(recipient_email, room_name, date, start_time, end_time, action="confirmed"):

    email_thread = threading.Thread(
        target=_send_booking_email_task,
        args=(recipient_email, room_name, date, start_time, end_time, action)
    )
    email_thread.daemon = True
    email_thread.start()