DELETE FROM "push_subscriptions"
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM "push_subscriptions"
  ORDER BY user_id, updated_at DESC, id DESC
);

CREATE UNIQUE INDEX "push_subscriptions_user_id_key" ON "push_subscriptions"("user_id");
