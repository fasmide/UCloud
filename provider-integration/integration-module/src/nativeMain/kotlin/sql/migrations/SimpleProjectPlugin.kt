package dk.sdu.cloud.sql.migrations

import dk.sdu.cloud.sql.MigrationScript
import dk.sdu.cloud.sql.useAndInvoke
import dk.sdu.cloud.sql.useAndInvokeAndDiscard

fun V1__SimpleProjectPluginInitial(): MigrationScript = MigrationScript("V1__SimpleProjectPluginInitial") { session ->
    session.prepareStatement(
        //language=SQLite
        """
            create table simple_project_group_mapper(
                ucloud_id text unique not null,
                local_id integer primary key autoincrement
            );
        """
    ).useAndInvokeAndDiscard()

    session.prepareStatement(
        //language=SQLite
        """
            create table simple_project_project_database(
                ucloud_id text primary key,
                project_as_json text not null 
            );
        """
    ).useAndInvokeAndDiscard()
}

fun V2__SimpleProjectPlugin() = MigrationScript("V2__SimpleProjectPlugin") { session ->
    session.prepareStatement(
        """
            create table simple_project_missing_connections(
                ucloud_id text not null,
                project_id text not null,
                created_at timestamp not null default current_timestamp,
                primary key (ucloud_id, project_id)
            );
        """
    ).useAndInvokeAndDiscard()
}
