package dk.sdu.cloud.sql.migrations

import dk.sdu.cloud.sql.MigrationScript
import dk.sdu.cloud.sql.useAndInvokeAndDiscard

fun V1__FileDownloadSessions(): MigrationScript = MigrationScript("V1__FileDownloadSessions") { conn ->
    conn.prepareStatement(
        //language=SQLite
        """
            create table file_download_sessions(
                session text primary key,
                plugin_name text not null,
                plugin_data text not null
            )
        """
    ).useAndInvokeAndDiscard()
}
