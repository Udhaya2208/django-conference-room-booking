from . import views
from django.urls import path
urlpatterns = [
    path('', views.loginPage, name='loginPage'),
    path('dashboard/',views.dashboard, name='dashboard'),
    path('Book_Room/<int:roomId>/<str:roomName>/',views.Book_Room,name='Book_Room'),
    path('logout/',views.logout_page,name='logout_page'),
    path('my_booking/',views.my_booking,name='my_booking'),
    path('Calendar_View/',views.Calendar_View,name='Calendar_View'),
]