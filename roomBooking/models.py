from django.contrib.auth.models import User
from django.db import models
from django.utils.datetime_safe import date
from django.db.models.signals import post_save
from django.dispatch import receiver


# 1. User Profile Model (To store session tokens)
class UserProfile(models.Model):

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    session_token = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"


# Signals to automatically create/save a profile when a User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


# Create your models here.
class RoomsAvailable(models.Model):

    roomId = models.IntegerField(primary_key = True)
    roomName = models.CharField(max_length = 100)
    roomCapacity = models.IntegerField()
    roomImages = models.ImageField(upload_to='roomImages')
    roomMonitor = models.BooleanField(default=False)
    whiteBoard = models.BooleanField(default=False)
    videoConferencing = models.BooleanField(default=False)
    is_maintenance = models.BooleanField(
        default=False, 
        verbose_name="Under Maintenance",
        help_text="Check this box to disable room bookings and mark as maintenance"
    )

    def __str__(self):
        return f"{self.roomName} ('Maintenance' if self.is_maintenance else 'Active')"

class Booking(models.Model):

    roomId =models.ForeignKey(RoomsAvailable,on_delete=models.CASCADE,to_field="roomId",null=True,blank=True,db_column="roomId")
    bookedRoom = models.CharField(max_length = 100,null=True,blank=True,db_column="bookedRoom")
    bookedDate = models.DateField(default=date.today)
    startTime = models.TimeField()
    endTime = models.TimeField()
    bookedByUsername = models.ForeignKey(
        User,
        to_field="username",
        db_column="bookedByUsername",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

