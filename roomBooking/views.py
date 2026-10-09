import datetime
import json
import secrets
import time
from django.utils.text import slugify
from django.contrib.auth import login, logout
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from .decorators import validate_session_token
from .models import RoomsAvailable, Booking, UserProfile
from .forms import LoginForm
from .services import send_booking_email


def loginPage(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == 'POST':
        form = LoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)

            response = redirect("dashboard")
            session_token = secrets.token_hex(32)
            cookie_data = {
                "session_token": session_token,
                "expiry": int(time.time()) + 7200
            }
            response.set_cookie('session_info', json.dumps(cookie_data), max_age=7200)

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.session_token = session_token
            profile.save()

            messages.success(request, "Login successful!")
            return response
        else:
            messages.error(request, "Invalid username or password.")
    else:
        form = LoginForm()

    return render(request, 'roomBooking/login_page.html', {'form': form})


def logout_page(request):
    logout(request)
    return redirect('loginPage')


@validate_session_token
def dashboard(request):
    rooms = RoomsAvailable.objects.all()
    return render(request, 'roomBooking/dashboard.html', {'rooms': rooms})


def parse_time_obj(time_input):
    """Unified time parser handling datetime.time objects and time strings."""
    if isinstance(time_input, datetime.time):
        return time_input
    for time_format in ("%H:%M:%S", "%H:%M", "%I:%M %p"):
        try:
            return datetime.datetime.strptime(str(time_input).strip(), time_format).time()
        except (ValueError, TypeError):
            continue
    return None


def format_time_12h(time_input):
    parsed = parse_time_obj(time_input)
    if not parsed:
        return str(time_input)
    hour = parsed.hour % 12 or 12
    return f"{hour}:{parsed.minute:02d} {'AM' if parsed.hour < 12 else 'PM'}"


def get_slot_count(start_time, end_time):
    """Calculates total 30-minute slots between start and end time."""
    if not start_time or not end_time:
        return 0
    is_midnight = (end_time == datetime.time(0, 0))
    end_minutes = 24 * 60 if is_midnight else (end_time.hour * 60 + end_time.minute)
    start_minutes = start_time.hour * 60 + start_time.minute
    return max(0, (end_minutes - start_minutes) // 30)


@validate_session_token
def my_booking(request):
    rooms = RoomsAvailable.objects.all()
    now = datetime.datetime.now()
    today = now.date()

    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('ajax') == '1' or request.POST.get('ajax') == '1'

    # 1. Cancel Booking
    if request.method == 'POST':
        item_id = request.POST.get('id')
        booking = Booking.objects.filter(id=item_id, bookedByUsername=request.user).first()

        if not booking:
            return JsonResponse({'status': 'error', 'message': 'Booking not found or permission denied.'}, status=404)

        start_time_obj = parse_time_obj(booking.startTime)
        if start_time_obj:
            start_dt = datetime.datetime.combine(booking.bookedDate, start_time_obj)
            if now >= start_dt - datetime.timedelta(minutes=15):
                return JsonResponse({'status': 'error', 'message': 'Cannot cancel within 15 minutes of start time.'}, status=400)

        room_title = booking.bookedRoom or "Room"
        user_email = request.user.email
        cancel_date = str(booking.bookedDate)
        cancel_start = format_time_12h(booking.startTime)
        cancel_end = format_time_12h(booking.endTime)

        booking.delete()

        try:
            send_booking_email(
                recipient_email=user_email,
                room_name=room_title,
                date=cancel_date,
                start_time=cancel_start,
                end_time=cancel_end,
                action="cancelled"
            )
        except Exception as e:
            print(f"Cancellation email failed: {e}")

        return JsonResponse({
            'status': 'success',
            'message': f"Booking for '{room_title}' cancelled successfully.",
            'deleted_id': item_id
        })

    # 2. Filter Bookings
    record = request.GET.get('record', 'all')
    user_bookings = Booking.objects.filter(bookedByUsername=request.user).select_related('roomId')

    if record == 'today':
        user_bookings = user_bookings.filter(bookedDate=today).order_by('startTime')
    elif record == 'future':
        user_bookings = user_bookings.filter(bookedDate__gt=today).order_by('bookedDate', 'startTime')
    else:
        record = 'all'
        user_bookings = user_bookings.order_by('-bookedDate', '-startTime')

    if is_ajax:
        booking_data = []
        for booking in user_bookings:
            start_time_obj = parse_time_obj(booking.startTime)
            can_modify = False
            if start_time_obj:
                start_dt = datetime.datetime.combine(booking.bookedDate, start_time_obj)
                can_modify = (now < start_dt - datetime.timedelta(minutes=15))

            room_id = booking.roomId.roomId if booking.roomId else ""
            room_title = booking.bookedRoom or (booking.roomId.roomName if booking.roomId else "Room")
            modify_url = f"/Book_Room/{room_id}/{slugify(room_title)}/?modify_id={booking.id}" if room_id else "#"

            booking_data.append({
                'id': booking.id,
                'roomName': room_title,
                'capacity': booking.roomId.roomCapacity if booking.roomId else "N/A",
                'bookedDate': booking.bookedDate.strftime("%b. %d, %Y"),
                'startTime': format_time_12h(booking.startTime),
                'endTime': format_time_12h(booking.endTime),
                'can_modify': can_modify,
                'modify_url': modify_url
            })

        return JsonResponse({
            'status': 'success',
            'selected_option': record,
            'bookings': booking_data
        })

    for booking in user_bookings:
        start_time_obj = parse_time_obj(booking.startTime)
        booking.can_modify = (now < datetime.datetime.combine(booking.bookedDate, start_time_obj) - datetime.timedelta(minutes=15)) if start_time_obj else False

    return render(request, "roomBooking/my_booking.html", {
        'rooms': rooms,
        'room_booking': user_bookings,
        'selected_option': record
    })


@validate_session_token
def Book_Room(request, roomId, roomName=None):
    current_room = get_object_or_404(RoomsAvailable, roomId=roomId)
    real_room_name = current_room.roomName
    rooms = RoomsAvailable.objects.all()

    # Maintenance check
    if current_room.is_maintenance:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'status': 'error', 'message': f"'{real_room_name}' is currently under maintenance."}, status=403)
        messages.error(request, f"'{real_room_name}' is currently under maintenance and cannot be booked.")
        return redirect('dashboard')

    now = datetime.datetime.now()
    today = now.date()
    modify_id = request.GET.get('modify_id') or request.POST.get('modify_id')
    modifying_booking = None
    modify_info = None

    # Handle Modifications
    if modify_id:
        modifying_booking = Booking.objects.filter(id=modify_id, bookedByUsername=request.user).first()
        if modifying_booking:
            start_time_obj = parse_time_obj(modifying_booking.startTime)
            end_time_obj = parse_time_obj(modifying_booking.endTime)

            if start_time_obj:
                booking_start_dt = datetime.datetime.combine(modifying_booking.bookedDate, start_time_obj)
                if now >= booking_start_dt - datetime.timedelta(minutes=15):
                    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                        return JsonResponse({'status': 'error', 'message': 'Modifications are locked within 15 minutes of start time.'}, status=403)
                    messages.error(request, "Modifications are locked within 15 minutes of start time.")
                    return redirect('my_booking')

            if start_time_obj and end_time_obj:
                start_index = (start_time_obj.hour * 60 + start_time_obj.minute) // 30
                end_index = 47 if end_time_obj == datetime.time(0, 0) else ((end_time_obj.hour * 60 + end_time_obj.minute) // 30) - 1
                modify_info = {
                    'id': modifying_booking.id,
                    'date': modifying_booking.bookedDate.strftime("%Y-%m-%d"),
                    'start_idx': start_index,
                    'end_idx': max(start_index, end_index)
                }
        else:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'status': 'error', 'message': 'Booking not found or permission denied.'}, status=404)
            messages.error(request, "Booking not found or permission denied.")
            return redirect('my_booking')

    # Read selected date from Calendar redirection or Modification
    selected_date = today.strftime("%Y-%m-%d")
    date_param = request.GET.get('date')

    if modify_info:
        selected_date = modify_info['date']
    elif date_param:
        try:
            parsed_param_date = datetime.date.fromisoformat(date_param)
            if parsed_param_date >= today:
                selected_date = date_param
        except ValueError:
            pass

    # Handle Booking Form Submission (POST)
    if request.method == 'POST':
        raw_date = request.POST.get('booking_date')
        raw_start = request.POST.get('start_time')
        raw_end = request.POST.get('end_time')

        if not (raw_date and raw_start and raw_end):
            return JsonResponse({'status': 'error', 'message': 'Please select a date and time slot.'}, status=400)

        booked_date = datetime.date.fromisoformat(raw_date)
        start_time = parse_time_obj(raw_start)
        end_time = parse_time_obj(raw_end)

        if booked_date < today:
            return JsonResponse({'status': 'error', 'message': 'Cannot book for past dates.'}, status=400)

        if booked_date == today and start_time <= now.time():
            return JsonResponse({'status': 'error', 'message': 'Cannot book the slot that has already passed.'}, status=400)

        is_midnight = (end_time == datetime.time(0, 0))
        if not is_midnight and start_time >= end_time:
            return JsonResponse({'status': 'error', 'message': 'End Time should not be before start time.'}, status=400)

        # Single Booking Max Duration Cap (10 slots = 5 hours)
        new_slots_requested = get_slot_count(start_time, end_time)
        if new_slots_requested > 10:
            return JsonResponse({'status': 'error', 'message': 'You cannot book more than 10 slots in a single booking.'}, status=400)

        # 5-Day Rolling Limit Validation
        MAX_BOOKINGS_ALLOWED = 10
        min_window_start = max(today, booked_date - datetime.timedelta(days=4))
        max_window_start = booked_date

        user_bookings_qs = Booking.objects.filter(
            bookedByUsername=request.user,
            bookedDate__gte=min_window_start,
            bookedDate__lte=booked_date + datetime.timedelta(days=4)
        )
        if modifying_booking:
            user_bookings_qs = user_bookings_qs.exclude(id=modifying_booking.id)

        daily_bookings_map = {}
        for booking in user_bookings_qs:
            daily_bookings_map[booking.bookedDate] = daily_bookings_map.get(booking.bookedDate, 0) + 1

        check_date = min_window_start
        while check_date <= max_window_start:
            bookings_in_window = sum(
                daily_bookings_map.get(check_date + datetime.timedelta(days=day_offset), 0)
                for day_offset in range(5)
            )

            if bookings_in_window + 1 > MAX_BOOKINGS_ALLOWED:
                return JsonResponse({
                    'status': 'error',
                    'message': f"Booking limit reached! Maximum {MAX_BOOKINGS_ALLOWED} bookings allowed per 5 days."
                }, status=400)

            check_date += datetime.timedelta(days=1)

        # Overlap Check
        overlap_qs = Booking.objects.filter(
            roomId=current_room,
            bookedDate=booked_date,
            startTime__lt=datetime.time(23, 59, 59) if is_midnight else end_time,
            endTime__gt=start_time
        )
        if modifying_booking:
            overlap_qs = overlap_qs.exclude(id=modifying_booking.id)

        if overlap_qs.exists():
            return JsonResponse({
                'status': 'error',
                'message': f"Room is already booked between {start_time.strftime('%I:%M %p')} and {end_time.strftime('%I:%M %p')}."
            }, status=409)

        # Save to Database
        if modifying_booking:
            modifying_booking.bookedDate = booked_date
            modifying_booking.startTime = start_time
            modifying_booking.endTime = end_time
            modifying_booking.save()
            success_msg = f"Booking for '{real_room_name}' modified successfully!"
            action_type = "modified"
        else:
            Booking.objects.create(
                roomId=current_room,
                bookedRoom=real_room_name,
                bookedDate=booked_date,
                startTime=start_time,
                endTime=end_time,
                bookedByUsername=request.user
            )
            success_msg = f"Room '{real_room_name}' booked successfully!"
            action_type = "confirmed"

        # Trigger Email
        send_booking_email(
            recipient_email=request.user.email,
            room_name=real_room_name,
            date=str(booked_date),
            start_time=start_time.strftime('%I:%M %p'),
            end_time=end_time.strftime('%I:%M %p'),
            action=action_type
        )

        start_index = (start_time.hour * 60 + start_time.minute) // 30
        end_index = 47 if is_midnight else ((end_time.hour * 60 + end_time.minute) // 30) - 1

        return JsonResponse({
            'status': 'success',
            'message': success_msg,
            'booking': {
                'date': str(booked_date),
                'start': start_index,
                'end': max(start_index, end_index),
                'userName': request.user.username
            }
        })

    # Page Load (GET)
    max_date = today + datetime.timedelta(days=92)
    existing_bookings = Booking.objects.filter(roomId=current_room, bookedDate__gte=today, bookedDate__lte=max_date)
    if modifying_booking:
        existing_bookings = existing_bookings.exclude(id=modifying_booking.id)

    bookings_by_date = {}
    for booking in existing_bookings:
        date_str = booking.bookedDate.strftime("%Y-%m-%d")
        start_time_obj = parse_time_obj(booking.startTime)
        end_time_obj = parse_time_obj(booking.endTime)

        if start_time_obj and end_time_obj:
            start_index = (start_time_obj.hour * 60 + start_time_obj.minute) // 30
            end_index = 47 if end_time_obj == datetime.time(0, 0) else ((end_time_obj.hour * 60 + end_time_obj.minute) // 30) - 1

            bookings_by_date.setdefault(date_str, []).append({
                'start': start_index,
                'end': max(start_index, end_index),
                'userName': booking.bookedByUsername.username if booking.bookedByUsername else "Booked"
            })

    return render(request, 'roomBooking/booking_room.html', {
        'rooms': rooms,
        'roomName': real_room_name,
        'roomId': roomId,
        'bookings_by_date': bookings_by_date,
        'modify_id': modify_id,
        'modify_info': modify_info,
        'today': today.strftime("%Y-%m-%d"),
        'selected_date': selected_date  # <-- Passed here
    })

@validate_session_token
def Calendar_View(request):
    rooms = RoomsAvailable.objects.all().order_by('roomId')

    # AJAX Request Handler (Loads only 1 specific day)
    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('ajax') == '1':
        raw_date = request.GET.get('date')
        try:
            target_date = datetime.date.fromisoformat(raw_date) if raw_date else datetime.date.today()
        except ValueError:
            return JsonResponse({'status': 'error', 'message': 'Invalid date format'}, status=400)

        # Query only the selected date's bookings
        day_bookings_qs = Booking.objects.filter(
            bookedDate=target_date
        ).select_related('roomId', 'bookedByUsername')

        day_bookings = {}
        for booking in day_bookings_qs:
            start_time_obj = parse_time_obj(booking.startTime)
            end_time_obj = parse_time_obj(booking.endTime)
            room_identifier = str(booking.roomId_id or (booking.roomId.roomId if booking.roomId else ''))

            if start_time_obj and end_time_obj and room_identifier:
                start_index = (start_time_obj.hour * 60 + start_time_obj.minute) // 30
                end_index = 47 if end_time_obj == datetime.time(0, 0) else ((end_time_obj.hour * 60 + end_time_obj.minute) // 30) - 1

                day_bookings.setdefault(room_identifier, []).append({
                    'start': start_index,
                    'end': max(start_index, end_index),
                    'userName': booking.bookedByUsername.username if booking.bookedByUsername else "Booked"
                })

        return JsonResponse({
            'status': 'success',
            'date': target_date.strftime("%Y-%m-%d"),
            'bookings': day_bookings
        })

    # Initial HTML Page Load (Lightweight: no heavy 90-day payload)
    return render(request, 'roomBooking/calendar.html', {
        'rooms': rooms,
    })