from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Review, ReviewPhoto


@receiver(post_save, sender=Review)
def recalc_on_review_save(sender, instance, **kwargs):
    instance.place.recalculate_ratings()


@receiver(post_delete, sender=Review)
def recalc_on_review_delete(sender, instance, **kwargs):
    # place may already be gone if this delete is part of a City/Place cascade
    from .models import Place

    if Place.objects.filter(pk=instance.place_id).exists():
        instance.place.recalculate_ratings()


@receiver(post_delete, sender=ReviewPhoto)
def delete_photo_file(sender, instance, **kwargs):
    # Having this receiver forces Django's collector to fetch+delete
    # ReviewPhoto rows individually (no fast-delete) even when cascading
    # from a Review/Place/City delete, so this always fires per photo.
    if instance.image:
        instance.image.delete(save=False)
