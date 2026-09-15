import io
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .models import City, Comment, InviteConfig, Notification, Place, PlaceTopVote, Reaction, Review

User = get_user_model()


def make_place(owner, place_type=Place.TYPE_BAR):
    city = City.objects.create(name="Paris", country="France", latitude=48.85, longitude=2.35)
    return Place.objects.create(
        city=city, name="Le Bar", place_type=place_type, latitude=48.85, longitude=2.35, created_by=owner
    )


def make_tiny_png(name="a.png"):
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="red").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


class ThreadedCommentsAndReactionsTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")
        self.carol = User.objects.create_user(username="carol", password="pw")
        self.place = make_place(self.alice)
        self.review = Review.objects.create(
            place=self.place, user=self.alice, rating_atmosphere=4, rating_drinks=4, rating_price=4, text="Sympa"
        )

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_reply_to_review_notifies_review_owner_not_self(self):
        client = self.client_as(self.bob)
        res = client.post(f"/api/reviews/{self.review.id}/comments/", {"text": "D'accord !"})
        self.assertEqual(res.status_code, 201, res.data)
        comment_id = res.data["id"]

        self.assertEqual(Notification.objects.filter(recipient=self.alice, verb="reply").count(), 1)
        notif = Notification.objects.get(recipient=self.alice, verb="reply")
        self.assertEqual(notif.actor, self.bob)
        self.assertEqual(notif.comment_id, comment_id)

        # Alice replying to her own review shouldn't notify herself.
        client_alice = self.client_as(self.alice)
        client_alice.post(f"/api/reviews/{self.review.id}/comments/", {"text": "Merci !"})
        self.assertEqual(Notification.objects.filter(recipient=self.alice, verb="reply").count(), 1)

    def test_nested_reply_notifies_parent_comment_author_and_appears_in_tree(self):
        top = Comment.objects.create(review=self.review, user=self.bob, text="D'accord !")

        client = self.client_as(self.carol)
        res = client.post(f"/api/comments/{top.id}/replies/", {"text": "+1"})
        self.assertEqual(res.status_code, 201, res.data)

        self.assertTrue(Notification.objects.filter(recipient=self.bob, actor=self.carol, verb="reply").exists())

        thread = client.get(f"/api/reviews/{self.review.id}/comments/")
        self.assertEqual(len(thread.data), 1)
        self.assertEqual(thread.data[0]["id"], top.id)
        self.assertEqual(len(thread.data[0]["replies"]), 1)
        self.assertEqual(thread.data[0]["replies"][0]["text"], "+1")

    def test_reaction_toggle_and_notification(self):
        client = self.client_as(self.bob)
        res = client.post(f"/api/reviews/{self.review.id}/react/", {"emoji": "love"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["reactions_summary"], [{"emoji": "love", "count": 1}])
        self.assertEqual(res.data["my_reaction"], "love")
        self.assertTrue(Notification.objects.filter(recipient=self.alice, verb="reaction").exists())

        # Switching emoji updates in place (still one reaction row).
        client.post(f"/api/reviews/{self.review.id}/react/", {"emoji": "haha"})
        self.assertEqual(Reaction.objects.filter(user=self.bob).count(), 1)
        self.assertEqual(Reaction.objects.get(user=self.bob).emoji, "haha")

        # Posting the same emoji again toggles it off.
        res = client.post(f"/api/reviews/{self.review.id}/react/", {"emoji": "haha"})
        self.assertEqual(res.data["reactions_summary"], [])
        self.assertEqual(res.data["my_reaction"], None)
        self.assertEqual(Reaction.objects.filter(user=self.bob).count(), 0)

    def test_reacting_to_own_review_does_not_self_notify(self):
        client = self.client_as(self.alice)
        client.post(f"/api/reviews/{self.review.id}/react/", {"emoji": "like"})
        self.assertFalse(Notification.objects.filter(recipient=self.alice, verb="reaction").exists())

    def test_notification_unread_count_and_mark_read(self):
        self.client_as(self.bob).post(f"/api/reviews/{self.review.id}/comments/", {"text": "hey"})
        client = self.client_as(self.alice)
        res = client.get("/api/notifications/unread-count/")
        # Alice owns both the review (-> "reply") and the place (-> "place_activity").
        self.assertEqual(res.data["count"], 2)

        client.post("/api/notifications/mark-read/")
        res = client.get("/api/notifications/unread-count/")
        self.assertEqual(res.data["count"], 0)

    def test_activity_feed_excludes_own_items_but_keeps_all_places(self):
        other_place = make_place(self.bob)
        Review.objects.create(
            place=self.place, user=self.bob, rating_atmosphere=3, rating_drinks=3, rating_price=3, text="Bof"
        )

        client = self.client_as(self.alice)
        res = client.get("/api/activity/")
        types_and_users = [(i["type"], i["user"]["username"] if i["user"] else None) for i in res.data]

        self.assertIn(("place", self.alice.username), types_and_users)
        self.assertIn(("place", self.bob.username), types_and_users)
        self.assertIn(("review", self.bob.username), types_and_users)
        self.assertNotIn(("review", self.alice.username), types_and_users)

    def test_place_serializer_exposes_created_by(self):
        client = self.client_as(self.alice)
        res = client.get(f"/api/places/{self.place.id}/")
        self.assertEqual(res.data["created_by"]["username"], "alice")

    def test_avatar_upload_via_me_patch(self):
        client = self.client_as(self.alice)
        res = client.patch("/api/auth/me/", {"avatar": make_tiny_png()}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["avatar"])


class RegistrationAvatarTests(TestCase):
    def test_register_with_avatar_sets_it_immediately(self):
        invite = InviteConfig.get_solo()
        client = APIClient()
        res = client.post(
            "/api/auth/register/",
            {
                "username": "dora",
                "password": "correct horse battery staple",
                "invite_code": invite.code,
                "avatar": make_tiny_png(),
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["avatar"])
        self.assertTrue(User.objects.get(username="dora").avatar)

    def test_register_without_avatar_still_works(self):
        invite = InviteConfig.get_solo()
        client = APIClient()
        res = client.post(
            "/api/auth/register/",
            {"username": "eve", "password": "correct horse battery staple", "invite_code": invite.code},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(res.data["avatar"])

    def test_username_over_25_chars_is_rejected(self):
        invite = InviteConfig.get_solo()
        client = APIClient()
        res = client.post(
            "/api/auth/register/",
            {"username": "x" * 26, "password": "correct horse battery staple", "invite_code": invite.code},
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("username", res.data)

    def test_username_of_exactly_25_chars_is_accepted(self):
        invite = InviteConfig.get_solo()
        client = APIClient()
        res = client.post(
            "/api/auth/register/",
            {"username": "x" * 25, "password": "correct horse battery staple", "invite_code": invite.code},
        )
        self.assertEqual(res.status_code, 201, res.data)


class PlaceTypeAndSpendTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_bar_review_without_drinks_rating_is_rejected(self):
        place = make_place(self.alice, place_type=Place.TYPE_BAR)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_price": 4, "text": "Sympa"},
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("rating_drinks", res.data)

    def test_endroit_review_without_drinks_rating_succeeds_and_averages_over_two_criteria(self):
        place = make_place(self.alice, place_type=Place.TYPE_ENDROIT)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_price": 2, "text": "Sympa", "amount_spent": "15.50"},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data["rating_drinks"])

        place.refresh_from_db()
        self.assertEqual(place.avg_overall, 3)  # (4 + 2) / 2, not divided by 3
        self.assertEqual(place.avg_spent, 15.5)

    def test_endroit_review_ignores_drinks_rating_if_sent_anyway(self):
        place = make_place(self.alice, place_type=Place.TYPE_ENDROIT)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_drinks": 5, "rating_price": 2},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data["rating_drinks"])

    def test_balade_review_without_criteria_rating_is_rejected(self):
        place = make_place(self.alice, place_type=Place.TYPE_BALADE)
        client = self.client_as(self.bob)
        res = client.post(f"/api/places/{place.id}/reviews/", {"text": "Sympa"})
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("rating_overall", res.data)

    def test_balade_review_only_needs_overall_rating(self):
        place = make_place(self.alice, place_type=Place.TYPE_BALADE)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_overall": 4, "text": "Belle balade", "amount_spent": "3.50"},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data["rating_atmosphere"])
        self.assertIsNone(res.data["rating_drinks"])
        self.assertIsNone(res.data["rating_price"])
        self.assertEqual(res.data["rating_overall"], 4)

        place.refresh_from_db()
        self.assertEqual(place.avg_overall, 4)
        self.assertEqual(place.avg_atmosphere, 0)
        self.assertEqual(place.avg_spent, 3.5)

    def test_balade_review_ignores_criteria_ratings_if_sent_anyway(self):
        place = make_place(self.alice, place_type=Place.TYPE_BALADE)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_overall": 5, "rating_atmosphere": 4, "rating_drinks": 4, "rating_price": 2},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data["rating_atmosphere"])
        self.assertIsNone(res.data["rating_drinks"])
        self.assertIsNone(res.data["rating_price"])

    def test_evenement_review_only_needs_overall_rating(self):
        place = make_place(self.alice, place_type=Place.TYPE_EVENEMENT)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_overall": 5, "text": "Super soirée"},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data["rating_atmosphere"])
        self.assertIsNone(res.data["rating_drinks"])
        self.assertIsNone(res.data["rating_price"])
        self.assertEqual(res.data["rating_overall"], 5)

        place.refresh_from_db()
        self.assertEqual(place.avg_overall, 5)

    def test_amount_spent_average_ignores_reviews_that_omitted_it(self):
        place = make_place(self.alice, place_type=Place.TYPE_BAR)
        Review.objects.create(
            place=place, user=self.alice, rating_atmosphere=4, rating_drinks=4, rating_price=4, amount_spent=None
        )
        Review.objects.create(
            place=place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4, amount_spent=20
        )
        place.recalculate_ratings()
        self.assertEqual(place.avg_spent, 20)  # only the review with a value counts

    def test_owner_can_edit_own_place_name_and_photo(self):
        place = make_place(self.alice)
        client = self.client_as(self.alice)
        res = client.patch(f"/api/places/{place.id}/", {"name": "Le Nouveau Bar"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["name"], "Le Nouveau Bar")

    def test_owner_cannot_change_city_or_coordinates(self):
        other_city = City.objects.create(name="Lyon", country="France", latitude=45.75, longitude=4.85)
        place = make_place(self.alice)
        client = self.client_as(self.alice)
        res = client.patch(f"/api/places/{place.id}/", {"city": other_city.id})
        self.assertEqual(res.status_code, 403, res.data)

    def test_non_owner_cannot_edit_someone_elses_place(self):
        place = make_place(self.alice)
        client = self.client_as(self.bob)
        res = client.patch(f"/api/places/{place.id}/", {"name": "Bar Volé"})
        self.assertEqual(res.status_code, 403, res.data)

    def test_admin_can_edit_any_place_field(self):
        admin = User.objects.create_superuser(username="root", password="pw")
        other_city = City.objects.create(name="Lyon", country="France", latitude=45.75, longitude=4.85)
        place = make_place(self.alice)
        client = self.client_as(admin)
        res = client.patch(f"/api/places/{place.id}/", {"city": other_city.id})
        self.assertEqual(res.status_code, 200, res.data)

    def test_evenement_requires_event_date_on_creation(self):
        city = City.objects.create(name="Paris", country="France", latitude=48.85, longitude=2.35)
        client = self.client_as(self.alice)
        res = client.post(
            "/api/places/",
            {"city": city.id, "name": "Concert", "place_type": "evenement", "latitude": 48.85, "longitude": 2.35},
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("event_date", res.data)

    def test_evenement_with_event_date_is_created(self):
        city = City.objects.create(name="Paris", country="France", latitude=48.85, longitude=2.35)
        client = self.client_as(self.alice)
        res = client.post(
            "/api/places/",
            {
                "city": city.id,
                "name": "Concert",
                "place_type": "evenement",
                "event_date": "2026-10-01T20:00:00Z",
                "latitude": 48.85,
                "longitude": 2.35,
            },
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNotNone(res.data["event_date"])

    def test_owner_can_update_event_date(self):
        place = make_place(self.alice, place_type=Place.TYPE_EVENEMENT)
        place.event_date = "2026-10-01T20:00:00Z"
        place.save(update_fields=["event_date"])
        client = self.client_as(self.alice)
        res = client.patch(f"/api/places/{place.id}/", {"event_date": "2026-10-02T21:00:00Z"})
        self.assertEqual(res.status_code, 200, res.data)

    def test_mine_endpoint_returns_only_own_places(self):
        make_place(self.alice)
        make_place(self.bob)
        client = self.client_as(self.alice)
        res = client.get("/api/places/mine/")
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["created_by"]["username"], "alice")


class BugfixRegressionTests(TestCase):
    """Covers the fixes applied after the 2026-08-29 audit round."""

    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_changing_place_type_recalculates_averages(self):
        place = make_place(self.alice, place_type=Place.TYPE_BAR)
        Review.objects.create(
            place=place, user=self.bob, rating_atmosphere=4, rating_drinks=2, rating_price=4
        )
        place.refresh_from_db()
        self.assertEqual(float(place.avg_overall), round((4 + 2 + 4) / 3, 2))

        admin = User.objects.create_superuser(username="root", password="pw")
        client = self.client_as(admin)
        res = client.patch(f"/api/places/{place.id}/", {"place_type": "endroit"})
        self.assertEqual(res.status_code, 200, res.data)

        place.refresh_from_db()
        # Drinks no longer counts toward overall once the type no longer has it.
        self.assertEqual(float(place.avg_overall), round((4 + 4) / 2, 2))

    def test_removing_a_reaction_deletes_its_notification(self):
        place = make_place(self.alice)
        review = Review.objects.create(
            place=place, user=self.alice, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )
        client = self.client_as(self.bob)

        client.post(f"/api/reviews/{review.id}/react/", {"emoji": "like"})
        self.assertTrue(Notification.objects.filter(recipient=self.alice, verb="reaction").exists())

        # Posting the same emoji again toggles the reaction off.
        client.post(f"/api/reviews/{review.id}/react/", {"emoji": "like"})
        self.assertFalse(Notification.objects.filter(recipient=self.alice, verb="reaction").exists())

    def test_logout_blacklists_refresh_token(self):
        client = APIClient()
        login_res = client.post("/api/auth/login/", {"username": "alice", "password": "pw"})
        self.assertEqual(login_res.status_code, 200, login_res.data)

        logout_res = client.post("/api/auth/logout/")
        self.assertEqual(logout_res.status_code, 204)

        # The refresh cookie was deleted by logout, but an attacker who
        # captured it beforehand should not be able to reuse it afterwards —
        # re-attach it manually and confirm the backend now rejects it.
        raw_refresh = login_res.cookies["refresh_token"].value
        client.cookies["refresh_token"] = raw_refresh
        refresh_res = client.post("/api/auth/refresh/")
        self.assertEqual(refresh_res.status_code, 401, refresh_res.data)

    def test_comment_tree_serialization_is_a_bounded_number_of_queries(self):
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        place = make_place(self.alice)
        review = Review.objects.create(
            place=place, user=self.alice, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )
        top = Comment.objects.create(review=review, user=self.bob, text="top")
        mid = Comment.objects.create(review=review, user=self.alice, parent=top, text="mid")
        Comment.objects.create(review=review, user=self.bob, parent=mid, text="leaf")

        client = self.client_as(self.alice)
        with CaptureQueriesContext(connection) as ctx:
            res = client.get(f"/api/places/{place.id}/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["reviews"][0]["comments"][0]["replies"][0]["replies"][0]["text"], "leaf")
        # One comment tree, 3 levels deep — the pre-fix implementation issued
        # one extra query per node; this should stay flat regardless of depth.
        self.assertLess(len(ctx.captured_queries), 15, "comment tree serialization is not flattened (N+1 regressed)")


class CharacterLimitTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_place_name_over_50_chars_is_rejected(self):
        city = City.objects.create(name="Paris", country="France", latitude=48.85, longitude=2.35)
        client = self.client_as(self.alice)
        res = client.post(
            "/api/places/",
            {
                "city": city.id,
                "name": "x" * 51,
                "place_type": "bar",
                "latitude": "48.85",
                "longitude": "2.35",
            },
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("name", res.data)

    def test_place_name_of_exactly_50_chars_is_accepted(self):
        city = City.objects.create(name="Paris", country="France", latitude=48.85, longitude=2.35)
        client = self.client_as(self.alice)
        res = client.post(
            "/api/places/",
            {
                "city": city.id,
                "name": "x" * 50,
                "place_type": "bar",
                "latitude": "48.85",
                "longitude": "2.35",
            },
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_review_text_over_2000_chars_is_rejected(self):
        place = make_place(self.alice)
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_drinks": 4, "rating_price": 4, "text": "x" * 2001},
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("text", res.data)

    def test_comment_text_over_2000_chars_is_rejected(self):
        place = make_place(self.alice)
        review = Review.objects.create(
            place=place, user=self.alice, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )
        client = self.client_as(self.bob)
        res = client.post(f"/api/reviews/{review.id}/comments/", {"text": "x" * 2001})
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("text", res.data)


class PlaceActivityNotificationAndProfileTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")
        self.carol = User.objects.create_user(username="carol", password="pw")
        self.place = make_place(self.alice)

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_new_review_notifies_place_owner(self):
        client = self.client_as(self.bob)
        res = client.post(
            f"/api/places/{self.place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_drinks": 4, "rating_price": 4, "text": "Top"},
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(
            Notification.objects.filter(recipient=self.alice, actor=self.bob, verb="place_activity").exists()
        )

    def test_owner_reviewing_own_place_does_not_self_notify(self):
        client = self.client_as(self.alice)
        client.post(
            f"/api/places/{self.place.id}/reviews/",
            {"rating_atmosphere": 4, "rating_drinks": 4, "rating_price": 4},
        )
        self.assertFalse(Notification.objects.filter(recipient=self.alice, verb="place_activity").exists())

    def test_comment_on_someone_elses_review_of_your_place_notifies_you(self):
        review = Review.objects.create(
            place=self.place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )
        client = self.client_as(self.carol)
        res = client.post(f"/api/reviews/{review.id}/comments/", {"text": "hey"})
        self.assertEqual(res.status_code, 201, res.data)
        # Alice owns the place (not the review) and should still be notified.
        self.assertTrue(
            Notification.objects.filter(recipient=self.alice, actor=self.carol, verb="place_activity").exists()
        )
        # Bob owns the review itself, so gets the separate "reply" notification.
        self.assertTrue(Notification.objects.filter(recipient=self.bob, actor=self.carol, verb="reply").exists())

    def test_nested_reply_notifies_place_owner_too(self):
        review = Review.objects.create(
            place=self.place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )
        top = Comment.objects.create(review=review, user=self.bob, text="top")
        client = self.client_as(self.carol)
        res = client.post(f"/api/comments/{top.id}/replies/", {"text": "+1"})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(
            Notification.objects.filter(recipient=self.alice, actor=self.carol, verb="place_activity").exists()
        )

    def test_profile_endpoint_returns_places_and_reviews_only_not_comments(self):
        make_place(self.bob)
        Review.objects.create(
            place=self.place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4, text="Bof"
        )
        review2 = Review.objects.create(
            place=self.place, user=self.alice, rating_atmosphere=5, rating_drinks=5, rating_price=5
        )
        # Bob also replies on Alice's review — a profile is "their own stuff",
        # so this comment must NOT show up in bob's profile activity.
        Comment.objects.create(review=review2, user=self.bob, text="nice")

        client = self.client_as(self.alice)
        res = client.get(f"/api/users/{self.bob.id}/profile/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["user"]["username"], "bob")
        self.assertEqual(len(res.data["places"]), 1)
        types = {item["type"] for item in res.data["activity"]}
        self.assertEqual(types, {"review"})
        self.assertEqual(len(res.data["activity"]), 1)


class AdminUserManagementTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="root", password="pw")
        self.alice = User.objects.create_user(username="alice", password="pw")

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_non_admin_cannot_list_users(self):
        client = self.client_as(self.alice)
        res = client.get("/api/admin/users/")
        self.assertEqual(res.status_code, 403)

    def test_admin_can_list_users(self):
        client = self.client_as(self.admin)
        res = client.get("/api/admin/users/")
        self.assertEqual(res.status_code, 200, res.data)
        usernames = {u["username"] for u in res.data}
        self.assertEqual(usernames, {"root", "alice"})

    def test_admin_can_delete_another_user(self):
        client = self.client_as(self.admin)
        res = client.delete(f"/api/admin/users/{self.alice.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(User.objects.filter(id=self.alice.id).exists())

    def test_admin_cannot_delete_own_account(self):
        client = self.client_as(self.admin)
        res = client.delete(f"/api/admin/users/{self.admin.id}/")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_non_admin_cannot_delete_users(self):
        other = User.objects.create_user(username="bob", password="pw")
        client = self.client_as(self.alice)
        res = client.delete(f"/api/admin/users/{other.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(User.objects.filter(id=other.id).exists())


class PlaceTopVoteAndLeaderboardTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", password="pw")
        self.bob = User.objects.create_user(username="bob", password="pw")

    def client_as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_top_vote_requires_a_review_first(self):
        place = make_place(self.alice)
        client = self.client_as(self.bob)
        res = client.post(f"/api/places/{place.id}/top/")
        self.assertEqual(res.status_code, 403, res.data)

    def test_top_vote_succeeds_after_reviewing(self):
        place = make_place(self.alice)
        Review.objects.create(place=place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4)
        client = self.client_as(self.bob)
        res = client.post(f"/api/places/{place.id}/top/")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["top_count"], 1)
        self.assertIsNotNone(res.data["next_available_at"])

    def test_top_vote_is_blocked_within_cooldown(self):
        place = make_place(self.alice)
        Review.objects.create(place=place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4)
        client = self.client_as(self.bob)
        first = client.post(f"/api/places/{place.id}/top/")
        self.assertEqual(first.status_code, 201, first.data)
        second = client.post(f"/api/places/{place.id}/top/")
        self.assertEqual(second.status_code, 429, second.data)
        self.assertEqual(place.top_votes.count(), 1)

    def test_top_vote_available_again_after_cooldown(self):
        place = make_place(self.alice)
        Review.objects.create(place=place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4)
        vote = PlaceTopVote.objects.create(place=place, user=self.bob)
        PlaceTopVote.objects.filter(pk=vote.pk).update(created_at=timezone.now() - timedelta(hours=25))
        client = self.client_as(self.bob)
        res = client.post(f"/api/places/{place.id}/top/")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(place.top_votes.count(), 2)

    def test_place_leaderboard_orders_by_top_count(self):
        popular = make_place(self.alice)
        popular.name = "Popular"
        popular.save(update_fields=["name"])
        Place.objects.create(
            city=popular.city, name="Quiet", place_type=Place.TYPE_BAR, latitude=48.85, longitude=2.35, created_by=self.alice
        )
        Review.objects.create(place=popular, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4)
        client = self.client_as(self.bob)
        client.post(f"/api/places/{popular.id}/top/")

        res = client.get("/api/leaderboard/places/")
        self.assertEqual(res.status_code, 200, res.data)
        names = [row["place"]["name"] for row in res.data["results"]]
        self.assertEqual(names[0], "Popular")
        self.assertIn("Quiet", names)

    def test_place_leaderboard_search_keeps_global_rank(self):
        popular = make_place(self.alice)
        popular.name = "Popular"
        popular.save(update_fields=["name"])
        Place.objects.create(
            city=popular.city, name="Quiet", place_type=Place.TYPE_BAR, latitude=48.85, longitude=2.35, created_by=self.alice
        )
        Review.objects.create(place=popular, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4)
        client = self.client_as(self.bob)
        client.post(f"/api/places/{popular.id}/top/")

        res = client.get("/api/leaderboard/places/?search=Quiet")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["rank"], 2)

    def test_user_leaderboard_ranks_by_combined_score(self):
        make_place(self.alice)  # alice: +5 for adding a place
        place = Place.objects.filter(created_by=self.alice).first()
        Review.objects.create(
            place=place, user=self.bob, rating_atmosphere=4, rating_drinks=4, rating_price=4
        )  # bob: +3 for a review
        client = self.client_as(self.alice)
        res = client.get("/api/leaderboard/users/")
        self.assertEqual(res.status_code, 200, res.data)
        usernames = [row["user"]["username"] for row in res.data["results"]]
        self.assertEqual(usernames[0], "alice")
        self.assertEqual(res.data["results"][0]["rank"], 1)

    def test_user_leaderboard_pagination_has_more(self):
        for i in range(15):
            User.objects.create_user(username=f"user{i}", password="pw")
        client = self.client_as(self.alice)
        res = client.get("/api/leaderboard/users/?limit=5&offset=0")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data["results"]), 5)
        self.assertTrue(res.data["has_more"])
