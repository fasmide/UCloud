package dk.sdu.cloud.activity.util

import dk.sdu.cloud.activity.api.ActivityEvent
import dk.sdu.cloud.service.test.TestUsers

internal val downloadEvent = ActivityEvent.Download(
    TestUsers.user.username,
    123456789,
    "1",
    "originalFilePath",
    null
)

internal val updatedEvent = ActivityEvent.Updated(
    TestUsers.user.username,
    123456787,
    "2",
    "originalFilePath",
    null
)

internal val favoriteEvent = ActivityEvent.Favorite(
    TestUsers.user.username,
    true,
    123456987,
    "3",
    "originalFilePath",
    null
)

internal val inspectedEvent = ActivityEvent.Inspected(
    TestUsers.user.username,
    1234567987,
    "4",
    "originalFilePath",
    null
)

internal val movedEvent = ActivityEvent.Moved(
    TestUsers.user.username,
    "newName",
    123456798,
    "5",
    "originalFilePath",
    null
)

internal val deletedEvent = ActivityEvent.Deleted(
    123456789,
    "6",
    TestUsers.user.username,
    "originalFilePath",
    null
)
