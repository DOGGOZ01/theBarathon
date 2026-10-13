from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import CommentPhoto, Review, ReviewPhoto


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
    # Remove the image file. Having this receiver also makes cascades delete
    # photos one by one, so it runs for every photo.
    if instance.image:
        instance.image.delete(save=False)


@receiver(post_delete, sender=CommentPhoto)
def delete_comment_photo_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
